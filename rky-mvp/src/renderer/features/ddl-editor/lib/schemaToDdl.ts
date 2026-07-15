import type { ITable, IColumn, IConstraint } from '@/entities/table';
import type { TDbType } from '@/entities/connection';

/**
 * Convert ITable[] to CREATE TABLE DDL string.
 * Supports mysql and postgresql syntax differences.
 */
export function schemaToDdl(tables: ITable[], dbType: TDbType = 'mysql'): string {
  const orderedTables = orderTablesByDependencies(tables);
  return orderedTables.map((table) => tableToCreateDdl(table, dbType)).join('\n\n');
}

function quote(name: string, dbType: TDbType): string {
  return dbType === 'postgresql' ? `"${name}"` : `\`${name}\``;
}

function tableToCreateDdl(table: ITable, dbType: TDbType): string {
  const lines: string[] = [];
  const q = (name: string) => quote(name, dbType);

  // Column definitions
  for (const col of table.columns) {
    lines.push(`  ${columnToDdl(col, dbType)}`);
  }

  // Constraints
  const pkColumns = table.columns.filter((c) => c.keyTypes?.includes('PK'));
  if (pkColumns.length > 0) {
    lines.push(`  PRIMARY KEY (${pkColumns.map((c) => q(c.name)).join(', ')})`);
  }

  for (const constraint of table.constraints) {
    const constraintDdl = constraintToDdl(constraint, dbType);
    if (constraintDdl) lines.push(`  ${constraintDdl}`);
  }

  // FK from column references (fallback when table-level FK constraint is missing)
  const existingFkSignatures = new Set(
    table.constraints
      .filter((c) => c.type === 'FK' && c.reference)
      .map((c) => buildFkSignature(
        c.columns,
        c.reference!.table,
        splitRefColumns(c.reference!.column, c.columns.length, c.columns),
        c.reference!.onDelete,
        c.reference!.onUpdate,
      )),
  );
  const coveredFkColumns = new Set(
    table.constraints
      .filter((c) => c.type === 'FK')
      .flatMap((c) => c.columns.map((name) => name.toLowerCase())),
  );

  for (const col of table.columns) {
    if (col.keyTypes?.includes('FK') && col.reference) {
      if (coveredFkColumns.has(col.name.toLowerCase())) continue;
      const refCols = splitRefColumns(col.reference.column, 1, [col.name]);
      const signature = buildFkSignature(
        [col.name],
        col.reference.table,
        refCols,
        col.reference.onDelete,
        col.reference.onUpdate,
      );
      if (existingFkSignatures.has(signature)) continue;

      const fkName = `fk_${table.name}_${col.name}`;
      let fkDdl = `CONSTRAINT ${q(fkName)} FOREIGN KEY (${q(col.name)}) REFERENCES ${q(col.reference.table)} (${q(refCols[0])})`;
      if (col.reference.onDelete) fkDdl += ` ON DELETE ${col.reference.onDelete}`;
      if (col.reference.onUpdate) fkDdl += ` ON UPDATE ${col.reference.onUpdate}`;
      lines.push(`  ${fkDdl}`);
    }
  }

  let ddl = `CREATE TABLE ${q(table.name)} (\n${lines.join(',\n')}\n)`;

  if (dbType === 'mysql' || dbType === 'mariadb') {
    if (table.engine) ddl += ` ENGINE=${table.engine}`;
    if (table.charset) ddl += ` DEFAULT CHARSET=${table.charset}`;
  }

  if (table.comment) {
    if (dbType === 'postgresql') {
      ddl += `;\n\nCOMMENT ON TABLE ${q(table.name)} IS '${escapeStr(table.comment)}'`;
    } else {
      ddl += ` COMMENT='${escapeStr(table.comment)}'`;
    }
  }

  // Non-unique indexes are separate statements (UNIQUE is emitted inline as a constraint).
  const statements = [ddl + ';'];
  for (const constraint of table.constraints) {
    if (constraint.type === 'IDX' && constraint.columns.length > 0) {
      const idxName = constraint.name || `idx_${table.name}_${constraint.columns.join('_')}`;
      statements.push(
        `CREATE INDEX ${q(idxName)} ON ${q(table.name)} (${constraint.columns.map((c) => q(c)).join(', ')});`,
      );
    }
  }

  return statements.join('\n');
}

function columnToDdl(col: IColumn, dbType: TDbType): string {
  const q = (name: string) => quote(name, dbType);
  // PostgreSQL expresses auto-increment via the SERIAL pseudo-type, which also
  // implies NOT NULL and provides its own sequence default.
  const isPgSerial = !!col.isAutoIncrement && dbType === 'postgresql';
  const dataType = isPgSerial ? pgSerialType(col.dataType) : col.dataType;
  const parts: string[] = [q(col.name), dataType];

  if (!col.nullable && !isPgSerial) parts.push('NOT NULL');
  if (col.isAutoIncrement && (dbType === 'mysql' || dbType === 'mariadb')) {
    parts.push('AUTO_INCREMENT');
  }

  if (!isPgSerial && col.defaultValue !== null && col.defaultValue !== undefined) {
    parts.push(`DEFAULT ${quoteDefault(col.defaultValue)}`);
  }

  if (dbType !== 'postgresql' && col.comment) {
    parts.push(`COMMENT '${escapeStr(col.comment)}'`);
  }

  return parts.join(' ');
}

function pgSerialType(dataType: string): string {
  const t = dataType.toUpperCase();
  if (t.includes('BIGINT') || t === 'INT8') return 'BIGSERIAL';
  if (t.includes('SMALLINT') || t === 'INT2') return 'SMALLSERIAL';
  return 'SERIAL';
}

function constraintToDdl(constraint: IConstraint, dbType: TDbType): string | null {
  const q = (name: string) => quote(name, dbType);
  const cols = constraint.columns.map((c) => q(c)).join(', ');

  switch (constraint.type) {
    case 'UK':
      return `CONSTRAINT ${q(constraint.name)} UNIQUE (${cols})`;
    case 'IDX':
      return null; // INDEX is a separate statement, skip inline
    case 'CHECK':
      return constraint.checkExpression
        ? `CONSTRAINT ${q(constraint.name)} CHECK (${constraint.checkExpression})`
        : null;
    case 'FK': {
      if (!constraint.reference) return null;
      const refCols = splitRefColumns(
        constraint.reference.column,
        constraint.columns.length,
        constraint.columns,
      );
      let ddl = `CONSTRAINT ${q(constraint.name)} FOREIGN KEY (${cols}) REFERENCES ${q(constraint.reference.table)} (${refCols.map((c) => q(c)).join(', ')})`;
      if (constraint.reference.onDelete) ddl += ` ON DELETE ${constraint.reference.onDelete}`;
      if (constraint.reference.onUpdate) ddl += ` ON UPDATE ${constraint.reference.onUpdate}`;
      return ddl;
    }
    default:
      return null;
  }
}

function quoteDefault(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (upper === 'NULL') return 'NULL';
  if (upper === 'TRUE' || upper === 'FALSE') return upper;
  if (upper === 'CURRENT_TIMESTAMP' || upper === 'CURRENT_TIMESTAMP()') return trimmed;
  if (isQuotedLiteral(trimmed)) return trimmed;
  if (looksLikeSqlExpression(trimmed)) return trimmed;

  return `'${escapeStr(trimmed)}'`;
}

function escapeStr(value: string): string {
  return value.replace(/'/g, "''");
}

function isQuotedLiteral(value: string): boolean {
  return (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  );
}

function looksLikeSqlExpression(value: string): boolean {
  // e.g. nextval('seq'::regclass), now(), uuid_generate_v4()
  if (value.includes('::')) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(.*\)$/.test(value)) return true;
  return false;
}

function splitRefColumns(value: string, minCount: number, fallbackColumns: string[] = []): string[] {
  const parsed = value
    .split(',')
    .map((v) => v.trim().replace(/[`"']/g, ''))
    .filter(Boolean);

  if (parsed.length === 0) {
    if (fallbackColumns.length > 0) return fallbackColumns.slice(0, Math.max(minCount, 1));
    return ['id'];
  }
  if (parsed.length >= minCount) return parsed;

  // Defensive: some metadata stores only the first referenced column.
  // Prefer source-column fallback per ordinal before duplicating last known ref column.
  const filled = [...parsed];
  while (filled.length < minCount) {
    const fallback = fallbackColumns[filled.length];
    if (fallback) {
      filled.push(fallback);
      continue;
    }
    filled.push(parsed[parsed.length - 1]);
  }
  return filled;
}

function buildFkSignature(
  sourceColumns: string[],
  targetTable: string,
  targetColumns: string[],
  onDelete?: string,
  onUpdate?: string,
): string {
  return [
    sourceColumns.map((c) => c.toLowerCase()).join(','),
    targetTable.toLowerCase(),
    targetColumns.map((c) => c.toLowerCase()).join(','),
    (onDelete ?? '').toLowerCase(),
    (onUpdate ?? '').toLowerCase(),
  ].join('|');
}

function orderTablesByDependencies(tables: ITable[]): ITable[] {
  const keyOf = (name: string) => name.toLowerCase();
  const byKey = new Map<string, ITable>();
  const indexByKey = new Map<string, number>();

  tables.forEach((table, index) => {
    const key = keyOf(table.name);
    if (!byKey.has(key)) {
      byKey.set(key, table);
      indexByKey.set(key, index);
    }
  });

  const inDegree = new Map<string, number>();
  const edges = new Map<string, Set<string>>();
  for (const key of byKey.keys()) {
    inDegree.set(key, 0);
    edges.set(key, new Set());
  }

  for (const table of byKey.values()) {
    const fromKey = keyOf(table.name);
    const referenced = new Set<string>();

    for (const constraint of table.constraints) {
      if (constraint.type === 'FK' && constraint.reference) {
        referenced.add(keyOf(constraint.reference.table));
      }
    }
    for (const col of table.columns) {
      if (col.reference) referenced.add(keyOf(col.reference.table));
    }

    for (const refKey of referenced) {
      if (refKey === fromKey || !byKey.has(refKey)) continue;
      if (edges.get(refKey)!.has(fromKey)) continue;
      edges.get(refKey)!.add(fromKey);
      inDegree.set(fromKey, (inDegree.get(fromKey) ?? 0) + 1);
    }
  }

  const queue = [...byKey.keys()]
    .filter((k) => (inDegree.get(k) ?? 0) === 0)
    .sort((a, b) => (indexByKey.get(a) ?? 0) - (indexByKey.get(b) ?? 0));
  const ordered: ITable[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);
    ordered.push(byKey.get(key)!);

    for (const dep of edges.get(key) ?? []) {
      const next = (inDegree.get(dep) ?? 0) - 1;
      inDegree.set(dep, next);
      if (next === 0) queue.push(dep);
    }

    queue.sort((a, b) => (indexByKey.get(a) ?? 0) - (indexByKey.get(b) ?? 0));
  }

  if (ordered.length < byKey.size) {
    const remained = [...byKey.keys()]
      .filter((k) => !visited.has(k))
      .sort((a, b) => (indexByKey.get(a) ?? 0) - (indexByKey.get(b) ?? 0))
      .map((k) => byKey.get(k)!);
    ordered.push(...remained);
  }

  return ordered;
}
