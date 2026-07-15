import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '~/shared/ipc/channels';
import { type TElectronAPI } from '~/shared/ipc/preload';

const API: TElectronAPI = {
  // App
  [CHANNELS.GET_APP_VERSION]: () =>
    ipcRenderer.invoke(CHANNELS.GET_APP_VERSION),
  // System
  [CHANNELS.GET_SYSTEM_INFO]: () =>
    ipcRenderer.invoke(CHANNELS.GET_SYSTEM_INFO),

  // Package
  [CHANNELS.PACKAGE_LIST]: () =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_LIST),
  [CHANNELS.PACKAGE_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_GET, args),
  [CHANNELS.PACKAGE_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_CREATE, args),
  [CHANNELS.PACKAGE_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_UPDATE, args),
  [CHANNELS.PACKAGE_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_DELETE, args),
  [CHANNELS.PACKAGE_LINK_RESOURCE]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_LINK_RESOURCE, args),
  [CHANNELS.PACKAGE_UNLINK_RESOURCE]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_UNLINK_RESOURCE, args),
  [CHANNELS.PACKAGE_GET_RESOURCES]: (args) =>
    ipcRenderer.invoke(CHANNELS.PACKAGE_GET_RESOURCES, args),

  // Connection
  [CHANNELS.CONNECTION_LIST]: () =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_LIST),
  [CHANNELS.CONNECTION_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_GET, args),
  [CHANNELS.CONNECTION_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_CREATE, args),
  [CHANNELS.CONNECTION_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_UPDATE, args),
  [CHANNELS.CONNECTION_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_DELETE, args),
  [CHANNELS.CONNECTION_TEST]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_TEST, args),
  [CHANNELS.CONNECTION_GET_PASSWORD]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_GET_PASSWORD, args),
  [CHANNELS.CONNECTION_REORDER]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_REORDER, args),
  [CHANNELS.CONNECTION_TEST_BY_ID]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_TEST_BY_ID, args),
  [CHANNELS.CONNECTION_SET_IGNORED]: (args) =>
    ipcRenderer.invoke(CHANNELS.CONNECTION_SET_IGNORED, args),

  // Diagram
  [CHANNELS.DIAGRAM_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_LIST, args),
  [CHANNELS.DIAGRAM_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_GET, args),
  [CHANNELS.DIAGRAM_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_CREATE, args),
  [CHANNELS.DIAGRAM_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_UPDATE, args),
  [CHANNELS.DIAGRAM_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_DELETE, args),
  [CHANNELS.DIAGRAM_UPDATE_META]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_UPDATE_META, args),
  [CHANNELS.DIAGRAM_GET_LAYOUT]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_GET_LAYOUT, args),
  [CHANNELS.DIAGRAM_SAVE_LAYOUT]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_SAVE_LAYOUT, args),
  [CHANNELS.DIAGRAM_CLONE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_CLONE, args),

  // Diagram Versions
  [CHANNELS.DIAGRAM_VERSION_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_LIST, args),
  [CHANNELS.DIAGRAM_VERSION_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_CREATE, args),
  [CHANNELS.DIAGRAM_VERSION_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_UPDATE, args),
  [CHANNELS.DIAGRAM_VERSION_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_DELETE, args),
  [CHANNELS.DIAGRAM_VERSION_RESTORE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_RESTORE, args),
  [CHANNELS.DIAGRAM_VERSIONS_REORDER]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSIONS_REORDER, args),
  [CHANNELS.DIAGRAM_VERSION_MOVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_MOVE, args),
  [CHANNELS.DIAGRAM_VERSION_COPY]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_VERSION_COPY, args),
  [CHANNELS.DIAGRAMS_REORDER]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAMS_REORDER, args),

  // Migration
  [CHANNELS.MIGRATION_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_LIST, args),
  [CHANNELS.MIGRATION_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_CREATE, args),
  [CHANNELS.MIGRATION_APPLY]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_APPLY, args),
  [CHANNELS.MIGRATION_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_DELETE, args),
  [CHANNELS.MIGRATION_ROLLBACK]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_ROLLBACK, args),

  // View Snapshot
  [CHANNELS.VIEW_SNAPSHOT_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.VIEW_SNAPSHOT_LIST, args),
  [CHANNELS.VIEW_SNAPSHOT_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.VIEW_SNAPSHOT_CREATE, args),
  [CHANNELS.VIEW_SNAPSHOT_RESTORE]: (args) =>
    ipcRenderer.invoke(CHANNELS.VIEW_SNAPSHOT_RESTORE, args),
  [CHANNELS.VIEW_SNAPSHOT_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.VIEW_SNAPSHOT_DELETE, args),

  // Diagram Hidden
  [CHANNELS.DIAGRAM_SET_HIDDEN]: (args) =>
    ipcRenderer.invoke(CHANNELS.DIAGRAM_SET_HIDDEN, args),

  // Schema (Real)
  [CHANNELS.SCHEMA_FETCH_REAL]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_FETCH_REAL, args),
  [CHANNELS.SCHEMA_SYNC_REAL]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SYNC_REAL, args),

  // Changelog
  [CHANNELS.CHANGELOG_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.CHANGELOG_LIST, args),
  [CHANNELS.CHANGELOG_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.CHANGELOG_DELETE, args),

  // Diff
  [CHANNELS.SCHEMA_DIFF]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_DIFF, args),
  [CHANNELS.SCHEMA_DIFF_VIRTUAL]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_DIFF_VIRTUAL, args),
  [CHANNELS.SCHEMA_APPLY_REAL_TO_VIRTUAL]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_APPLY_REAL_TO_VIRTUAL, args),

  // DDL
  [CHANNELS.DDL_PARSE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DDL_PARSE, args),
  [CHANNELS.DDL_GENERATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DDL_GENERATE, args),

  // Query
  [CHANNELS.QUERY_EXECUTE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QUERY_EXECUTE, args),
  [CHANNELS.QUERY_EXPLAIN_ANALYZE]: (args: any) =>
    ipcRenderer.invoke(CHANNELS.QUERY_EXPLAIN_ANALYZE, args),
  [CHANNELS.QUERY_LIST]: () =>
    ipcRenderer.invoke(CHANNELS.QUERY_LIST),
  [CHANNELS.QUERY_SAVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QUERY_SAVE, args),
  [CHANNELS.QUERY_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QUERY_UPDATE, args),
  [CHANNELS.QUERY_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QUERY_DELETE, args),
  [CHANNELS.QUERY_HISTORY_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.QUERY_HISTORY_LIST, args),

  // Document
  [CHANNELS.DOCUMENT_LIST]: () =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_LIST),
  [CHANNELS.DOCUMENT_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_GET, args),
  [CHANNELS.DOCUMENT_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_CREATE, args),
  [CHANNELS.DOCUMENT_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_UPDATE, args),
  [CHANNELS.DOCUMENT_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_DELETE, args),
  [CHANNELS.DOCUMENT_AUTO_GENERATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_AUTO_GENERATE, args),
  [CHANNELS.DOCUMENT_EXPORT]: (args) =>
    ipcRenderer.invoke(CHANNELS.DOCUMENT_EXPORT, args),

  // Validation
  [CHANNELS.VALIDATION_RUN]: (args) =>
    ipcRenderer.invoke(CHANNELS.VALIDATION_RUN, args),

  // Mocking
  [CHANNELS.MOCK_GENERATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.MOCK_GENERATE, args),
  [CHANNELS.MOCK_EXPORT]: (args) =>
    ipcRenderer.invoke(CHANNELS.MOCK_EXPORT, args),

  // Schema Snapshot
  [CHANNELS.SCHEMA_SNAPSHOT_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SNAPSHOT_LIST, args),
  [CHANNELS.SCHEMA_SNAPSHOT_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SNAPSHOT_CREATE, args),
  [CHANNELS.SCHEMA_SNAPSHOT_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SNAPSHOT_GET, args),
  [CHANNELS.SCHEMA_SNAPSHOT_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SNAPSHOT_DELETE, args),
  [CHANNELS.SCHEMA_SNAPSHOT_RENAME]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SNAPSHOT_RENAME, args),
  [CHANNELS.SCHEMA_SNAPSHOT_VALIDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_SNAPSHOT_VALIDATE, args),

  // Migration Pack
  [CHANNELS.MIGRATION_PACK_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_LIST, args),
  [CHANNELS.MIGRATION_PACK_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_CREATE, args),
  [CHANNELS.MIGRATION_PACK_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_GET, args),
  [CHANNELS.MIGRATION_PACK_UPDATE_DML]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_UPDATE_DML, args),
  [CHANNELS.MIGRATION_PACK_EXECUTE]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_EXECUTE, args),
  [CHANNELS.MIGRATION_PACK_ROLLBACK]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_ROLLBACK, args),
  [CHANNELS.MIGRATION_PACK_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.MIGRATION_PACK_DELETE, args),

  // Drift Detection
  [CHANNELS.DRIFT_LIGHTWEIGHT_CHECK]: (args) =>
    ipcRenderer.invoke(CHANNELS.DRIFT_LIGHTWEIGHT_CHECK, args),
  [CHANNELS.DRIFT_FULL_CHECK]: (args) =>
    ipcRenderer.invoke(CHANNELS.DRIFT_FULL_CHECK, args),

  // Seed
  [CHANNELS.SEED_LIST]: () =>
    ipcRenderer.invoke(CHANNELS.SEED_LIST),
  [CHANNELS.SEED_CREATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SEED_CREATE, args),
  [CHANNELS.SEED_UPDATE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SEED_UPDATE, args),
  [CHANNELS.SEED_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SEED_DELETE, args),
  [CHANNELS.SEED_CAPTURE]: (args) =>
    ipcRenderer.invoke(CHANNELS.SEED_CAPTURE, args),

  // Schema Objects Introspection
  [CHANNELS.SCHEMA_OBJECTS_FETCH]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_OBJECTS_FETCH, args),
  [CHANNELS.SCHEMA_OBJECT_DDL]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_OBJECT_DDL, args),

  // Query Safety
  [CHANNELS.QUERY_CLASSIFY_SAFETY]: (args) =>
    ipcRenderer.invoke(CHANNELS.QUERY_CLASSIFY_SAFETY, args),

  // Object Browser
  [CHANNELS.OB_TABLE_STATISTICS]: (args) =>
    ipcRenderer.invoke(CHANNELS.OB_TABLE_STATISTICS, args),
  [CHANNELS.OB_SQLITE_PRAGMA]: (args) =>
    ipcRenderer.invoke(CHANNELS.OB_SQLITE_PRAGMA, args),
  [CHANNELS.OB_SQLITE_DB_INFO]: (args) =>
    ipcRenderer.invoke(CHANNELS.OB_SQLITE_DB_INFO, args),

  // Seed (missing entries)
  [CHANNELS.SEED_CAPTURE_WITH_FK]: (args) =>
    ipcRenderer.invoke(CHANNELS.SEED_CAPTURE_WITH_FK, args),
  [CHANNELS.SEED_APPLY]: (args) =>
    ipcRenderer.invoke(CHANNELS.SEED_APPLY, args),

  // Forward (missing entries)
  [CHANNELS.FORWARD_PRE_CHECK]: (args) =>
    ipcRenderer.invoke(CHANNELS.FORWARD_PRE_CHECK, args),
  [CHANNELS.FORWARD_EXECUTE_STEP]: (args) =>
    ipcRenderer.invoke(CHANNELS.FORWARD_EXECUTE_STEP, args),
  [CHANNELS.FORWARD_ROLLBACK]: (args) =>
    ipcRenderer.invoke(CHANNELS.FORWARD_ROLLBACK, args),

  // Mocking (missing entry)
  [CHANNELS.MOCK_APPLY]: (args) =>
    ipcRenderer.invoke(CHANNELS.MOCK_APPLY, args),

  // Composite
  [CHANNELS.SCHEMA_VALIDATE_AGAINST_VERSION]: (args) =>
    ipcRenderer.invoke(CHANNELS.SCHEMA_VALIDATE_AGAINST_VERSION, args),

  // Query Browser - Query Tree
  [CHANNELS.QB_QUERY_TREE_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_TREE_LIST, args),
  [CHANNELS.QB_QUERY_FOLDER_SAVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_FOLDER_SAVE, args),
  [CHANNELS.QB_QUERY_FOLDER_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_FOLDER_DELETE, args),
  [CHANNELS.QB_QUERY_SAVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_SAVE, args),
  [CHANNELS.QB_QUERY_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_GET, args),
  [CHANNELS.QB_QUERY_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_DELETE, args),
  [CHANNELS.QB_QUERY_BULK_MOVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_QUERY_BULK_MOVE, args),

  // Query Browser - Collection Tree
  [CHANNELS.QB_COLLECTION_TREE_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_TREE_LIST, args),
  [CHANNELS.QB_COLLECTION_FOLDER_SAVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_FOLDER_SAVE, args),
  [CHANNELS.QB_COLLECTION_FOLDER_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_FOLDER_DELETE, args),
  [CHANNELS.QB_COLLECTION_SAVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_SAVE, args),
  [CHANNELS.QB_COLLECTION_GET]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_GET, args),
  [CHANNELS.QB_COLLECTION_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_DELETE, args),
  [CHANNELS.QB_COLLECTION_ITEM_SAVE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_COLLECTION_ITEM_SAVE, args),

  // Query Browser - Transaction
  [CHANNELS.QB_TX_BEGIN]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_TX_BEGIN, args),
  [CHANNELS.QB_TX_EXECUTE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_TX_EXECUTE, args),
  [CHANNELS.QB_TX_COMMIT]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_TX_COMMIT, args),
  [CHANNELS.QB_TX_ROLLBACK]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_TX_ROLLBACK, args),

  // Query Browser - History
  [CHANNELS.QB_HISTORY_LIST]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_HISTORY_LIST, args),
  [CHANNELS.QB_HISTORY_DELETE]: (args) =>
    ipcRenderer.invoke(CHANNELS.QB_HISTORY_DELETE, args),
};

contextBridge.exposeInMainWorld('electronAPI', API);
