import { randomUUID } from 'node:crypto';

/**
 * DDL generate/parse for the MCP server.
 *
 * generateDdl treats table.constraints as the source of truth (PK/UK/FK/CHECK/IDX)
 * so it emits composite keys, UNIQUE, CHECK and CREATE INDEX correctly, and honors
 * column.isAutoIncrement (SERIAL / AUTO_INCREMENT / AUTOINCREMENT per dialect).
 * It falls back to column-level keyTypes/reference when a table has no constraints.
 *
 * parseDdl is a faithful port of the app's schemaHandlers parser (best-effort).
 * Types (ITable / IColumn / IConstraint) mirror src/shared/types/db.ts.
 */

function quoteId(name, dbType) {
  if (dbType === 'postgresql') return `"${name}"`;
  return `\`${name}\``;
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// Postgres SERIAL family for auto-increment columns; null for other dialects.
function pgSerialType(dataType) {
  const t = String(dataType).toUpperCase();
  if (t.includes('BIGINT')) return 'BIGSERIAL';
  if (t.includes('SMALLINT')) return 'SMALLSERIAL';
  if (t.includes('INT')) return 'SERIAL';
  return 'BIGSERIAL';
}

function constraintsOf(table) {
  return Array.isArray(table.constraints) ? table.constraints : [];
}

function pkColumnsOf(table) {
  const pk = constraintsOf(table).find((c) => c.type === 'PK');
  if (pk?.columns?.length) return pk.columns;
  return table.columns.filter((c) => (c.keyTypes ?? []).includes('PK')).map((c) => c.name);
}

export function generateDdl(tables, dbType = 'postgresql') {
  const body = [];
  const trailing = []; // CREATE INDEX / COMMENT statements, emitted after all tables

  for (const table of tables) {
    const q = (n) => quoteId(n, dbType);
    const cons = constraintsOf(table);
    const pkCols = pkColumnsOf(table);
    const isMysql = dbType === 'mysql' || dbType === 'mariadb';
    const isSqlite = dbType === 'sqlite';

    // SQLite expresses auto-increment only as an inline single-column INTEGER PK.
    const sqliteInlinePk =
      isSqlite && pkCols.length === 1 && table.columns.find((c) => c.name === pkCols[0])?.isAutoIncrement;

    const lines = [];

    for (const col of table.columns) {
      const isAI = !!col.isAutoIncrement;

      if (sqliteInlinePk && col.name === pkCols[0]) {
        lines.push(`  ${q(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`);
        continue;
      }

      let type = col.dataType;
      const pgSerial = isAI && dbType === 'postgresql';
      if (pgSerial) type = pgSerialType(col.dataType);

      let def = `  ${q(col.name)} ${type}`;
      const notNull = !col.nullable || pkCols.includes(col.name);
      if (notNull && !pgSerial) def += ' NOT NULL'; // pg SERIAL implies NOT NULL
      if (col.defaultValue && !isAI) def += ` DEFAULT ${col.defaultValue}`;
      if (isAI && isMysql) def += ' AUTO_INCREMENT';
      lines.push(def);
    }

    // ── table-level constraint clauses ──
    const clauses = [];

    if (pkCols.length && !sqliteInlinePk) {
      clauses.push(`  PRIMARY KEY (${pkCols.map(q).join(', ')})`);
    }

    // UNIQUE (single + composite); fall back to column keyTypes when none defined.
    let ukGroups = cons.filter((c) => c.type === 'UK').map((c) => ({ name: c.name, columns: c.columns }));
    if (ukGroups.length === 0) {
      ukGroups = table.columns
        .filter((c) => (c.keyTypes ?? []).includes('UK'))
        .map((c) => ({ name: `uk_${table.name}_${c.name}`, columns: [c.name] }));
    }
    for (const uk of ukGroups) {
      const namePart = uk.name ? `CONSTRAINT ${q(uk.name)} ` : '';
      clauses.push(`  ${namePart}UNIQUE (${uk.columns.map(q).join(', ')})`);
    }

    // FOREIGN KEY (composite-aware); fall back to column-level references.
    const fkCons = cons.filter((c) => c.type === 'FK' && c.reference);
    if (fkCons.length) {
      for (const c of fkCons) {
        let fk = `  FOREIGN KEY (${c.columns.map(q).join(', ')}) REFERENCES ${q(c.reference.table)}(${q(c.reference.column)})`;
        if (c.reference.onDelete) fk += ` ON DELETE ${c.reference.onDelete}`;
        if (c.reference.onUpdate) fk += ` ON UPDATE ${c.reference.onUpdate}`;
        clauses.push(fk);
      }
    } else {
      for (const col of table.columns) {
        if (col.reference) {
          let fk = `  FOREIGN KEY (${q(col.name)}) REFERENCES ${q(col.reference.table)}(${q(col.reference.column)})`;
          if (col.reference.onDelete) fk += ` ON DELETE ${col.reference.onDelete}`;
          if (col.reference.onUpdate) fk += ` ON UPDATE ${col.reference.onUpdate}`;
          clauses.push(fk);
        }
      }
    }

    // CHECK
    for (const c of cons.filter((x) => x.type === 'CHECK' && x.checkExpression)) {
      const namePart = c.name ? `CONSTRAINT ${q(c.name)} ` : '';
      clauses.push(`  ${namePart}CHECK (${c.checkExpression})`);
    }

    body.push(`CREATE TABLE ${q(table.name)} (`);
    body.push([...lines, ...clauses].join(',\n'));
    body.push(');');
    body.push('');

    // Non-unique indexes → CREATE INDEX
    for (const c of cons.filter((x) => x.type === 'IDX')) {
      const idxName = c.name || `idx_${table.name}_${c.columns.join('_')}`;
      trailing.push(`CREATE INDEX ${q(idxName)} ON ${q(table.name)} (${c.columns.map(q).join(', ')});`);
    }

    // Comments (Postgres COMMENT ON; MySQL inline comments are dialect-specific and skipped here)
    if (dbType === 'postgresql') {
      if (table.comment) trailing.push(`COMMENT ON TABLE ${q(table.name)} IS ${sqlStr(table.comment)};`);
      for (const col of table.columns) {
        if (col.comment) trailing.push(`COMMENT ON COLUMN ${q(table.name)}.${q(col.name)} IS ${sqlStr(col.comment)};`);
      }
    }
  }

  if (trailing.length) {
    body.push(trailing.join('\n'));
    body.push('');
  }

  return body.join('\n');
}

// ─────────────────────────── parseDdl (best-effort) ───────────────────────────

function splitColumnDefs(bodyText) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of bodyText) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseColumns(bodyText) {
  const columns = [];
  const constraintLines = [];
  const lines = splitColumnDefs(bodyText);
  let position = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK)\s/i.test(trimmed)) {
      constraintLines.push(trimmed);
      continue;
    }

    const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]*\))?)/i);
    if (!colMatch) continue;

    position++;
    const rest = trimmed.slice(colMatch[0].length).toLowerCase();
    columns.push({
      id: randomUUID(),
      name: colMatch[1],
      dataType: colMatch[2],
      keyTypes: rest.includes('primary key') ? ['PK'] : [],
      isAutoIncrement:
        /serial/i.test(colMatch[2]) || rest.includes('auto_increment') || rest.includes('autoincrement') || undefined,
      defaultValue: null,
      nullable: !rest.includes('not null'),
      comment: '',
      reference: null,
      constraints: [],
      ordinalPosition: position,
    });
  }

  for (const cl of constraintLines) {
    const upper = cl.toUpperCase();

    if (upper.includes('PRIMARY KEY')) {
      const pkMatch = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(cl);
      if (pkMatch) {
        for (const pkCol of pkMatch[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''))) {
          const col = columns.find((c) => c.name === pkCol);
          if (col && !col.keyTypes.includes('PK')) col.keyTypes.push('PK');
        }
      }
    }

    if (upper.includes('FOREIGN KEY')) {
      const fkRegex =
        /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i;
      const fkMatch = fkRegex.exec(cl);
      if (fkMatch) {
        const fkCols = fkMatch[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
        const refCols = fkMatch[3].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
        const onDelete = fkMatch[4]?.replace(/\s+/g, ' ').toUpperCase();
        const onUpdate = fkMatch[5]?.replace(/\s+/g, ' ').toUpperCase();
        for (let i = 0; i < fkCols.length; i++) {
          const col = columns.find((c) => c.name === fkCols[i]);
          if (col) {
            if (!col.keyTypes.includes('FK')) col.keyTypes.push('FK');
            col.reference = { table: fkMatch[2], column: refCols[i] || refCols[0], onDelete, onUpdate };
          }
        }
      }
    }

    if (upper.includes('UNIQUE')) {
      const ukMatch = /UNIQUE\s*(?:KEY|INDEX)?\s*(?:[`"']?\w+[`"']?\s*)?\(([^)]+)\)/i.exec(cl);
      if (ukMatch) {
        for (const ukCol of ukMatch[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''))) {
          const col = columns.find((c) => c.name === ukCol);
          if (col && !col.keyTypes.includes('UK')) col.keyTypes.push('UK');
        }
      }
    }
  }

  return columns;
}

export function parseDdl(ddl) {
  const tables = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\)\s*;/gi;
  let match;
  while ((match = tableRegex.exec(ddl)) !== null) {
    tables.push({
      id: randomUUID(),
      name: match[1],
      comment: '',
      columns: parseColumns(match[2]),
      constraints: [],
    });
  }
  return tables;
}
