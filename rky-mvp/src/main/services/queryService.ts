import { queryRepository, queryHistoryRepository } from '#/repositories';
import { connectionService } from './connectionService';
import { createMysqlConnection, closeMysqlConnection } from '#/infrastructure';
import { createPgConnection, closePgConnection } from '#/infrastructure';
import { createSqliteConnection, closeSqliteConnection } from '#/infrastructure';
import type { IQuery, IQueryResult, IQueryHistory, IExplainResult } from '~/shared/types/db';
import type { TDbType } from '~/shared/types/db';
import { classifyQueryType, buildExplainAnalyzeSql, parseExplainSummary } from '~/shared/lib/explainSql';

export const queryService = {
  async executeQuery(connectionId: string, sql: string): Promise<IQueryResult> {
    const config = connectionService.getConnectionConfig(connectionId);
    const start = Date.now();

    try {
      let result: IQueryResult;

      if (config.dbType === 'mysql' || config.dbType === 'mariadb') {
        result = await executeMysqlScript(config, sql);
      } else if (config.dbType === 'postgresql') {
        result = await executePgScript(config, sql);
      } else if (config.dbType === 'sqlite') {
        result = executeSqliteScript(config, sql);
      } else {
        throw new Error(`Unsupported database type: ${config.dbType}`);
      }

      result.executionTimeMs = Date.now() - start;

      // Save to history
      queryHistoryRepository.create({
        sqlContent: sql,
        executionTimeMs: result.executionTimeMs,
        rowCount: result.rowCount,
        status: 'success',
      });

      return result;
    } catch (error) {
      const executionTimeMs = Date.now() - start;

      queryHistoryRepository.create({
        sqlContent: sql,
        executionTimeMs,
        rowCount: 0,
        status: 'error',
        errorMessage: (error as Error).message,
      });

      throw error;
    }
  },

  listQueries(): IQuery[] {
    return queryRepository.list();
  },

  saveQuery(data: {
    name: string;
    description: string;
    sqlContent: string;
    tags: string[];
  }): IQuery {
    return queryRepository.create(data);
  },

  updateQuery(
    id: string,
    data: Partial<{ name: string; description: string; sqlContent: string; tags: string[] }>,
  ): IQuery {
    return queryRepository.update(id, data);
  },

  deleteQuery(id: string): void {
    queryRepository.deleteById(id);
  },

  listHistory(limit?: number): IQueryHistory[] {
    return queryHistoryRepository.list(limit);
  },

  async explainAnalyze(connectionId: string, sql: string, dbType: TDbType): Promise<IExplainResult> {
    const config = connectionService.getConnectionConfig(connectionId);
    const queryType = classifyQueryType(sql);
    const explainSql = buildExplainAnalyzeSql(dbType, sql, queryType);
    const needsRollback = queryType === 'DML' && dbType !== 'sqlite';

    let result: IQueryResult;

    if (needsRollback) {
      if (config.dbType === 'mysql' || config.dbType === 'mariadb') {
        const conn = await createMysqlConnection({
          host: config.host, port: config.port, database: config.database,
          username: config.username, password: config.password,
          sslEnabled: config.sslEnabled, sslConfig: config.sslConfig,
        });
        try {
          await conn.query('BEGIN');
          try {
            const [results, fields] = await conn.query(explainSql);
            result = mapMysqlResult(results, fields);
          } finally {
            await conn.query('ROLLBACK');
          }
        } finally {
          await closeMysqlConnection(conn);
        }
      } else {
        const client = await createPgConnection({
          host: config.host, port: config.port, database: config.database,
          username: config.username, password: config.password,
          sslEnabled: config.sslEnabled, sslConfig: config.sslConfig,
        });
        try {
          await client.query('BEGIN');
          try {
            const pgResult = await client.query(explainSql);
            result = {
              columns: pgResult.fields?.map((f) => f.name) ?? [],
              rows: pgResult.rows ?? [],
              rowCount: pgResult.rows?.length ?? 0,
              executionTimeMs: 0,
            };
          } finally {
            await client.query('ROLLBACK');
          }
        } finally {
          await closePgConnection(client);
        }
      }
    } else if (dbType === 'sqlite') {
      const db = createSqliteConnection({ database: config.database });
      try {
        const rows = db.prepare(explainSql).all() as Record<string, unknown>[];
        result = {
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          rows,
          rowCount: rows.length,
          executionTimeMs: 0,
        };
      } finally {
        closeSqliteConnection(db);
      }
    } else {
      result = await this.executeQuery(connectionId, explainSql);
    }

    const summary = parseExplainSummary(result.rows, dbType);
    return {
      planRows: result.rows,
      summary,
      rawJson: result.rows.length > 0 ? result.rows[0] : undefined,
    };
  },
};

async function executeMysqlScript(
  config: { host: string; port: number; database: string; username: string; password: string; sslEnabled: boolean; sslConfig?: Record<string, unknown> },
  sql: string,
): Promise<IQueryResult> {
  const statements = splitStatements(sql);
  if (statements.length === 0) {
    throw new Error('SQL is empty.');
  }

  const conn = await createMysqlConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    sslEnabled: config.sslEnabled,
    sslConfig: config.sslConfig,
  });

  try {
    let lastResult: IQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
    };
    let totalAffectedRows = 0;

    for (const statement of statements) {
      const [results, fields] = await conn.query(statement);
      lastResult = mapMysqlResult(results, fields);
      if (typeof lastResult.affectedRows === 'number') {
        totalAffectedRows += lastResult.affectedRows;
      }
    }

    if (statements.length > 1) {
      return {
        ...lastResult,
        affectedRows: totalAffectedRows,
      };
    }

    return lastResult;
  } finally {
    await closeMysqlConnection(conn);
  }
}

function mapMysqlResult(
  results: unknown,
  fields: unknown,
): IQueryResult {
  if (Array.isArray(results)) {
    const rows = results as Record<string, unknown>[];
    const columns = fields
      ? (fields as Array<{ name: string }>).map((f) => f.name)
      : (rows.length > 0 ? Object.keys(rows[0]) : []);

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: 0,
    };
  }

  const info = results as { affectedRows?: number };
  return {
    columns: [],
    rows: [],
    rowCount: 0,
    executionTimeMs: 0,
    affectedRows: info.affectedRows,
  };
}

async function executePgScript(
  config: { host: string; port: number; database: string; username: string; password: string; sslEnabled: boolean; sslConfig?: Record<string, unknown> },
  sql: string,
): Promise<IQueryResult> {
  const statements = splitStatements(sql);
  if (statements.length === 0) {
    throw new Error('SQL is empty.');
  }

  const client = await createPgConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    sslEnabled: config.sslEnabled,
    sslConfig: config.sslConfig,
  });

  try {
    let lastResult: IQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
    };
    let totalAffectedRows = 0;

    for (const statement of statements) {
      const result = await client.query(statement);
      const columns = result.fields ? result.fields.map((f) => f.name) : [];
      const rows = result.rows ?? [];
      const affectedRows = typeof result.rowCount === 'number' ? result.rowCount : undefined;

      if (typeof affectedRows === 'number') {
        totalAffectedRows += affectedRows;
      }

      lastResult = {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: 0,
        affectedRows,
      };
    }

    if (statements.length > 1) {
      return {
        ...lastResult,
        affectedRows: totalAffectedRows,
      };
    }

    return lastResult;
  } finally {
    await closePgConnection(client);
  }
}

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      current += ch;
      if (ch === stringChar && sql[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') depth++;
    if (ch === ')') depth--;

    if (ch === ';' && depth === 0) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function executeSqliteScript(
  config: { database: string },
  sql: string,
): IQueryResult {
  const statements = splitStatements(sql);
  if (statements.length === 0) {
    throw new Error('SQL is empty.');
  }

  const db = createSqliteConnection({ database: config.database });

  try {
    let lastResult: IQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
    };
    let totalAffectedRows = 0;

    for (const statement of statements) {
      const upper = statement.trim().toUpperCase();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('EXPLAIN');

      if (isSelect) {
        const rows = db.prepare(statement).all() as Record<string, unknown>[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        lastResult = {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: 0,
        };
      } else {
        const info = db.prepare(statement).run();
        totalAffectedRows += info.changes;
        lastResult = {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: 0,
          affectedRows: info.changes,
        };
      }
    }

    if (statements.length > 1) {
      return {
        ...lastResult,
        affectedRows: totalAffectedRows,
      };
    }

    return lastResult;
  } finally {
    closeSqliteConnection(db);
  }
}
