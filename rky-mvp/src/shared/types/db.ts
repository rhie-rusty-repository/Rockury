// ─── DB Type ───
export type TDbType = 'mysql' | 'mariadb' | 'postgresql' | 'sqlite';

// ─── Key / Constraint Types ───
export type TKeyType = 'PK' | 'FK' | 'UK' | 'IDX';
export type TConstraintType = 'PK' | 'FK' | 'UK' | 'IDX' | 'CHECK' | 'NOT_NULL';

// ─── Schema Object Types ───
export type TSchemaObjectType =
  | 'table' | 'view' | 'materialized_view'
  | 'function' | 'procedure' | 'trigger' | 'event'
  | 'type' | 'sequence' | 'index'
  | 'partition' | 'role' | 'policy' | 'grant'
  | 'extension' | 'schema' | 'foreign_table'
  | 'tablespace' | 'collation' | 'domain';

export interface ISchemaObjectCategory {
  id: string;
  label: string;
  types: TSchemaObjectType[];
}

export const SCHEMA_OBJECT_CATEGORIES: ISchemaObjectCategory[] = [
  { id: 'core', label: 'Core', types: ['table', 'view', 'materialized_view', 'index'] },
  { id: 'routines', label: 'Routines', types: ['procedure', 'function', 'trigger', 'event'] },
  { id: 'definitions', label: 'Definitions', types: ['type', 'sequence', 'domain'] },
  { id: 'partitioning', label: 'Partitioning', types: ['partition'] },
  { id: 'security', label: 'Security', types: ['role', 'policy', 'grant'] },
  { id: 'advanced', label: 'Advanced', types: ['extension', 'schema', 'foreign_table', 'tablespace', 'collation'] },
];

export interface ISchemaView {
  name: string;
  definition: string;
  isMaterialized: boolean;
  columns: IColumn[];
  comment?: string;
}

export interface IRoutine {
  name: string;
  type: 'function' | 'procedure';
  definition: string;
  language?: string;
  returnType?: string;
  parameters: { name: string; dataType: string; mode: 'IN' | 'OUT' | 'INOUT' }[];
  comment?: string;
}

export interface ITrigger {
  name: string;
  tableName: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  definition: string;
  comment?: string;
}

export interface IDbEvent {
  name: string;
  schedule: string;
  definition: string;
  status: 'ENABLED' | 'DISABLED';
  comment?: string;
}

export interface ICustomType {
  name: string;
  type: 'enum' | 'composite' | 'domain';
  values?: string[];
  attributes?: { name: string; dataType: string }[];
  definition: string;
}

export interface ISequence {
  name: string;
  dataType: string;
  startValue: number;
  increment: number;
  minValue?: number;
  maxValue?: number;
  currentValue?: number;
  isCyclic: boolean;
}

export interface ISchemaIndex {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  type?: string;
  definition: string;
}

// ─── Category 8: Partitioning ───
export interface IPartitionEntry {
  name: string;
  bound?: string;
  values?: string[];
  modulus?: number;
  remainder?: number;
}

export interface IPartition {
  name: string;
  tableName: string;
  strategy: 'range' | 'list' | 'hash';
  expression: string;
  partitions: IPartitionEntry[];
  comment?: string;
}

// ─── Category 9: Security ───
export interface IRole {
  name: string;
  isLogin: boolean;
  isSuperuser: boolean;
  inherits: boolean;
  memberOf: string[];
  comment?: string;
}

export interface IRlsPolicy {
  name: string;
  tableName: string;
  command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  roles: string[];
  using?: string;
  withCheck?: string;
  comment?: string;
}

export interface IGrant {
  objectType: 'table' | 'schema' | 'function' | 'sequence';
  objectName: string;
  grantee: string;
  privileges: string[];
  withGrantOption: boolean;
}

// ─── Category 10: Advanced ───
export interface IExtension {
  name: string;
  version?: string;
  schema?: string;
  comment?: string;
}

export interface IForeignTable {
  name: string;
  serverName: string;
  columns: IColumn[];
  options: Record<string, string>;
  comment?: string;
}

export interface ISchemaNamespace {
  name: string;
  owner?: string;
  comment?: string;
}

export interface ITablespace {
  name: string;
  location?: string;
  options?: Record<string, string>;
  comment?: string;
}

export interface ICollationDef {
  name: string;
  provider: 'icu' | 'libc';
  locale?: string;
  comment?: string;
}

// ─── Schema Objects Container ───
export interface ISchemaObjects {
  tables: ITable[];
  views: ISchemaView[];
  functions: IRoutine[];
  procedures: IRoutine[];
  triggers: ITrigger[];
  events: IDbEvent[];
  types: ICustomType[];
  sequences: ISequence[];
  indexes: ISchemaIndex[];
  partitions: IPartition[];
  roles: IRole[];
  policies: IRlsPolicy[];
  grants: IGrant[];
  extensions: IExtension[];
  schemas: ISchemaNamespace[];
  foreignTables: IForeignTable[];
  tablespaces: ITablespace[];
  collations: ICollationDef[];
}

// ─── Dialect ───
export interface IDialectInfo {
  dbType: TDbType;
  supportedObjects: TSchemaObjectType[];
  name: string;
}

export const DIALECT_INFO: Record<TDbType, IDialectInfo> = {
  mysql: {
    dbType: 'mysql',
    name: 'MySQL',
    supportedObjects: [
      'table', 'view', 'index', 'function', 'procedure', 'trigger', 'event',
      'partition', 'role', 'grant', 'collation',
    ],
  },
  mariadb: {
    dbType: 'mariadb',
    name: 'MariaDB',
    supportedObjects: [
      'table', 'view', 'index', 'function', 'procedure', 'trigger', 'event', 'sequence',
      'partition', 'role', 'grant', 'collation',
    ],
  },
  postgresql: {
    dbType: 'postgresql',
    name: 'PostgreSQL',
    supportedObjects: [
      'table', 'view', 'materialized_view', 'index', 'function', 'procedure', 'trigger', 'type', 'sequence',
      'partition', 'role', 'policy', 'grant', 'extension', 'schema', 'foreign_table', 'tablespace', 'collation', 'domain',
    ],
  },
  sqlite: {
    dbType: 'sqlite',
    name: 'SQLite',
    supportedObjects: ['table', 'view', 'index', 'trigger'],
  },
};

// ─── Query Safety ───
export type TQuerySafetyLevel = 'safe' | 'caution' | 'destructive';
export type TConnectionPermissionMode = 'read_only' | 'cautious' | 'full_access';

// ─── Package ───
export interface IPackage {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type TResourceType = 'connection' | 'diagram' | 'query' | 'document';

export interface IPackageResource {
  id: string;
  packageId: string;
  resourceType: TResourceType;
  resourceId: string;
  isShared: boolean;
}

// ─── Connection ───
export interface IConnection {
  id: string;
  name: string;
  dbType: TDbType;
  host: string;
  port: number;
  database: string;
  username: string;
  sslEnabled: boolean;
  sslConfig?: Record<string, unknown>;
  ignored: boolean;
  ignorePatterns: string[];
  permissionMode: TConnectionPermissionMode;
  createdAt: string;
  updatedAt: string;
}

export interface IConnectionFormData {
  name: string;
  dbType: TDbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
  sslConfig?: Record<string, unknown>;
  ignorePatterns?: string[];
  permissionMode?: TConnectionPermissionMode;
}

export type TConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing' | 'ignored';

export interface IConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  serverVersion?: string;
}

// ─── Column ───
export interface IColumn {
  id: string;
  name: string;
  dataType: string;
  keyTypes: TKeyType[];
  isAutoIncrement?: boolean;
  isGenerated?: boolean;
  generationExpression?: string;
  defaultValue: string | null;
  nullable: boolean;
  comment: string;
  reference: IForeignKeyRef | null;
  constraints: IConstraint[];
  ordinalPosition: number;
}

export interface IForeignKeyRef {
  table: string;
  column: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
}

export interface IConstraint {
  type: TConstraintType;
  name: string;
  columns: string[];
  reference?: IForeignKeyRef;
  checkExpression?: string;
}

// ─── Table ───
export interface ITable {
  id: string;
  name: string;
  comment: string;
  columns: IColumn[];
  constraints: IConstraint[];
  engine?: string;
  charset?: string;
  isView?: boolean;
  isMaterialized?: boolean;
  viewDefinition?: string;
  isPartition?: boolean;
  parentTableName?: string;
}

// ─── Diagram ───
export type TDiagramType = 'virtual' | 'real';

export interface IDiagram {
  id: string;
  name: string;
  version: string;
  type: TDiagramType;
  tables: ITable[];
  description?: string;
  hidden?: boolean;
  connectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDiagramSnapshot extends IDiagram {
  layout?: {
    positions: Record<string, { x: number; y: number }>;
    zoom: number;
    viewport: { x: number; y: number };
    hiddenTableIds?: string[];
    tableColors?: Record<string, string>;
  };
}

export interface IDiagramLayout {
  diagramId: string;
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  viewport: { x: number; y: number };
  hiddenTableIds?: string[];
  tableColors?: Record<string, string>;
}

export interface IDiagramVersion {
  id: string;
  diagramId: string;
  versionNumber: number;
  name: string;
  ddlContent: string;
  schemaSnapshot: IDiagramSnapshot;
  sortOrder: number;
  isLocked: boolean;
  createdAt: string;
}

// ─── Diagram Filter ───
export type TFilterPreset = 'compact' | 'full' | 'custom';

export interface IDiagramFilter {
  showColumns: boolean;
  showDataTypes: boolean;
  showKeyIcons: boolean;
  showNullable: boolean;
  showDefaults: boolean;
  showComments: boolean;
  showConstraints: boolean;
  showEdgePolicies: boolean;
  showViews: boolean;
  preset: TFilterPreset;
  // Edge constraint filters (show edges matching these actions)
  edgeOnDelete: Record<string, boolean>;
  edgeOnUpdate: Record<string, boolean>;
}

// ─── Search Result ───
export interface ISearchResult {
  type: 'table' | 'column' | 'constraint';
  tableId: string;
  tableName: string;
  columnId?: string;
  columnName?: string;
  constraintName?: string;
  matchedText: string;
}

// ─── Migration ───
export type TMigrationDirection = 'virtual_to_real' | 'real_to_virtual';
export type TMigrationStatus = 'pending' | 'applied' | 'failed' | 'rolled_back';

export interface IMigration {
  id: string;
  diagramId: string;
  connectionId: string;
  versionNumber: number;
  direction: TMigrationDirection;
  diffSnapshot: IDiffResult;
  migrationDdl: string;
  rollbackDdl?: string;
  status: TMigrationStatus;
  appliedAt: string | null;
  createdAt: string;
}

// ─── View Snapshot ───
export interface IViewSnapshot {
  id: string;
  diagramId: string;
  name: string;
  filter: IDiagramFilter;
  layout: IDiagramLayout;
  createdAt: string;
}

// ─── Diff ───
export type TDiffMode = 'virtual_vs_real' | 'virtual_vs_virtual';
export type TDiffAction = 'added' | 'removed' | 'modified';

export interface ITableDiff {
  tableName: string;
  action: TDiffAction;
  columnDiffs: IColumnDiff[];
  constraintDiffs: IConstraintDiff[];
}

export interface IColumnDiff {
  columnName: string;
  action: TDiffAction;
  virtualValue?: Partial<IColumn>;
  realValue?: Partial<IColumn>;
  changes?: string[];
}

export interface IConstraintDiff {
  constraintName: string;
  action: TDiffAction;
  virtualValue?: IConstraint;
  realValue?: IConstraint;
}

export interface IDiffResult {
  virtualDiagramId: string;
  realDiagramId: string;
  tableDiffs: ITableDiff[];
  hasDifferences: boolean;
  migrationDdl: string;
  rollbackDdl: string;
  comparedAt: string;
  mode?: TDiffMode;
  sourceName?: string;
  targetName?: string;
  sourceVersionId?: string;
  targetVersionId?: string;
}

// ─── Schema Changelog ───
export interface ISchemaChangelog {
  id: string;
  connectionId: string;
  diagramId: string;
  changes: ISchemaChange[];
  syncedAt: string;
}

export interface ISchemaChange {
  tableName: string;
  action: TDiffAction;
  columnChanges: IColumnChange[];
}

export interface IColumnChange {
  columnName: string;
  action: TDiffAction;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

// ─── Query ───
export interface IQuery {
  id: string;
  name: string;
  description: string;
  sqlContent: string;
  tags: string[];
  connectionId?: string;
  folderId?: string | null;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export type TQueryStatus = 'success' | 'error';

export interface IQueryHistory {
  id: string;
  queryId: string | null;
  sqlContent: string;
  executionTimeMs: number;
  rowCount: number;
  status: TQueryStatus;
  errorMessage: string | null;
  connectionId?: string;
  source?: THistorySource;
  affectedTables?: string[];
  affectedRows?: number;
  dmlType?: TDmlType;
  explainSummary?: string;
  executedAt: string;
}

export interface IQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  affectedRows?: number;
}

export interface IExplainResult {
  planRows: Record<string, unknown>[];
  summary: string;
  rawJson?: unknown;
}

// ─── Document ───
export interface IDocument {
  id: string;
  name: string;
  content: string;
  autoGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TExportFormat = 'markdown' | 'pdf' | 'png' | 'svg';

// ─── Validation ───
export type TValidationSeverity = 'error' | 'warning' | 'info';

export interface IValidationItem {
  severity: TValidationSeverity;
  category: string;
  tableName: string;
  columnName?: string;
  message: string;
  suggestion?: string;
}

export interface IValidationReport {
  items: IValidationItem[];
  errors: IValidationItem[];
  warnings: IValidationItem[];
  isValid: boolean;
  summary: { errors: number; warnings: number; infos: number };
  validatedAt: string;
}

// ─── Schema Snapshot ───
export interface ISchemaSnapshot {
  id: string;
  connectionId: string;
  name: string;
  tables: ITable[];
  schemaObjects?: Partial<ISchemaObjects>;
  metadata: {
    dbType: TDbType;
    serverVersion?: string;
    tableCount: number;
    database: string;
  };
  checksum: string;
  status: TSnapshotStatus;
  validatedAt?: string;
  isValid?: boolean;
  createdAt: string;
}

export interface IValidationResult {
  snapshotId: string;
  connectionId: string;
  isValid: boolean;
  matchedTables: number;
  totalTables: number;
  diffs: ITableDiff[];
  checkedAt: string;
}

// ─── Migration Pack ───
export type TMigrationPackStatus =
  | 'draft'
  | 'reviewed'
  | 'executing'
  | 'applied'
  | 'failed'
  | 'rolled_back';

export interface IMigrationPack {
  id: string;
  connectionId: string;
  diagramId: string;
  sourceVersionId: string | null;
  targetVersionId: string;
  preSnapshotId?: string;
  diff: IDiffResult;
  updateDdl: string;
  seedDml: string;
  rollbackDdl: string;
  status: TMigrationPackStatus;
  executionLog?: IMigrationLog[];
  appliedAt?: string;
  rolledBackAt?: string;
  postSnapshotId?: string;
  createdAt: string;
}

export interface IMigrationLog {
  statementIndex: number;
  sql: string;
  phase: 'ddl' | 'dml' | 'rollback';
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  executedAt: string;
}

// ─── Seed ───
export interface ISeedFile {
  id: string;
  name: string;
  description: string;
  dmlContent: string;
  targetTables: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Mocking ───
export type TMockingEnvironment = 'local' | 'dev' | 'qa' | 'production';

export interface IMockingProfile {
  id: string;
  name: string;
  environment: TMockingEnvironment;
  strategy: Record<string, { rowCount: number; generatorType: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface IMockTableData {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface IMockResult {
  tables: IMockTableData[];
  generatedAt: string;
}

// ─── Validation Suite ───
export type TValidationCheckType = 'schema' | 'data' | 'query' | 'fk';

export interface IValidationCheck {
  id: string;
  ruleId: string;
  type: TValidationCheckType;
  expression: string;
  expectedResult?: string;
}

export interface IValidationRule {
  id: string;
  suiteId: string;
  name: string;
  description: string;
  checks: IValidationCheck[];
}

export interface IValidationSuite {
  id: string;
  name: string;
  description: string;
  rules: IValidationRule[];
  createdAt: string;
  updatedAt: string;
}

export type TValidationRunStatus = 'running' | 'passed' | 'failed' | 'error';

export interface IValidationRunResult {
  id: string;
  suiteId: string;
  connectionId: string;
  status: TValidationRunStatus;
  results: { ruleId: string; checkId: string; passed: boolean; actual?: string; error?: string }[];
  startedAt: string;
  completedAt?: string;
}

// ─── Drift Detection ───
export type TDriftStatus = 'fresh' | 'stale' | 'drifted' | 'archived';

export interface IDriftEvent {
  id: string;
  connectionId: string;
  status: TDriftStatus;
  changes: ISchemaChange[];
  correspondingDdl: string;
  previousSnapshotId?: string;
  newSnapshotId?: string;
  detectedAt: string;
}

// ─── Snapshot (extended) ───
export type TSnapshotStatus = 'fresh' | 'stale' | 'drifted' | 'archived';

export interface ISnapshot {
  id: string;
  connectionId: string;
  name: string;
  tables: ITable[];
  seedData?: ISeedFile[];
  ignoredPatterns: string[];
  status: TSnapshotStatus;
  checksum: string;
  metadata: {
    dbType: TDbType;
    serverVersion?: string;
    tableCount: number;
    database: string;
  };
  createdAt: string;
}

// ─── Drift Check Result ───
export interface IDriftCheckResult {
  connectionId: string;
  hasDrift: boolean;
  checkType: 'lightweight' | 'full';
  lightweightHash?: string;
  previousHash?: string;
  changes: ISchemaChange[];
  correspondingDdl: string;
  checkedAt: string;
}

// ─── Query Browser ───
export interface IQueryFolder {
  id: string;
  connectionId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICollectionFolder {
  id: string;
  connectionId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICollection {
  id: string;
  connectionId: string;
  folderId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICollectionItem {
  id: string;
  collectionId: string;
  queryId: string;
  sortOrder: number;
  queryName?: string;
  queryDescription?: string;
  sqlContent?: string;
}

export type THistorySource = 'query' | 'data' | 'collection';
export type TDmlType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL';

// ─── Object Browser ───
export interface ITableStatistics {
  rowCountEstimate: number;
  totalSize: string;
  dataSize: string;
  indexSize: string;
  deadTuples?: number;
  lastAnalyzed?: string;
}

export interface ISqlitePragmaResult {
  tableInfo: { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[];
  foreignKeyList: { id: number; seq: number; table: string; from: string; to: string; on_update: string; on_delete: string }[];
  indexList: { seq: number; name: string; unique: number; origin: string; partial: number }[];
}

export interface ISqliteDbInfo {
  filePath: string;
  fileSize: string;
  sqliteVersion: string;
  pageSize: number;
  pageCount: number;
}
