import type Database from 'better-sqlite3';

export const SQL_CREATE_PACKAGES = `
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_PACKAGE_RESOURCES = `
CREATE TABLE IF NOT EXISTS package_resources (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  is_shared INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  UNIQUE(package_id, resource_type, resource_id)
);
`;

export const SQL_CREATE_CONNECTIONS = `
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  db_type TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  ssl_enabled INTEGER NOT NULL DEFAULT 0,
  ssl_config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_DIAGRAMS = `
CREATE TABLE IF NOT EXISTS diagrams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'virtual',
  tables_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_DIAGRAM_LAYOUTS = `
CREATE TABLE IF NOT EXISTS diagram_layouts (
  diagram_id TEXT PRIMARY KEY,
  positions TEXT NOT NULL DEFAULT '{}',
  zoom REAL NOT NULL DEFAULT 1.0,
  viewport TEXT NOT NULL DEFAULT '{"x":0,"y":0}',
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_DIAGRAM_VERSIONS = `
CREATE TABLE IF NOT EXISTS diagram_versions (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  ddl_content TEXT NOT NULL DEFAULT '',
  schema_snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_QUERIES = `
CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sql_content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_QUERY_HISTORY = `
CREATE TABLE IF NOT EXISTS query_history (
  id TEXT PRIMARY KEY,
  query_id TEXT,
  sql_content TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  executed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE SET NULL
);
`;

export const SQL_ADD_DIAGRAMS_VERSION = `
ALTER TABLE diagrams ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0';
`;

export const SQL_ADD_DIAGRAMS_HIDDEN = `
ALTER TABLE diagrams ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
`;

export const SQL_ADD_DIAGRAMS_CONNECTION_ID = `
ALTER TABLE diagrams ADD COLUMN connection_id TEXT;
`;

export const SQL_CREATE_DIAGRAM_MIGRATIONS = `
CREATE TABLE IF NOT EXISTS diagram_migrations (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('virtual_to_real', 'real_to_virtual')),
  diff_snapshot TEXT NOT NULL,
  migration_ddl TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'failed', 'rolled_back')),
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  UNIQUE(diagram_id, connection_id, version_number)
);
`;

export const SQL_CREATE_DIAGRAM_MIGRATIONS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_migrations_diagram ON diagram_migrations(diagram_id);
CREATE INDEX IF NOT EXISTS idx_migrations_connection ON diagram_migrations(connection_id);
`;

export const SQL_CREATE_VIEW_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS view_snapshots (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filter_json TEXT NOT NULL DEFAULT '{}',
  layout_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_VIEW_SNAPSHOTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_view_snapshots_diagram ON view_snapshots(diagram_id);
`;

export const SQL_CREATE_SCHEMA_CHANGELOGS = `
CREATE TABLE IF NOT EXISTS schema_changelogs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  diagram_id TEXT NOT NULL,
  changes_json TEXT NOT NULL DEFAULT '[]',
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);
`;

export const SQL_ADD_MIGRATIONS_ROLLBACK_DDL = `
ALTER TABLE diagram_migrations ADD COLUMN rollback_ddl TEXT DEFAULT '';
`;

export const SQL_ADD_LAYOUT_HIDDEN_TABLE_IDS = `
ALTER TABLE diagram_layouts ADD COLUMN hidden_table_ids TEXT NOT NULL DEFAULT '[]';
`;

export const SQL_ADD_LAYOUT_TABLE_COLORS = `
ALTER TABLE diagram_layouts ADD COLUMN table_colors TEXT NOT NULL DEFAULT '{}';
`;

export const SQL_ADD_DIAGRAMS_DESCRIPTION = `
ALTER TABLE diagrams ADD COLUMN description TEXT DEFAULT '';
`;

export const SQL_ADD_DIAGRAM_VERSIONS_NAME = `
ALTER TABLE diagram_versions ADD COLUMN name TEXT NOT NULL DEFAULT '';
`;

export const SQL_ADD_DIAGRAMS_DEFAULT_VERSION_ID = `
ALTER TABLE diagrams ADD COLUMN default_version_id TEXT;
`;

export const SQL_ADD_DIAGRAM_VERSIONS_SORT_ORDER = `
ALTER TABLE diagram_versions ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
`;

export const SQL_ADD_DIAGRAMS_SORT_ORDER = `
ALTER TABLE diagrams ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
`;

export const SQL_ADD_DIAGRAM_VERSIONS_IS_LOCKED = `
ALTER TABLE diagram_versions ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;
`;

// Recreate diagram_migrations with 'rolled_back' in CHECK constraint (for existing DBs)
export const SQL_FIX_MIGRATIONS_STATUS_CHECK = `
CREATE TABLE IF NOT EXISTS diagram_migrations_new (
  id TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('virtual_to_real', 'real_to_virtual')),
  diff_snapshot TEXT NOT NULL,
  migration_ddl TEXT NOT NULL DEFAULT '',
  rollback_ddl TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'failed', 'rolled_back')),
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  UNIQUE(diagram_id, connection_id, version_number)
);
`;

export const SQL_CREATE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  auto_generated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_SCHEMA_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS schema_snapshots (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tables_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  checksum TEXT NOT NULL,
  validated_at TEXT,
  is_valid INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_SCHEMA_SNAPSHOTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_snapshots_connection ON schema_snapshots(connection_id);
`;

export const SQL_CREATE_MIGRATION_PACKS = `
CREATE TABLE IF NOT EXISTS migration_packs (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  diagram_id TEXT NOT NULL,
  source_version_id TEXT,
  target_version_id TEXT NOT NULL,
  pre_snapshot_id TEXT,
  diff_json TEXT NOT NULL,
  update_ddl TEXT NOT NULL,
  seed_dml TEXT NOT NULL DEFAULT '',
  rollback_ddl TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','reviewed','executing','applied','failed','rolled_back')),
  execution_log_json TEXT,
  applied_at TEXT,
  rolled_back_at TEXT,
  post_snapshot_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_MIGRATION_PACKS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_migration_packs_diagram ON migration_packs(diagram_id);
CREATE INDEX IF NOT EXISTS idx_migration_packs_connection ON migration_packs(connection_id);
`;

export const SQL_CREATE_SEEDS = `
CREATE TABLE IF NOT EXISTS seeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  dml_content TEXT NOT NULL DEFAULT '',
  target_tables TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_VALIDATION_SUITES = `
CREATE TABLE IF NOT EXISTS validation_suites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const SQL_CREATE_QUERY_FOLDERS = `
CREATE TABLE IF NOT EXISTS query_folders (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES query_folders(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_QUERY_FOLDERS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_query_folders_connection ON query_folders(connection_id);
CREATE INDEX IF NOT EXISTS idx_query_folders_parent ON query_folders(parent_id);
`;

export const SQL_CREATE_COLLECTION_FOLDERS = `
CREATE TABLE IF NOT EXISTS collection_folders (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES collection_folders(id) ON DELETE CASCADE
);
`;

export const SQL_CREATE_COLLECTION_FOLDERS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_collection_folders_connection ON collection_folders(connection_id);
`;

export const SQL_CREATE_COLLECTIONS = `
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL,
  folder_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES collection_folders(id) ON DELETE SET NULL
);
`;

export const SQL_CREATE_COLLECTIONS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_collections_connection ON collections(connection_id);
`;

export const SQL_CREATE_COLLECTION_ITEMS = `
CREATE TABLE IF NOT EXISTS collection_items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE RESTRICT
);
`;

export const SQL_CREATE_COLLECTION_ITEMS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_query ON collection_items(query_id);
`;

const ALL_MIGRATIONS = [
  SQL_CREATE_PACKAGES,
  SQL_CREATE_PACKAGE_RESOURCES,
  SQL_CREATE_CONNECTIONS,
  SQL_CREATE_DIAGRAMS,
  SQL_CREATE_DIAGRAM_LAYOUTS,
  SQL_CREATE_DIAGRAM_VERSIONS,
  SQL_CREATE_DIAGRAM_MIGRATIONS,
  SQL_CREATE_DIAGRAM_MIGRATIONS_INDEXES,
  SQL_CREATE_VIEW_SNAPSHOTS,
  SQL_CREATE_VIEW_SNAPSHOTS_INDEX,
  SQL_CREATE_QUERIES,
  SQL_CREATE_QUERY_HISTORY,
  SQL_CREATE_DOCUMENTS,
  SQL_CREATE_SCHEMA_CHANGELOGS,
  SQL_CREATE_SCHEMA_SNAPSHOTS,
  SQL_CREATE_SCHEMA_SNAPSHOTS_INDEX,
  SQL_CREATE_MIGRATION_PACKS,
  SQL_CREATE_MIGRATION_PACKS_INDEXES,
  SQL_CREATE_SEEDS,
  SQL_CREATE_VALIDATION_SUITES,
  SQL_CREATE_QUERY_FOLDERS,
  SQL_CREATE_QUERY_FOLDERS_INDEXES,
  SQL_CREATE_COLLECTION_FOLDERS,
  SQL_CREATE_COLLECTION_FOLDERS_INDEXES,
  SQL_CREATE_COLLECTIONS,
  SQL_CREATE_COLLECTIONS_INDEXES,
  SQL_CREATE_COLLECTION_ITEMS,
  SQL_CREATE_COLLECTION_ITEMS_INDEXES,
];

export function runMigrations(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  // WAL 동반 설정: 쓰기 fsync 스톨 감소 + GUI와 MCP 서버가 rockury.db를 동시에
  // 열 때 SQLITE_BUSY 즉시 에러 대신 최대 3초 대기(메인 스레드 스톨 상한).
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 3000');
  db.pragma('foreign_keys = ON');

  const migrate = db.transaction(() => {
    for (const sql of ALL_MIGRATIONS) {
      db.exec(sql);
    }

    // Safe ALTER TABLE migrations (ignore if column already exists)
    const alterMigrations = [
      SQL_ADD_DIAGRAMS_VERSION,
      SQL_ADD_DIAGRAMS_HIDDEN,
      SQL_ADD_DIAGRAMS_CONNECTION_ID,
      SQL_ADD_MIGRATIONS_ROLLBACK_DDL,
      SQL_ADD_LAYOUT_HIDDEN_TABLE_IDS,
      SQL_ADD_LAYOUT_TABLE_COLORS,
      SQL_ADD_DIAGRAMS_DESCRIPTION,
      SQL_ADD_DIAGRAM_VERSIONS_NAME,
      SQL_ADD_DIAGRAMS_DEFAULT_VERSION_ID,
      SQL_ADD_DIAGRAM_VERSIONS_SORT_ORDER,
      SQL_ADD_DIAGRAMS_SORT_ORDER,
      SQL_ADD_DIAGRAM_VERSIONS_IS_LOCKED,
      `ALTER TABLE connections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE connections ADD COLUMN ignored INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE queries ADD COLUMN connection_id TEXT;`,
      `ALTER TABLE queries ADD COLUMN folder_id TEXT;`,
      `ALTER TABLE queries ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE query_history ADD COLUMN connection_id TEXT;`,
      `ALTER TABLE query_history ADD COLUMN source TEXT NOT NULL DEFAULT 'query';`,
      `ALTER TABLE query_history ADD COLUMN affected_tables TEXT NOT NULL DEFAULT '[]';`,
      `ALTER TABLE query_history ADD COLUMN affected_rows INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE query_history ADD COLUMN dml_type TEXT;`,
    ];
    for (const sql of alterMigrations) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists - safe to ignore
      }
    }

    // Create indexes for new query columns
    db.exec('CREATE INDEX IF NOT EXISTS idx_queries_connection ON queries(connection_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_queries_folder ON queries(folder_id);');

    // Fix CHECK constraint: recreate diagram_migrations with 'rolled_back' status
    try {
      db.exec(SQL_FIX_MIGRATIONS_STATUS_CHECK);
      db.exec(`INSERT OR IGNORE INTO diagram_migrations_new SELECT * FROM diagram_migrations;`);
      db.exec(`DROP TABLE diagram_migrations;`);
      db.exec(`ALTER TABLE diagram_migrations_new RENAME TO diagram_migrations;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_migrations_diagram ON diagram_migrations(diagram_id);`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_migrations_connection ON diagram_migrations(connection_id);`);
    } catch {
      // Already migrated or fresh DB - safe to ignore
    }
  });

  migrate();

  // Data migration: ensure every virtual diagram has at least one version + default
  migrateVersionData(db);
}

function migrateVersionData(db: Database.Database): void {
  interface DiagramRow {
    id: string;
    name: string;
    version: string;
    tables_json: string;
    description: string | null;
  }

  const diagrams = db.prepare(
    `SELECT id, name, version, tables_json, description FROM diagrams WHERE type = 'virtual'`,
  ).all() as DiagramRow[];

  for (const d of diagrams) {
    const versionCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM diagram_versions WHERE diagram_id = ?').get(d.id) as { cnt: number }
    ).cnt;

    if (versionCount === 0) {
      // Create initial version from diagram.tables
      const id = crypto.randomUUID();
      const tables = JSON.parse(d.tables_json || '[]');
      const snapshot = JSON.stringify({
        id: d.id,
        name: d.name,
        version: d.version || '0.0.0',
        type: 'virtual',
        tables,
        description: d.description || '',
      });
      db.prepare(
        `INSERT INTO diagram_versions (id, diagram_id, version_number, name, ddl_content, schema_snapshot, sort_order) VALUES (?, ?, 1, ?, '', ?, 1)`,
      ).run(id, d.id, `v${d.version || '0.0.0'}`, snapshot);
    }

    // Sync diagram.tables_json from first version's snapshot
    const firstVer = db.prepare(
      'SELECT schema_snapshot FROM diagram_versions WHERE diagram_id = ? ORDER BY sort_order ASC, version_number DESC LIMIT 1',
    ).get(d.id) as { schema_snapshot: string } | undefined;
    if (firstVer) {
      try {
        const snapshot = JSON.parse(firstVer.schema_snapshot);
        if (snapshot.tables) {
          db.prepare('UPDATE diagrams SET tables_json = ? WHERE id = ?')
            .run(JSON.stringify(snapshot.tables), d.id);
        }
      } catch {
        // Malformed snapshot - ignore
      }
    }
  }
}
