import * as fs from 'node:fs';
import { connectionService } from './connectionService';
import { schemaService } from './schemaService';
import { createMysqlConnection, closeMysqlConnection } from '#/infrastructure';
import { createPgConnection, closePgConnection } from '#/infrastructure';
import { createSqliteConnection, closeSqliteConnection } from '#/infrastructure';
import { DIALECT_INFO } from '~/shared/types/db';
import type {
  ISchemaObjects, ISchemaView, IRoutine, ITrigger, IDbEvent,
  ICustomType, ISequence, ISchemaIndex, TSchemaObjectType, TDbType,
  IPartition, IRole, IRlsPolicy, IGrant,
  IExtension, IForeignTable, ISchemaNamespace, ITablespace, ICollationDef,
  ITableStatistics, ISqlitePragmaResult, ISqliteDbInfo,
} from '~/shared/types/db';

// ─── MySQL / MariaDB row types ───

interface MysqlViewRow {
  TABLE_NAME: string;
  VIEW_DEFINITION: string;
}

interface MysqlRoutineRow {
  ROUTINE_NAME: string;
  ROUTINE_TYPE: string;
  ROUTINE_DEFINITION: string | null;
  DATA_TYPE: string;
  DTD_IDENTIFIER: string;
}

interface MysqlTriggerRow {
  TRIGGER_NAME: string;
  EVENT_OBJECT_TABLE: string;
  ACTION_TIMING: string;
  EVENT_MANIPULATION: string;
  ACTION_STATEMENT: string;
}

interface MysqlEventRow {
  EVENT_NAME: string;
  EVENT_DEFINITION: string;
  EXECUTE_AT: string | null;
  EVENT_TYPE: string;
  INTERVAL_VALUE: string | null;
  INTERVAL_FIELD: string | null;
  STATUS: string;
}

interface MysqlIndexRow {
  INDEX_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
  INDEX_TYPE: string;
}

interface MysqlPartitionRow {
  TABLE_NAME: string;
  PARTITION_METHOD: string;
  PARTITION_EXPRESSION: string;
  PARTITION_NAME: string | null;
  PARTITION_DESCRIPTION: string | null;
  SUBPARTITION_METHOD: string | null;
}

interface MysqlUserRow {
  User: string;
  Host: string;
  account_locked: string;
}

interface MysqlTablePrivilegeRow {
  GRANTEE: string;
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  PRIVILEGE_TYPE: string;
  IS_GRANTABLE: string;
}

interface MysqlCollationRow {
  COLLATION_NAME: string;
  CHARACTER_SET_NAME: string;
  IS_DEFAULT: string;
}

// ─── PostgreSQL row types ───

interface PgViewRow {
  viewname: string;
  definition: string;
}

interface PgMatViewRow {
  matviewname: string;
  definition: string;
}

interface PgFunctionRow {
  proname: string;
  funcdef: string;
  prokind: string;
  lanname: string;
  return_type: string;
  param_names: string[] | null;
  param_types: string | null;
  param_modes: string[] | null;
  func_identity: string;
}

interface PgTriggerRow {
  tgname: string;
  relname: string;
  tgtype: number;
  tgdef: string;
}

interface PgTypeRow {
  typname: string;
  typtype: string;
  enum_values: string | null;
  attributes: string | null;
}

interface PgSequenceRow {
  sequencename: string;
  data_type: string;
  start_value: string;
  increment_by: string;
  min_value: string;
  max_value: string;
  cycle: boolean;
}

interface PgIndexRow {
  indexname: string;
  tablename: string;
  indexdef: string;
}

interface PgPartitionRow {
  parent_table: string;
  partition_name: string;
  partition_strategy: string;
  partition_expression: string;
  partition_bound: string;
}

interface PgRoleRow {
  rolname: string;
  rolcanlogin: boolean;
  rolsuper: boolean;
  rolinherit: boolean;
  memberof: string | null;
}

interface PgPolicyRow {
  policyname: string;
  tablename: string;
  cmd: string;
  roles: string;
  qual: string | null;
  with_check: string | null;
}

interface PgGrantRow {
  grantee: string;
  table_schema: string;
  table_name: string;
  privilege_type: string;
  is_grantable: string;
}

interface PgExtensionRow {
  extname: string;
  extversion: string;
  nspname: string;
  description: string | null;
}

interface PgSchemaRow {
  nspname: string;
  nspowner: string;
  description: string | null;
}

interface PgForeignTableRow {
  foreign_table_name: string;
  foreign_server_name: string;
  foreign_table_schema: string;
}

interface PgTablespaceRow {
  spcname: string;
  spclocation: string | null;
  description: string | null;
}

interface PgCollationRow {
  collname: string;
  collprovider: string;
  collcollate: string | null;
  description: string | null;
}

// ─── Helpers ───

function shouldFetch(types: TSchemaObjectType[] | undefined, ...targets: TSchemaObjectType[]): boolean {
  if (!types) return true;
  return targets.some((t) => types.includes(t));
}

function resolveTriggerTiming(tgtype: number): 'BEFORE' | 'AFTER' | 'INSTEAD OF' {
  // bit 1 = BEFORE, bit 6 = INSTEAD OF
  if (tgtype & 0x40) return 'INSTEAD OF';
  if (tgtype & 0x02) return 'BEFORE';
  return 'AFTER';
}

function resolveTriggerEvent(tgtype: number): 'INSERT' | 'UPDATE' | 'DELETE' {
  if (tgtype & 0x04) return 'INSERT';
  if (tgtype & 0x10) return 'UPDATE';
  return 'DELETE';
}

// ─── MySQL / MariaDB ───

async function fetchMysqlObjects(
  connectionId: string,
  database: string,
  objectTypes?: TSchemaObjectType[],
): Promise<Partial<ISchemaObjects>> {
  const config = connectionService.getConnectionConfig(connectionId);
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
    const result: Partial<ISchemaObjects> = {};

    // Tables
    if (shouldFetch(objectTypes, 'table')) {
      try {
        result.tables = await schemaService.fetchRealSchema(connectionId);
      } catch {
        result.tables = [];
      }
    }

    // Views
    if (shouldFetch(objectTypes, 'view')) {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`,
        [database],
      );
      result.views = (rows as MysqlViewRow[]).map((r) => ({
        name: r.TABLE_NAME,
        definition: r.VIEW_DEFINITION ?? '',
        isMaterialized: false,
        columns: [],
      }));
    }

    // Functions & Procedures
    if (shouldFetch(objectTypes, 'function', 'procedure')) {
      const [rows] = await conn.query(
        `SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION, DATA_TYPE, DTD_IDENTIFIER
         FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?`,
        [database],
      );
      const routines = rows as MysqlRoutineRow[];

      if (shouldFetch(objectTypes, 'function')) {
        result.functions = routines
          .filter((r) => r.ROUTINE_TYPE === 'FUNCTION')
          .map((r) => ({
            name: r.ROUTINE_NAME,
            type: 'function' as const,
            definition: r.ROUTINE_DEFINITION ?? '',
            returnType: r.DTD_IDENTIFIER,
            parameters: [],
          }));
      }
      if (shouldFetch(objectTypes, 'procedure')) {
        result.procedures = routines
          .filter((r) => r.ROUTINE_TYPE === 'PROCEDURE')
          .map((r) => ({
            name: r.ROUTINE_NAME,
            type: 'procedure' as const,
            definition: r.ROUTINE_DEFINITION ?? '',
            parameters: [],
          }));
      }
    }

    // Triggers
    if (shouldFetch(objectTypes, 'trigger')) {
      const [rows] = await conn.query(
        `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION, ACTION_STATEMENT
         FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`,
        [database],
      );
      result.triggers = (rows as MysqlTriggerRow[]).map((r) => ({
        name: r.TRIGGER_NAME,
        tableName: r.EVENT_OBJECT_TABLE,
        timing: r.ACTION_TIMING as ITrigger['timing'],
        event: r.EVENT_MANIPULATION as ITrigger['event'],
        definition: r.ACTION_STATEMENT,
      }));
    }

    // Events
    if (shouldFetch(objectTypes, 'event')) {
      const [rows] = await conn.query(
        `SELECT EVENT_NAME, EVENT_DEFINITION, EXECUTE_AT, EVENT_TYPE, INTERVAL_VALUE, INTERVAL_FIELD, STATUS
         FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?`,
        [database],
      );
      result.events = (rows as MysqlEventRow[]).map((r) => {
        let schedule = r.EVENT_TYPE;
        if (r.EXECUTE_AT) {
          schedule = `AT ${r.EXECUTE_AT}`;
        } else if (r.INTERVAL_VALUE && r.INTERVAL_FIELD) {
          schedule = `EVERY ${r.INTERVAL_VALUE} ${r.INTERVAL_FIELD}`;
        }
        return {
          name: r.EVENT_NAME,
          schedule,
          definition: r.EVENT_DEFINITION,
          status: r.STATUS === 'ENABLED' ? 'ENABLED' as const : 'DISABLED' as const,
        };
      });
    }

    // Indexes
    if (shouldFetch(objectTypes, 'index')) {
      const [rows] = await conn.query(
        `SELECT DISTINCT INDEX_NAME, TABLE_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND INDEX_NAME != 'PRIMARY'
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
        [database],
      );
      const indexRows = rows as MysqlIndexRow[];

      // Group by index name + table
      const indexMap = new Map<string, { tableName: string; columns: string[]; isUnique: boolean; type: string }>();
      for (const r of indexRows) {
        const key = `${r.TABLE_NAME}.${r.INDEX_NAME}`;
        if (!indexMap.has(key)) {
          indexMap.set(key, { tableName: r.TABLE_NAME, columns: [], isUnique: r.NON_UNIQUE === 0, type: r.INDEX_TYPE });
        }
        indexMap.get(key)!.columns.push(r.COLUMN_NAME);
      }

      result.indexes = Array.from(indexMap.entries()).map(([key, v]) => {
        const indexName = key.split('.')[1];
        return {
          name: indexName,
          tableName: v.tableName,
          columns: v.columns,
          isUnique: v.isUnique,
          type: v.type,
          definition: `CREATE${v.isUnique ? ' UNIQUE' : ''} INDEX \`${indexName}\` ON \`${v.tableName}\` (${v.columns.map((c) => `\`${c}\``).join(', ')})`,
        };
      });
    }

    // Partitions
    if (shouldFetch(objectTypes, 'partition')) {
      try {
        const [rows] = await conn.query(
          `SELECT TABLE_NAME, PARTITION_METHOD, PARTITION_EXPRESSION,
                  PARTITION_NAME, PARTITION_DESCRIPTION, SUBPARTITION_METHOD
           FROM information_schema.PARTITIONS
           WHERE TABLE_SCHEMA = ? AND PARTITION_NAME IS NOT NULL
           ORDER BY TABLE_NAME, PARTITION_ORDINAL_POSITION`,
          [database],
        );
        const partRows = rows as MysqlPartitionRow[];

        // Group by table
        const partMap = new Map<string, IPartition>();
        for (const r of partRows) {
          if (!partMap.has(r.TABLE_NAME)) {
            const strategy = (r.PARTITION_METHOD ?? '').toLowerCase();
            partMap.set(r.TABLE_NAME, {
              name: `${r.TABLE_NAME}_partitioning`,
              tableName: r.TABLE_NAME,
              strategy: strategy.includes('range') ? 'range' : strategy.includes('list') ? 'list' : 'hash',
              expression: r.PARTITION_EXPRESSION ?? '',
              partitions: [],
            });
          }
          const partition = partMap.get(r.TABLE_NAME)!;
          partition.partitions.push({
            name: r.PARTITION_NAME ?? '',
            bound: r.PARTITION_DESCRIPTION ?? undefined,
          });
        }
        result.partitions = Array.from(partMap.values());
      } catch {
        result.partitions = [];
      }
    }

    // Roles
    if (shouldFetch(objectTypes, 'role')) {
      try {
        const [rows] = await conn.query(
          `SELECT User, Host, account_locked FROM mysql.user
           WHERE User NOT LIKE 'mysql.%'
             AND User != 'root'
             AND User != ''
           ORDER BY User`,
        );
        result.roles = (rows as MysqlUserRow[]).map((r) => ({
          name: `'${r.User}'@'${r.Host}'`,
          isLogin: r.account_locked !== 'Y',
          isSuperuser: false,
          inherits: true,
          memberOf: [],
        }));
      } catch {
        result.roles = [];
      }
    }

    // Grants
    if (shouldFetch(objectTypes, 'grant')) {
      try {
        const [rows] = await conn.query(
          `SELECT GRANTEE, TABLE_SCHEMA, TABLE_NAME, PRIVILEGE_TYPE, IS_GRANTABLE
           FROM information_schema.TABLE_PRIVILEGES
           WHERE TABLE_SCHEMA = ?
           ORDER BY GRANTEE, TABLE_NAME`,
          [database],
        );
        const grantRows = rows as MysqlTablePrivilegeRow[];

        // Group by grantee + object
        const grantMap = new Map<string, IGrant>();
        for (const r of grantRows) {
          const key = `${r.GRANTEE}::${r.TABLE_NAME}`;
          if (!grantMap.has(key)) {
            grantMap.set(key, {
              objectType: 'table',
              objectName: r.TABLE_NAME,
              grantee: r.GRANTEE,
              privileges: [],
              withGrantOption: false,
            });
          }
          const grant = grantMap.get(key)!;
          grant.privileges.push(r.PRIVILEGE_TYPE);
          if (r.IS_GRANTABLE === 'YES') grant.withGrantOption = true;
        }
        result.grants = Array.from(grantMap.values());
      } catch {
        result.grants = [];
      }
    }

    // Collations
    if (shouldFetch(objectTypes, 'collation')) {
      try {
        const [rows] = await conn.query(
          `SELECT COLLATION_NAME, CHARACTER_SET_NAME, IS_DEFAULT
           FROM information_schema.COLLATIONS
           WHERE IS_DEFAULT = 'No'
           ORDER BY CHARACTER_SET_NAME, COLLATION_NAME
           LIMIT 100`,
        );
        result.collations = (rows as MysqlCollationRow[]).map((r) => ({
          name: r.COLLATION_NAME,
          provider: 'libc' as const,
          locale: r.CHARACTER_SET_NAME,
        }));
      } catch {
        result.collations = [];
      }
    }

    return result;
  } finally {
    await closeMysqlConnection(conn);
  }
}

async function fetchMysqlObjectDdl(
  connectionId: string,
  objectType: TSchemaObjectType,
  objectName: string,
): Promise<string> {
  const config = connectionService.getConnectionConfig(connectionId);
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
    let ddl = '';

    switch (objectType) {
      case 'view': {
        const [rows] = await conn.query(`SHOW CREATE VIEW \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        ddl = row?.['Create View'] ?? '';
        break;
      }
      case 'function': {
        const [rows] = await conn.query(`SHOW CREATE FUNCTION \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        ddl = row?.['Create Function'] ?? '';
        break;
      }
      case 'procedure': {
        const [rows] = await conn.query(`SHOW CREATE PROCEDURE \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        ddl = row?.['Create Procedure'] ?? '';
        break;
      }
      case 'trigger': {
        const [rows] = await conn.query(`SHOW CREATE TRIGGER \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        ddl = row?.['SQL Original Statement'] ?? '';
        break;
      }
      case 'event': {
        const [rows] = await conn.query(`SHOW CREATE EVENT \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        ddl = row?.['Create Event'] ?? '';
        break;
      }
      case 'table': {
        const [rows] = await conn.query(`SHOW CREATE TABLE \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        ddl = row?.['Create Table'] ?? '';
        break;
      }
      case 'partition': {
        // Partition DDL is part of CREATE TABLE; extract partition info
        const [rows] = await conn.query(`SHOW CREATE TABLE \`${objectName}\``);
        const row = (rows as Array<Record<string, string>>)[0];
        const createTable = row?.['Create Table'] ?? '';
        const partMatch = /\/\*!.*PARTITION BY[\s\S]+$/i.exec(createTable);
        ddl = partMatch ? partMatch[0] : createTable;
        break;
      }
      case 'collation': {
        ddl = `-- Collation: ${objectName}\n-- Collations are built-in and cannot be created via DDL in MySQL`;
        break;
      }
      default:
        throw new Error(`DDL not supported for object type: ${objectType}`);
    }

    return ddl;
  } finally {
    await closeMysqlConnection(conn);
  }
}

// ─── PostgreSQL ───

async function fetchPgObjects(
  connectionId: string,
  objectTypes?: TSchemaObjectType[],
): Promise<Partial<ISchemaObjects>> {
  const config = connectionService.getConnectionConfig(connectionId);
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
    const result: Partial<ISchemaObjects> = {};

    // Tables — reuse schemaService which already parses columns, keys, constraints
    if (shouldFetch(objectTypes, 'table')) {
      try {
        result.tables = await schemaService.fetchRealSchema(connectionId);
      } catch {
        result.tables = [];
      }
    }

    // Views
    if (shouldFetch(objectTypes, 'view', 'materialized_view')) {
      const views: ISchemaView[] = [];

      if (shouldFetch(objectTypes, 'view')) {
        const viewResult = await client.query<PgViewRow>(
          `SELECT viewname, definition FROM pg_views WHERE schemaname = 'public'`,
        );
        for (const r of viewResult.rows) {
          views.push({
            name: r.viewname,
            definition: r.definition ?? '',
            isMaterialized: false,
            columns: [],
          });
        }
      }

      if (shouldFetch(objectTypes, 'materialized_view')) {
        const matResult = await client.query<PgMatViewRow>(
          `SELECT matviewname, definition FROM pg_matviews WHERE schemaname = 'public'`,
        );
        for (const r of matResult.rows) {
          views.push({
            name: r.matviewname,
            definition: r.definition ?? '',
            isMaterialized: true,
            columns: [],
          });
        }
      }

      result.views = views;
    }

    // Functions & Procedures
    if (shouldFetch(objectTypes, 'function', 'procedure')) {
      const funcResult = await client.query<PgFunctionRow>(
        `SELECT p.proname,
                pg_get_functiondef(p.oid) AS funcdef,
                p.prokind,
                l.lanname,
                pg_catalog.format_type(p.prorettype, NULL) AS return_type,
                p.proargnames AS param_names,
                pg_get_function_arguments(p.oid) AS param_types,
                p.proargmodes AS param_modes,
                p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS func_identity
         FROM pg_proc p
         JOIN pg_namespace n ON p.pronamespace = n.oid
         JOIN pg_language l ON p.prolang = l.oid
         WHERE n.nspname = 'public'
           AND p.prokind IN ('f', 'p')`,
      );

      const functions: IRoutine[] = [];
      const procedures: IRoutine[] = [];

      for (const r of funcResult.rows) {
        // Parse parameters from pg_get_function_arguments
        const parameters: IRoutine['parameters'] = [];
        if (r.param_types) {
          const paramParts = r.param_types.split(',').map((s) => s.trim()).filter(Boolean);
          for (const part of paramParts) {
            // Format: [mode] [name] type  e.g. "IN key text", "text", "OUT result text"
            const tokens = part.split(/\s+/);
            let mode: 'IN' | 'OUT' | 'INOUT' = 'IN';
            let name = '';
            let dataType = part;

            if (tokens[0] === 'IN' || tokens[0] === 'OUT' || tokens[0] === 'INOUT') {
              mode = tokens[0] as 'IN' | 'OUT' | 'INOUT';
              if (tokens.length >= 3) {
                name = tokens[1];
                dataType = tokens.slice(2).join(' ');
              } else {
                dataType = tokens.slice(1).join(' ');
              }
            } else if (tokens.length >= 2) {
              // name type (no explicit mode)
              name = tokens[0];
              dataType = tokens.slice(1).join(' ');
            }

            parameters.push({ name, dataType, mode });
          }
        }

        const routine: IRoutine = {
          name: r.func_identity,
          type: r.prokind === 'p' ? 'procedure' : 'function',
          definition: r.funcdef ?? '',
          language: r.lanname,
          returnType: r.return_type,
          parameters,
        };

        if (routine.type === 'function' && shouldFetch(objectTypes, 'function')) {
          functions.push(routine);
        } else if (routine.type === 'procedure' && shouldFetch(objectTypes, 'procedure')) {
          procedures.push(routine);
        }
      }

      if (shouldFetch(objectTypes, 'function')) result.functions = functions;
      if (shouldFetch(objectTypes, 'procedure')) result.procedures = procedures;
    }

    // Triggers
    if (shouldFetch(objectTypes, 'trigger')) {
      const trigResult = await client.query<PgTriggerRow>(
        `SELECT t.tgname, c.relname, t.tgtype,
                pg_get_triggerdef(t.oid) AS tgdef
         FROM pg_trigger t
         JOIN pg_class c ON t.tgrelid = c.oid
         JOIN pg_namespace n ON c.relnamespace = n.oid
         WHERE n.nspname = 'public'
           AND NOT t.tgisinternal`,
      );
      result.triggers = trigResult.rows.map((r) => ({
        name: r.tgname,
        tableName: r.relname,
        timing: resolveTriggerTiming(r.tgtype),
        event: resolveTriggerEvent(r.tgtype),
        definition: r.tgdef ?? '',
      }));
    }

    // Types (enum / composite / domain)
    if (shouldFetch(objectTypes, 'type', 'domain')) {
      const typeResult = await client.query<PgTypeRow>(
        `SELECT t.typname,
                t.typtype,
                (SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
                 FROM pg_enum e WHERE e.enumtypid = t.oid) AS enum_values,
                (SELECT string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',' ORDER BY a.attnum)
                 FROM pg_attribute a WHERE a.attrelid = t.typrelid AND a.attnum > 0 AND NOT a.attisdropped) AS attributes
         FROM pg_type t
         JOIN pg_namespace n ON t.typnamespace = n.oid
         WHERE n.nspname = 'public'
           AND t.typtype IN ('e', 'c', 'd')`,
      );
      const types: ICustomType[] = [];
      for (const r of typeResult.rows) {
        const customType: ICustomType = {
          name: r.typname,
          type: r.typtype === 'e' ? 'enum' : r.typtype === 'd' ? 'domain' : 'composite',
          definition: '',
        };

        if (r.typtype === 'e' && r.enum_values) {
          customType.values = r.enum_values.split(',');
          customType.definition = `CREATE TYPE ${r.typname} AS ENUM (${customType.values.map((v) => `'${v}'`).join(', ')})`;
        }

        if (r.typtype === 'c' && r.attributes) {
          customType.attributes = r.attributes.split(',').map((a) => {
            const [name, dataType] = a.split(':');
            return { name: name.trim(), dataType: dataType?.trim() ?? '' };
          });
          const attrDefs = customType.attributes.map((a) => `${a.name} ${a.dataType}`).join(', ');
          customType.definition = `CREATE TYPE ${r.typname} AS (${attrDefs})`;
        }

        if (r.typtype === 'd') {
          customType.definition = `-- Domain type: ${r.typname}`;
        }

        types.push(customType);
      }
      if (shouldFetch(objectTypes, 'type')) {
        result.types = types.filter((t) => t.type !== 'domain');
      }
      if (shouldFetch(objectTypes, 'domain')) {
        // Store domains in types array — ObjectTree filters by type='domain'
        result.types = [...(result.types ?? []), ...types.filter((t) => t.type === 'domain')];
      }
    }

    // Sequences
    if (shouldFetch(objectTypes, 'sequence')) {
      const seqResult = await client.query<PgSequenceRow>(
        `SELECT sequencename, data_type, start_value, increment_by, min_value, max_value, cycle
         FROM pg_sequences WHERE schemaname = 'public'`,
      );
      result.sequences = seqResult.rows.map((r) => ({
        name: r.sequencename,
        dataType: r.data_type,
        startValue: Number(r.start_value),
        increment: Number(r.increment_by),
        minValue: r.min_value ? Number(r.min_value) : undefined,
        maxValue: r.max_value ? Number(r.max_value) : undefined,
        isCyclic: r.cycle,
      }));
    }

    // Indexes
    if (shouldFetch(objectTypes, 'index')) {
      const idxResult = await client.query<PgIndexRow>(
        `SELECT indexname, tablename, indexdef
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname NOT IN (
             SELECT conname FROM pg_constraint WHERE contype = 'p'
           )`,
      );
      result.indexes = idxResult.rows.map((r) => {
        const isUnique = /CREATE\s+UNIQUE/i.test(r.indexdef);
        // Extract columns from indexdef: ... ON tablename (col1, col2)
        const colMatch = /\(([^)]+)\)\s*$/.exec(r.indexdef);
        const columns = colMatch
          ? colMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''))
          : [];

        return {
          name: r.indexname,
          tableName: r.tablename,
          columns,
          isUnique,
          definition: r.indexdef,
        };
      });
    }

    // Partitions
    if (shouldFetch(objectTypes, 'partition')) {
      try {
        const partResult = await client.query<PgPartitionRow>(
          `SELECT
             parent.relname AS parent_table,
             child.relname AS partition_name,
             CASE pt.partstrat
               WHEN 'r' THEN 'range'
               WHEN 'l' THEN 'list'
               WHEN 'h' THEN 'hash'
             END AS partition_strategy,
             pg_get_partkeydef(parent.oid) AS partition_expression,
             pg_get_expr(child.relpartbound, child.oid) AS partition_bound
           FROM pg_partitioned_table pt
           JOIN pg_class parent ON pt.partrelid = parent.oid
           JOIN pg_namespace pn ON parent.relnamespace = pn.oid
           JOIN pg_inherits inh ON parent.oid = inh.inhparent
           JOIN pg_class child ON inh.inhrelid = child.oid
           WHERE pn.nspname = 'public'
           ORDER BY parent.relname, child.relname`,
        );

        // Group by parent table
        const partMap = new Map<string, IPartition>();
        for (const r of partResult.rows) {
          if (!partMap.has(r.parent_table)) {
            partMap.set(r.parent_table, {
              name: `${r.parent_table}_partitioning`,
              tableName: r.parent_table,
              strategy: r.partition_strategy as IPartition['strategy'],
              expression: r.partition_expression ?? '',
              partitions: [],
            });
          }
          const partition = partMap.get(r.parent_table)!;
          partition.partitions.push({
            name: r.partition_name,
            bound: r.partition_bound ?? undefined,
          });
        }
        result.partitions = Array.from(partMap.values());
      } catch {
        result.partitions = [];
      }
    }

    // Roles
    if (shouldFetch(objectTypes, 'role')) {
      try {
        const roleResult = await client.query<PgRoleRow>(
          `SELECT r.rolname,
                  r.rolcanlogin,
                  r.rolsuper,
                  r.rolinherit,
                  string_agg(m.rolname, ',') AS memberof
           FROM pg_roles r
           LEFT JOIN pg_auth_members am ON r.oid = am.member
           LEFT JOIN pg_roles m ON am.roleid = m.oid
           WHERE r.rolname NOT LIKE 'pg_%'
             AND r.rolname != 'postgres'
           GROUP BY r.rolname, r.rolcanlogin, r.rolsuper, r.rolinherit
           ORDER BY r.rolname`,
        );
        result.roles = roleResult.rows.map((r) => ({
          name: r.rolname,
          isLogin: r.rolcanlogin,
          isSuperuser: r.rolsuper,
          inherits: r.rolinherit,
          memberOf: r.memberof ? r.memberof.split(',') : [],
        }));
      } catch {
        result.roles = [];
      }
    }

    // RLS Policies
    if (shouldFetch(objectTypes, 'policy')) {
      try {
        const polResult = await client.query<PgPolicyRow>(
          `SELECT pol.polname AS policyname,
                  c.relname AS tablename,
                  CASE pol.polcmd
                    WHEN 'r' THEN 'SELECT'
                    WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE'
                    WHEN 'd' THEN 'DELETE'
                    ELSE 'ALL'
                  END AS cmd,
                  pg_get_expr(pol.polqual, pol.polrelid) AS qual,
                  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
                  array_to_string(ARRAY(
                    SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)
                  ), ',') AS roles
           FROM pg_policy pol
           JOIN pg_class c ON pol.polrelid = c.oid
           JOIN pg_namespace n ON c.relnamespace = n.oid
           WHERE n.nspname = 'public'
           ORDER BY c.relname, pol.polname`,
        );
        result.policies = polResult.rows.map((r) => ({
          name: r.policyname,
          tableName: r.tablename,
          command: r.cmd as IRlsPolicy['command'],
          roles: r.roles ? r.roles.split(',') : [],
          using: r.qual ?? undefined,
          withCheck: r.with_check ?? undefined,
        }));
      } catch {
        result.policies = [];
      }
    }

    // Grants
    if (shouldFetch(objectTypes, 'grant')) {
      try {
        const grantResult = await client.query<PgGrantRow>(
          `SELECT grantee, table_schema, table_name, privilege_type, is_grantable
           FROM information_schema.table_privileges
           WHERE table_schema = 'public'
           ORDER BY grantee, table_name`,
        );

        // Group by grantee + object
        const grantMap = new Map<string, IGrant>();
        for (const r of grantResult.rows) {
          const key = `${r.grantee}::${r.table_name}`;
          if (!grantMap.has(key)) {
            grantMap.set(key, {
              objectType: 'table',
              objectName: r.table_name,
              grantee: r.grantee,
              privileges: [],
              withGrantOption: false,
            });
          }
          const grant = grantMap.get(key)!;
          grant.privileges.push(r.privilege_type);
          if (r.is_grantable === 'YES') grant.withGrantOption = true;
        }
        result.grants = Array.from(grantMap.values());
      } catch {
        result.grants = [];
      }
    }

    // Extensions
    if (shouldFetch(objectTypes, 'extension')) {
      try {
        const extResult = await client.query<PgExtensionRow>(
          `SELECT e.extname,
                  e.extversion,
                  n.nspname,
                  d.description
           FROM pg_extension e
           JOIN pg_namespace n ON e.extnamespace = n.oid
           LEFT JOIN pg_description d ON d.objoid = e.oid AND d.classoid = 'pg_extension'::regclass
           WHERE e.extname != 'plpgsql'
           ORDER BY e.extname`,
        );
        result.extensions = extResult.rows.map((r) => ({
          name: r.extname,
          version: r.extversion,
          schema: r.nspname,
          comment: r.description ?? undefined,
        }));
      } catch {
        result.extensions = [];
      }
    }

    // Schemas (namespaces)
    if (shouldFetch(objectTypes, 'schema')) {
      try {
        const schemaResult = await client.query<PgSchemaRow>(
          `SELECT n.nspname,
                  r.rolname AS nspowner,
                  d.description
           FROM pg_namespace n
           JOIN pg_roles r ON n.nspowner = r.oid
           LEFT JOIN pg_description d ON d.objoid = n.oid AND d.classoid = 'pg_namespace'::regclass
           WHERE n.nspname NOT LIKE 'pg_%'
             AND n.nspname != 'information_schema'
           ORDER BY n.nspname`,
        );
        result.schemas = schemaResult.rows.map((r) => ({
          name: r.nspname,
          owner: r.nspowner,
          comment: r.description ?? undefined,
        }));
      } catch {
        result.schemas = [];
      }
    }

    // Foreign Tables
    if (shouldFetch(objectTypes, 'foreign_table')) {
      try {
        const ftResult = await client.query<PgForeignTableRow>(
          `SELECT foreign_table_name, foreign_server_name, foreign_table_schema
           FROM information_schema.foreign_tables
           WHERE foreign_table_schema = 'public'
           ORDER BY foreign_table_name`,
        );
        result.foreignTables = ftResult.rows.map((r) => ({
          name: r.foreign_table_name,
          serverName: r.foreign_server_name,
          columns: [],
          options: {},
        }));
      } catch {
        result.foreignTables = [];
      }
    }

    // Tablespaces
    if (shouldFetch(objectTypes, 'tablespace')) {
      try {
        const tsResult = await client.query<PgTablespaceRow>(
          `SELECT s.spcname,
                  pg_tablespace_location(s.oid) AS spclocation,
                  d.description
           FROM pg_tablespace s
           LEFT JOIN pg_description d ON d.objoid = s.oid AND d.classoid = 'pg_tablespace'::regclass
           WHERE s.spcname NOT IN ('pg_default', 'pg_global')
           ORDER BY s.spcname`,
        );
        result.tablespaces = tsResult.rows.map((r) => ({
          name: r.spcname,
          location: r.spclocation ?? undefined,
          comment: r.description ?? undefined,
        }));
      } catch {
        result.tablespaces = [];
      }
    }

    // Collations
    if (shouldFetch(objectTypes, 'collation')) {
      try {
        const collResult = await client.query<PgCollationRow>(
          `SELECT c.collname,
                  CASE c.collprovider
                    WHEN 'i' THEN 'icu'
                    WHEN 'c' THEN 'libc'
                    ELSE 'libc'
                  END AS collprovider,
                  c.collcollate,
                  d.description
           FROM pg_collation c
           JOIN pg_namespace n ON c.collnamespace = n.oid
           LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_collation'::regclass
           WHERE n.nspname = 'public'
           ORDER BY c.collname`,
        );
        result.collations = collResult.rows.map((r) => ({
          name: r.collname,
          provider: r.collprovider as ICollationDef['provider'],
          locale: r.collcollate ?? undefined,
          comment: r.description ?? undefined,
        }));
      } catch {
        result.collations = [];
      }
    }

    return result;
  } finally {
    await closePgConnection(client);
  }
}

async function fetchPgObjectDdl(
  connectionId: string,
  objectType: TSchemaObjectType,
  objectName: string,
): Promise<string> {
  const config = connectionService.getConnectionConfig(connectionId);
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
    let ddl = '';

    switch (objectType) {
      case 'view': {
        const result = await client.query(
          `SELECT pg_get_viewdef(c.oid, true) AS def
           FROM pg_class c
           JOIN pg_namespace n ON c.relnamespace = n.oid
           WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'v'`,
          [objectName],
        );
        const def = result.rows[0]?.def ?? '';
        ddl = `CREATE OR REPLACE VIEW "${objectName}" AS\n${def}`;
        break;
      }
      case 'materialized_view': {
        const result = await client.query(
          `SELECT definition FROM pg_matviews WHERE schemaname = 'public' AND matviewname = $1`,
          [objectName],
        );
        ddl = `CREATE MATERIALIZED VIEW "${objectName}" AS\n${result.rows[0]?.definition ?? ''}`;
        break;
      }
      case 'function':
      case 'procedure': {
        // objectName may be identity format: "funcname(arg_types)" or plain "funcname"
        const result = await client.query(
          `SELECT pg_get_functiondef(p.oid) AS def
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           WHERE n.nspname = 'public'
             AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = $1
           LIMIT 1`,
          [objectName],
        );
        if (result.rows[0]?.def) {
          ddl = result.rows[0].def;
        } else {
          // Fallback: match by plain name (for backward compat)
          const fallback = await client.query(
            `SELECT pg_get_functiondef(p.oid) AS def
             FROM pg_proc p
             JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = $1
             LIMIT 1`,
            [objectName],
          );
          ddl = fallback.rows[0]?.def ?? '';
        }
        break;
      }
      case 'trigger': {
        const result = await client.query(
          `SELECT pg_get_triggerdef(t.oid) AS def
           FROM pg_trigger t
           JOIN pg_class c ON t.tgrelid = c.oid
           JOIN pg_namespace n ON c.relnamespace = n.oid
           WHERE n.nspname = 'public' AND t.tgname = $1
           LIMIT 1`,
          [objectName],
        );
        ddl = result.rows[0]?.def ?? '';
        break;
      }
      case 'sequence': {
        const result = await client.query(
          `SELECT sequencename, data_type, start_value, increment_by, min_value, max_value, cycle
           FROM pg_sequences WHERE schemaname = 'public' AND sequencename = $1`,
          [objectName],
        );
        const r = result.rows[0];
        if (r) {
          ddl = `CREATE SEQUENCE "${objectName}" AS ${r.data_type} START WITH ${r.start_value} INCREMENT BY ${r.increment_by}`;
          if (r.min_value) ddl += ` MINVALUE ${r.min_value}`;
          if (r.max_value) ddl += ` MAXVALUE ${r.max_value}`;
          if (r.cycle) ddl += ` CYCLE`;
        }
        break;
      }
      case 'type': {
        // Check if enum or composite
        const typeResult = await client.query(
          `SELECT typtype FROM pg_type t
           JOIN pg_namespace n ON t.typnamespace = n.oid
           WHERE n.nspname = 'public' AND t.typname = $1`,
          [objectName],
        );
        const typtype = typeResult.rows[0]?.typtype;
        if (typtype === 'e') {
          const enumResult = await client.query(
            `SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS vals
             FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             JOIN pg_namespace n ON t.typnamespace = n.oid
             WHERE n.nspname = 'public' AND t.typname = $1`,
            [objectName],
          );
          ddl = `CREATE TYPE "${objectName}" AS ENUM (${(enumResult.rows[0]?.vals ?? '').split(', ').map((v: string) => `'${v}'`).join(', ')})`;
        } else {
          const attrResult = await client.query(
            `SELECT a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod) AS datatype
             FROM pg_attribute a
             JOIN pg_type t ON a.attrelid = t.typrelid
             JOIN pg_namespace n ON t.typnamespace = n.oid
             WHERE n.nspname = 'public' AND t.typname = $1 AND a.attnum > 0 AND NOT a.attisdropped
             ORDER BY a.attnum`,
            [objectName],
          );
          const attrs = attrResult.rows.map((a: { attname: string; datatype: string }) => `${a.attname} ${a.datatype}`).join(', ');
          ddl = `CREATE TYPE "${objectName}" AS (${attrs})`;
        }
        break;
      }
      case 'partition': {
        const partResult = await client.query(
          `SELECT pg_get_partkeydef(c.oid) AS partkey
           FROM pg_class c
           JOIN pg_namespace n ON c.relnamespace = n.oid
           WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'p'`,
          [objectName],
        );
        const partKey = partResult.rows[0]?.partkey ?? '';
        ddl = `-- Table "${objectName}" is partitioned by: ${partKey}`;
        break;
      }
      case 'role': {
        const roleResult = await client.query(
          `SELECT rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolinherit, rolreplication
           FROM pg_roles WHERE rolname = $1`,
          [objectName],
        );
        const role = roleResult.rows[0];
        if (role) {
          const opts: string[] = [];
          if (role.rolcanlogin) opts.push('LOGIN');
          if (role.rolsuper) opts.push('SUPERUSER');
          if (role.rolcreaterole) opts.push('CREATEROLE');
          if (role.rolcreatedb) opts.push('CREATEDB');
          if (role.rolinherit) opts.push('INHERIT');
          if (role.rolreplication) opts.push('REPLICATION');
          ddl = `CREATE ROLE "${objectName}" WITH ${opts.join(' ')}`;
        }
        break;
      }
      case 'policy': {
        const polResult = await client.query(
          `SELECT pol.polname,
                  c.relname,
                  CASE pol.polcmd
                    WHEN 'r' THEN 'SELECT'
                    WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE'
                    WHEN 'd' THEN 'DELETE'
                    ELSE 'ALL'
                  END AS cmd,
                  pg_get_expr(pol.polqual, pol.polrelid) AS qual,
                  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
           FROM pg_policy pol
           JOIN pg_class c ON pol.polrelid = c.oid
           JOIN pg_namespace n ON c.relnamespace = n.oid
           WHERE n.nspname = 'public' AND pol.polname = $1
           LIMIT 1`,
          [objectName],
        );
        const pol = polResult.rows[0];
        if (pol) {
          ddl = `CREATE POLICY "${pol.polname}" ON "${pol.relname}" FOR ${pol.cmd}`;
          if (pol.qual) ddl += `\n  USING (${pol.qual})`;
          if (pol.with_check) ddl += `\n  WITH CHECK (${pol.with_check})`;
        }
        break;
      }
      case 'grant': {
        ddl = `-- Grant definitions are runtime privileges and not stored as DDL objects.\n-- Use: SELECT * FROM information_schema.table_privileges WHERE grantee = '${objectName}'`;
        break;
      }
      case 'extension': {
        const extResult = await client.query(
          `SELECT extname, extversion FROM pg_extension WHERE extname = $1`,
          [objectName],
        );
        const ext = extResult.rows[0];
        if (ext) {
          ddl = `CREATE EXTENSION IF NOT EXISTS "${ext.extname}" VERSION '${ext.extversion}'`;
        }
        break;
      }
      case 'schema': {
        const schResult = await client.query(
          `SELECT n.nspname, r.rolname AS owner
           FROM pg_namespace n
           JOIN pg_roles r ON n.nspowner = r.oid
           WHERE n.nspname = $1`,
          [objectName],
        );
        const sch = schResult.rows[0];
        if (sch) {
          ddl = `CREATE SCHEMA "${sch.nspname}" AUTHORIZATION "${sch.owner}"`;
        }
        break;
      }
      case 'foreign_table': {
        const ftResult = await client.query(
          `SELECT foreign_table_name, foreign_server_name
           FROM information_schema.foreign_tables
           WHERE foreign_table_schema = 'public' AND foreign_table_name = $1`,
          [objectName],
        );
        const ft = ftResult.rows[0];
        if (ft) {
          ddl = `-- Foreign table "${ft.foreign_table_name}" on server "${ft.foreign_server_name}"`;
        }
        break;
      }
      case 'tablespace': {
        const tsResult = await client.query(
          `SELECT spcname, pg_tablespace_location(oid) AS location
           FROM pg_tablespace WHERE spcname = $1`,
          [objectName],
        );
        const ts = tsResult.rows[0];
        if (ts) {
          ddl = `CREATE TABLESPACE "${ts.spcname}" LOCATION '${ts.location ?? ''}'`;
        }
        break;
      }
      case 'collation': {
        const collResult = await client.query(
          `SELECT collname, collcollate, collctype,
                  CASE collprovider WHEN 'i' THEN 'icu' WHEN 'c' THEN 'libc' ELSE 'libc' END AS provider
           FROM pg_collation c
           JOIN pg_namespace n ON c.collnamespace = n.oid
           WHERE n.nspname = 'public' AND c.collname = $1`,
          [objectName],
        );
        const coll = collResult.rows[0];
        if (coll) {
          ddl = `CREATE COLLATION "${coll.collname}" (provider = ${coll.provider}, locale = '${coll.collcollate ?? ''}')`;
        }
        break;
      }
      default:
        throw new Error(`DDL not supported for object type: ${objectType}`);
    }

    return ddl;
  } finally {
    await closePgConnection(client);
  }
}

// ─── SQLite ───

interface SqliteViewRow {
  name: string;
  sql: string;
}

interface SqliteTriggerRow {
  name: string;
  tbl_name: string;
  sql: string;
}

async function fetchSqliteObjects(
  connectionId: string,
  objectTypes?: TSchemaObjectType[],
): Promise<Partial<ISchemaObjects>> {
  const config = connectionService.getConnectionConfig(connectionId);
  const db = createSqliteConnection({ database: config.database });

  try {
    const result: Partial<ISchemaObjects> = {};

    // Tables
    if (shouldFetch(objectTypes, 'table')) {
      try {
        result.tables = await schemaService.fetchRealSchema(connectionId);
      } catch {
        result.tables = [];
      }
    }

    // Views
    if (shouldFetch(objectTypes, 'view')) {
      const views = db.prepare(
        `SELECT name, sql FROM sqlite_master WHERE type = 'view' ORDER BY name`,
      ).all() as SqliteViewRow[];
      result.views = views.map((v) => ({
        name: v.name,
        definition: v.sql ?? '',
        isMaterialized: false,
        columns: [],
      }));
    }

    // Triggers
    if (shouldFetch(objectTypes, 'trigger')) {
      const triggers = db.prepare(
        `SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name`,
      ).all() as SqliteTriggerRow[];
      result.triggers = triggers.map((t) => {
        // Parse timing and event from SQL
        const upper = (t.sql ?? '').toUpperCase();
        let timing: ITrigger['timing'] = 'BEFORE';
        let event: ITrigger['event'] = 'INSERT';
        if (upper.includes('AFTER')) timing = 'AFTER';
        if (upper.includes('INSTEAD OF')) timing = 'INSTEAD OF';
        if (upper.includes('UPDATE')) event = 'UPDATE';
        if (upper.includes('DELETE')) event = 'DELETE';

        return {
          name: t.name,
          tableName: t.tbl_name,
          timing,
          event,
          definition: t.sql ?? '',
        };
      });
    }

    // Indexes (for table sub-categories)
    if (shouldFetch(objectTypes, 'index')) {
      const indexes = db.prepare(
        `SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name`,
      ).all() as { name: string; tbl_name: string; sql: string }[];
      result.indexes = indexes.map((idx) => {
        const isUnique = /CREATE\s+UNIQUE/i.test(idx.sql ?? '');
        const colMatch = /\(([^)]+)\)\s*$/.exec(idx.sql ?? '');
        const columns = colMatch
          ? colMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''))
          : [];

        return {
          name: idx.name,
          tableName: idx.tbl_name,
          columns,
          isUnique,
          definition: idx.sql ?? '',
        };
      });
    }

    return result;
  } finally {
    closeSqliteConnection(db);
  }
}

function fetchSqliteObjectDdl(
  connectionId: string,
  objectType: TSchemaObjectType,
  objectName: string,
): string {
  const config = connectionService.getConnectionConfig(connectionId);
  const db = createSqliteConnection({ database: config.database });

  try {
    const row = db.prepare(
      `SELECT sql FROM sqlite_master WHERE name = ?`,
    ).get(objectName) as { sql: string } | undefined;

    return row?.sql ?? '';
  } finally {
    closeSqliteConnection(db);
  }
}

// ─── Exported Service ───

export const schemaObjectsService = {
  async fetchObjects(connectionId: string, objectTypes?: TSchemaObjectType[]): Promise<Partial<ISchemaObjects>> {
    const config = connectionService.getConnectionConfig(connectionId);
    const dbType: TDbType = config.dbType;

    // If no specific types requested, use all supported by dialect
    const types = objectTypes ?? DIALECT_INFO[dbType]?.supportedObjects;

    if (dbType === 'mysql' || dbType === 'mariadb') {
      return fetchMysqlObjects(connectionId, config.database, types);
    }
    if (dbType === 'postgresql') {
      return fetchPgObjects(connectionId, types);
    }
    if (dbType === 'sqlite') {
      return fetchSqliteObjects(connectionId, types);
    }
    throw new Error(`Unsupported database type: ${dbType}`);
  },

  async fetchObjectDdl(connectionId: string, objectType: TSchemaObjectType, objectName: string): Promise<string> {
    const config = connectionService.getConnectionConfig(connectionId);
    const dbType: TDbType = config.dbType;

    if (dbType === 'mysql' || dbType === 'mariadb') {
      return fetchMysqlObjectDdl(connectionId, objectType, objectName);
    }
    if (dbType === 'postgresql') {
      return fetchPgObjectDdl(connectionId, objectType, objectName);
    }
    if (dbType === 'sqlite') {
      return fetchSqliteObjectDdl(connectionId, objectType, objectName);
    }
    throw new Error(`Unsupported database type: ${dbType}`);
  },

  async fetchTableStatistics(connectionId: string, tableName: string): Promise<ITableStatistics> {
    const config = connectionService.getConnectionConfig(connectionId);
    const dbType: TDbType = config.dbType;

    if (dbType === 'postgresql') {
      const client = await createPgConnection(config);
      try {
        const result = await client.query<{
          row_estimate: string;
          total_size: string;
          data_size: string;
          index_size: string;
          dead_tuples: string;
          last_analyzed: string | null;
        }>(
          `SELECT
            c.reltuples::bigint AS row_estimate,
            pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
            pg_size_pretty(pg_relation_size(c.oid)) AS data_size,
            pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
            COALESCE(s.n_dead_tup, 0)::bigint AS dead_tuples,
            s.last_analyze::text AS last_analyzed
          FROM pg_class c
          LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
          WHERE c.relname = $1 AND c.relkind IN ('r', 'm')
          LIMIT 1`,
          [tableName],
        );
        const row = result.rows[0];
        if (!row) throw new Error(`Table "${tableName}" not found`);
        return {
          rowCountEstimate: parseInt(row.row_estimate, 10),
          totalSize: row.total_size,
          dataSize: row.data_size,
          indexSize: row.index_size,
          deadTuples: parseInt(row.dead_tuples, 10),
          lastAnalyzed: row.last_analyzed ?? undefined,
        };
      } finally {
        await closePgConnection(client);
      }
    }

    if (dbType === 'mysql' || dbType === 'mariadb') {
      const conn = await createMysqlConnection(config);
      try {
        const [rows] = await conn.query<any[]>(
          `SELECT TABLE_ROWS AS row_estimate,
                  CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') AS total_size,
                  CONCAT(ROUND(DATA_LENGTH / 1024 / 1024, 2), ' MB') AS data_size,
                  CONCAT(ROUND(INDEX_LENGTH / 1024 / 1024, 2), ' MB') AS index_size
           FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [config.database, tableName],
        );
        const row = (rows as any[])[0];
        if (!row) throw new Error(`Table "${tableName}" not found`);
        return {
          rowCountEstimate: row.row_estimate ?? 0,
          totalSize: row.total_size ?? '0 MB',
          dataSize: row.data_size ?? '0 MB',
          indexSize: row.index_size ?? '0 MB',
        };
      } finally {
        await closeMysqlConnection(conn);
      }
    }

    throw new Error(`Statistics not supported for ${dbType}`);
  },

  async fetchSqlitePragma(connectionId: string, tableName: string): Promise<ISqlitePragmaResult> {
    const config = connectionService.getConnectionConfig(connectionId);
    if (config.dbType !== 'sqlite') throw new Error('PRAGMA only available for SQLite');

    const db = createSqliteConnection({ database: config.database });
    try {
      const tableInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as ISqlitePragmaResult['tableInfo'];
      const foreignKeyList = db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as ISqlitePragmaResult['foreignKeyList'];
      const indexList = db.prepare(`PRAGMA index_list("${tableName}")`).all() as ISqlitePragmaResult['indexList'];
      return { tableInfo, foreignKeyList, indexList };
    } finally {
      closeSqliteConnection(db);
    }
  },

  async fetchSqliteDbInfo(connectionId: string): Promise<ISqliteDbInfo> {
    const config = connectionService.getConnectionConfig(connectionId);
    if (config.dbType !== 'sqlite') throw new Error('DB Info only available for SQLite');

    const filePath = config.database;
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(1);

    const db = createSqliteConnection({ database: filePath });
    try {
      const version = (db.prepare('SELECT sqlite_version() AS v').get() as { v: string }).v;
      const pageSize = (db.prepare('PRAGMA page_size').get() as { page_size: number }).page_size;
      const pageCount = (db.prepare('PRAGMA page_count').get() as { page_count: number }).page_count;

      return {
        filePath,
        fileSize: `${fileSizeMB} MB`,
        sqliteVersion: version,
        pageSize,
        pageCount,
      };
    } finally {
      closeSqliteConnection(db);
    }
  },
};
