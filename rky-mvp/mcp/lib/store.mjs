import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { resolveDbPath, assertDbExists } from './dbPath.mjs';
import { generateDdl } from './ddl.mjs';
import { deriveConstraintsForTables } from './normalize.mjs';

/**
 * Thin data-access layer over rockury.db, mirroring the SQL in
 * src/main/repositories/diagramRepository.ts and diagramVersionRepository.ts.
 * Uses Node's built-in node:sqlite (no native module) so it never conflicts with
 * the app's Electron-ABI better-sqlite3 build.
 *
 * IMPORTANT: the app's canvas renders `diagramVersions[0].schemaSnapshot.tables`
 * (first by sort_order ASC, version_number DESC), NOT `diagrams.tables_json`.
 * `tables_json` only feeds the diagram-row table count. So every write must keep
 * the first version's snapshot in sync, exactly like the app's own Save does
 * (see VirtualDiagramView.handleSave / migrateVersionData).
 */

let db = null;

export function getDb() {
  if (db) return db;
  const dbPath = resolveDbPath();
  assertDbExists(dbPath);
  db = new DatabaseSync(dbPath);
  // WAL is already set by the app; only tune this connection.
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function toDiagram(row) {
  return {
    id: row.id,
    name: row.name,
    version: row.version ?? '1.0.0',
    type: row.type,
    tables: JSON.parse(row.tables_json ?? '[]'),
    description: row.description ?? '',
    hidden: row.hidden === 1,
    connectionId: row.connection_id ?? undefined,
    defaultVersionId: row.default_version_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Snapshot shape stored in diagram_versions.schema_snapshot — matches the app's
// migrateVersionData / buildCurrentSnapshot.
function buildSnapshot({ id, name, version, tables, description }) {
  return JSON.stringify({ id, name, version, type: 'virtual', tables, description });
}

function getFirstVersionRow(diagramId) {
  return getDb()
    .prepare(
      'SELECT * FROM diagram_versions WHERE diagram_id = ? ORDER BY sort_order ASC, version_number DESC LIMIT 1',
    )
    .get(diagramId);
}

function versionNameTaken(diagramId, name, exceptId) {
  const row = getDb()
    .prepare('SELECT id FROM diagram_versions WHERE diagram_id = ? AND LOWER(name) = LOWER(?) AND id != ?')
    .get(diagramId, name, exceptId ?? '');
  return !!row;
}

export function listDiagrams({ type = 'virtual', includeHidden = false } = {}) {
  const d = getDb();
  const rows = type
    ? d.prepare('SELECT * FROM diagrams WHERE type = ? ORDER BY sort_order ASC, created_at DESC').all(type)
    : d.prepare('SELECT * FROM diagrams ORDER BY sort_order ASC, created_at DESC').all();
  const diagrams = rows.map(toDiagram);
  return includeHidden ? diagrams : diagrams.filter((x) => !x.hidden);
}

export function getDiagramById(id) {
  const row = getDb().prepare('SELECT * FROM diagrams WHERE id = ?').get(id);
  return row ? toDiagram(row) : null;
}

export function getDiagramByName(name) {
  const row = getDb().prepare('SELECT * FROM diagrams WHERE name = ? ORDER BY created_at DESC').get(name);
  return row ? toDiagram(row) : null;
}

/**
 * Create a virtual diagram plus its initial version (v{version}) whose snapshot
 * holds the tables — so the app's canvas renders them immediately.
 */
export function createDiagram({ name, description = '', version = '1.0.0', tables = [] }) {
  const d = getDb();
  const id = randomUUID();
  tables = deriveConstraintsForTables(tables);

  d.exec('BEGIN');
  try {
    d.prepare(
      'INSERT INTO diagrams (id, name, type, version, description, tables_json, connection_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, name, 'virtual', version, description, JSON.stringify(tables), null);

    d.prepare(
      "INSERT INTO diagram_versions (id, diagram_id, version_number, name, ddl_content, schema_snapshot, sort_order) VALUES (?, ?, 1, ?, ?, ?, 1)",
    ).run(
      randomUUID(),
      id,
      `v${version}`,
      generateDdl(tables, 'postgresql'),
      buildSnapshot({ id, name, version, tables, description }),
    );

    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }

  return getDiagramById(id);
}

/**
 * Update a diagram. When `tables` is provided it replaces the table set AND syncs
 * the first version's snapshot (the one the app renders), mirroring the app's Save.
 */
export function updateDiagram(id, { name, version, description, tables } = {}) {
  const existing = getDiagramById(id);
  if (!existing) throw new Error(`Diagram not found: ${id}`);
  if (tables !== undefined) tables = deriveConstraintsForTables(tables);

  const d = getDb();
  const effName = name ?? existing.name;
  const effVersion = version ?? existing.version;
  const effDescription = description ?? existing.description;

  d.exec('BEGIN');
  try {
    // 1. diagrams row (tables_json feeds the row's table count)
    const sets = [];
    const values = [];
    if (name !== undefined) { sets.push('name = ?'); values.push(name); }
    if (version !== undefined) { sets.push('version = ?'); values.push(version); }
    if (tables !== undefined) { sets.push('tables_json = ?'); values.push(JSON.stringify(tables)); }
    if (description !== undefined) { sets.push('description = ?'); values.push(description); }
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      values.push(id);
      d.prepare(`UPDATE diagrams SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    // 2. Sync the first version's snapshot so the canvas shows the tables.
    if (tables !== undefined) {
      const snapshot = buildSnapshot({ id, name: effName, version: effVersion, tables, description: effDescription });
      const ddl = generateDdl(tables, 'postgresql');
      const firstVer = getFirstVersionRow(id);

      if (firstVer) {
        d.prepare('UPDATE diagram_versions SET schema_snapshot = ?, ddl_content = ? WHERE id = ?')
          .run(snapshot, ddl, firstVer.id);
        // Keep the version label aligned with the diagram version, when free.
        if (version !== undefined) {
          const desired = `v${version}`;
          if (firstVer.name !== desired && !versionNameTaken(id, desired, firstVer.id)) {
            d.prepare('UPDATE diagram_versions SET name = ? WHERE id = ?').run(desired, firstVer.id);
          }
        }
      } else {
        d.prepare(
          "INSERT INTO diagram_versions (id, diagram_id, version_number, name, ddl_content, schema_snapshot, sort_order) VALUES (?, ?, 1, ?, ?, ?, 1)",
        ).run(randomUUID(), id, `v${effVersion}`, ddl, snapshot);
      }
    }

    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }

  return getDiagramById(id);
}
