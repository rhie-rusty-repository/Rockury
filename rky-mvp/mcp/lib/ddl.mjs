import { randomUUID } from 'node:crypto';

/**
 * DDL generate/parse — a faithful port of the logic in
 * src/main/ipc/handlers/schemaHandlers.ts so the MCP server produces output
 * identical to what the Electron app's Schema Studio shows.
 *
 * Types (ITable / IColumn) mirror src/shared/types/db.ts.
 */

function quoteId(name, dbType) {
  if (dbType === 'postgresql') return `"${name}"`;
  return `\`${name}\``;
}

export function generateDdl(tables, dbType = 'postgresql') {
  const lines = [];

  for (const table of tables) {
    const colDefs = [];

    for (const col of table.columns) {
      let def = `  ${quoteId(col.name, dbType)} ${col.dataType}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      if (col.keyTypes?.includes('PK')) def += ' PRIMARY KEY';
      colDefs.push(def);
    }

    // Add FK constraints
    for (const col of table.columns) {
      if (col.reference) {
        let fk = `  FOREIGN KEY (${quoteId(col.name, dbType)}) REFERENCES ${quoteId(col.reference.table, dbType)}(${quoteId(col.reference.column, dbType)})`;
        if (col.reference.onDelete) fk += ` ON DELETE ${col.reference.onDelete}`;
        if (col.reference.onUpdate) fk += ` ON UPDATE ${col.reference.onUpdate}`;
        colDefs.push(fk);
      }
    }

    lines.push(`CREATE TABLE ${quoteId(table.name, dbType)} (`);
    lines.push(colDefs.join(',\n'));
    lines.push(');');
    lines.push('');
  }

  return lines.join('\n');
}

function splitColumnDefs(body) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const char of body) {
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

function parseColumns(body) {
  const columns = [];
  const constraintLines = [];
  const lines = splitColumnDefs(body);
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
    const colName = colMatch[1];
    const dataType = colMatch[2];
    const rest = trimmed.slice(colMatch[0].length).toLowerCase();

    columns.push({
      id: randomUUID(),
      name: colName,
      dataType,
      keyTypes: rest.includes('primary key') ? ['PK'] : [],
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
        const pkCols = pkMatch[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
        for (const pkCol of pkCols) {
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
        const refTable = fkMatch[2];
        const refCols = fkMatch[3].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
        const onDelete = fkMatch[4]?.replace(/\s+/g, ' ').toUpperCase();
        const onUpdate = fkMatch[5]?.replace(/\s+/g, ' ').toUpperCase();

        for (let i = 0; i < fkCols.length; i++) {
          const col = columns.find((c) => c.name === fkCols[i]);
          if (col) {
            if (!col.keyTypes.includes('FK')) col.keyTypes.push('FK');
            col.reference = {
              table: refTable,
              column: refCols[i] || refCols[0],
              onDelete,
              onUpdate,
            };
          }
        }
      }
    }

    if (upper.includes('UNIQUE')) {
      const ukMatch = /UNIQUE\s*(?:KEY|INDEX)?\s*(?:[`"']?\w+[`"']?\s*)?\(([^)]+)\)/i.exec(cl);
      if (ukMatch) {
        const ukCols = ukMatch[1].split(',').map((c) => c.trim().replace(/[`"']/g, ''));
        for (const ukCol of ukCols) {
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
    const tableName = match[1];
    const body = match[2];
    const columns = parseColumns(body);

    tables.push({
      id: randomUUID(),
      name: tableName,
      comment: '',
      columns,
      constraints: [],
    });
  }

  return tables;
}
