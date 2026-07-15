import { randomUUID } from 'node:crypto';

/**
 * Normalize a friendly table/column shape (easy for an agent to author) into the
 * full ITable/IColumn shape stored in diagrams.tables_json.
 *
 * Friendly column fields (all except name/type optional):
 *   name, type, pk, nullable, unique, autoIncrement, default, comment,
 *   references: { table, column, onDelete?, onUpdate? }
 *
 * Raw ITable columns (with keyTypes/reference/ordinalPosition) are also accepted
 * and passed through, so callers can round-trip get_diagram output.
 */

function normalizeColumn(col, index) {
  const dataType = col.dataType ?? col.type;
  if (!col.name || !dataType) {
    throw new Error(`Column at position ${index + 1} requires "name" and "type"`);
  }

  const ref = col.reference ?? col.references ?? null;
  const isPk = col.pk ?? col.primaryKey ?? col.keyTypes?.includes('PK') ?? false;
  const isFk = !!ref || (col.keyTypes?.includes('FK') ?? false);
  const isUnique = col.unique ?? col.keyTypes?.includes('UK') ?? false;

  const keyTypes = [];
  if (isPk) keyTypes.push('PK');
  if (isFk) keyTypes.push('FK');
  if (isUnique) keyTypes.push('UK');

  // Primary keys are non-null by definition unless explicitly overridden.
  const nullable = col.nullable ?? (isPk ? false : true);

  return {
    id: col.id ?? randomUUID(),
    name: col.name,
    dataType,
    keyTypes,
    isAutoIncrement: col.autoIncrement ?? col.isAutoIncrement ?? undefined,
    isGenerated: col.isGenerated ?? undefined,
    generationExpression: col.generationExpression ?? undefined,
    defaultValue: col.default ?? col.defaultValue ?? null,
    nullable,
    comment: col.comment ?? '',
    reference: ref
      ? {
          table: ref.table,
          column: ref.column,
          onDelete: ref.onDelete ?? undefined,
          onUpdate: ref.onUpdate ?? undefined,
        }
      : null,
    constraints: col.constraints ?? [],
    ordinalPosition: index + 1,
  };
}

export function normalizeTable(table, index) {
  if (!table.name) throw new Error(`Table at position ${index + 1} requires "name"`);
  if (!Array.isArray(table.columns) || table.columns.length === 0) {
    throw new Error(`Table "${table.name}" requires at least one column`);
  }

  return {
    id: table.id ?? randomUUID(),
    name: table.name,
    comment: table.comment ?? '',
    columns: table.columns.map(normalizeColumn),
    constraints: table.constraints ?? [],
    engine: table.engine ?? undefined,
    charset: table.charset ?? undefined,
  };
}

export function normalizeTables(tables) {
  if (!Array.isArray(tables)) throw new Error('"tables" must be an array');
  return tables.map((t, i) => mergeTableSpecs(deriveConstraints(normalizeTable(t, i)), t));
}

function sameCols(a = [], b = []) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Merge table-level friendly specs into constraints:
 *   primaryKey: ["a","b"]                          → composite PK (overrides per-column pk)
 *   uniques:    [["card_id","printing"], {name?, columns}]  → UNIQUE constraints
 *   indexes:    [["tcgplayer_id"], {name?, columns}]        → non-unique CREATE INDEX (IDX)
 *   checks:     ["amount >= 0", {name?, expression}]        → CHECK constraints
 */
function mergeTableSpecs(table, friendly) {
  const constraints = [...table.constraints];
  const name = table.name;
  const has = (type, cols) => constraints.some((c) => c.type === type && sameCols(c.columns, cols));

  if (Array.isArray(friendly.primaryKey) && friendly.primaryKey.length) {
    for (let i = constraints.length - 1; i >= 0; i--) {
      if (constraints[i].type === 'PK') constraints.splice(i, 1);
    }
    constraints.push({ type: 'PK', name: `pk_${name}`, columns: friendly.primaryKey });
  }

  for (const u of friendly.uniques ?? []) {
    const cols = Array.isArray(u) ? u : u.columns;
    if (!cols?.length || has('UK', cols)) continue;
    constraints.push({ type: 'UK', name: (!Array.isArray(u) && u.name) || `uk_${name}_${cols.join('_')}`, columns: cols });
  }

  for (const ix of friendly.indexes ?? []) {
    const cols = Array.isArray(ix) ? ix : ix.columns;
    if (!cols?.length || has('IDX', cols)) continue;
    constraints.push({ type: 'IDX', name: (!Array.isArray(ix) && ix.name) || `idx_${name}_${cols.join('_')}`, columns: cols });
  }

  for (const ck of friendly.checks ?? []) {
    const expr = typeof ck === 'string' ? ck : ck.expression;
    if (!expr) continue;
    const nm = (typeof ck !== 'string' && ck.name) || `ck_${name}_${constraints.filter((c) => c.type === 'CHECK').length + 1}`;
    constraints.push({ type: 'CHECK', name: nm, columns: [], checkExpression: expr });
  }

  return { ...table, constraints };
}

/**
 * The app treats `table.constraints` as the single source of truth: on render it
 * runs syncKeyTypesFromConstraints (schemaToNodes.ts) which REBUILDS each column's
 * keyTypes/reference FROM the constraints and discards column-level values. So a
 * table with column.reference set but empty constraints renders with NO FK edges.
 *
 * This derives PK/FK/UK constraints from the (already-normalized) column fields,
 * so the app reconstructs keys and draws relations. Existing constraints of a
 * given kind are respected and not duplicated.
 */
export function deriveConstraints(table) {
  const existing = Array.isArray(table.constraints) ? table.constraints : [];
  const constraints = [...existing];
  const hasFor = (type, colName) =>
    existing.some((c) => c.type === type && (colName ? c.columns?.includes(colName) : true));

  const pkCols = table.columns.filter((c) => (c.keyTypes ?? []).includes('PK')).map((c) => c.name);
  if (pkCols.length && !hasFor('PK')) {
    constraints.push({ type: 'PK', name: `pk_${table.name}`, columns: pkCols });
  }

  for (const c of table.columns) {
    if (c.reference && !hasFor('FK', c.name)) {
      constraints.push({
        type: 'FK',
        name: `fk_${table.name}_${c.name}`,
        columns: [c.name],
        reference: c.reference,
      });
    }
  }

  for (const c of table.columns) {
    if ((c.keyTypes ?? []).includes('UK') && !hasFor('UK', c.name)) {
      constraints.push({ type: 'UK', name: `uk_${table.name}_${c.name}`, columns: [c.name] });
    }
  }

  return { ...table, constraints };
}

export function deriveConstraintsForTables(tables) {
  return (tables ?? []).map(deriveConstraints);
}
