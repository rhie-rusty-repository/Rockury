import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, Search, Key, ArrowRight, FileText, HardDrive, Tag, Ruler } from 'lucide-react';
import { useObjectBrowserStore } from '../model/objectBrowserStore';
import { useSqliteDbInfo } from '../model/useObjectDetail';
import type { IVendorObjectConfig, TObjectType, TTableChildType } from '../lib/vendorConfig';
import type { IObjectTab } from '../model/objectBrowserStore';
import type { TDbType, ISchemaObjects, ITable, IColumn } from '~/shared/types/db';

interface ObjectTreeProps {
  connectionId: string;
  dbType: TDbType;
  vendorConfig: IVendorObjectConfig;
  schemaObjects: Partial<ISchemaObjects>;
  isLoading: boolean;
  onRefresh: () => void;
}

// ─── helpers ───

function getObjectsForCategory(type: TObjectType, objects: Partial<ISchemaObjects>): { name: string; tableName?: string }[] {
  switch (type) {
    case 'table':
      return (objects.tables ?? []).filter((t) => !t.isView).map((t) => ({ name: t.name }));
    case 'view':
      return (objects.views ?? []).filter((v) => !v.isMaterialized).map((v) => ({ name: v.name }));
    case 'materialized_view':
      return (objects.views ?? []).filter((v) => v.isMaterialized).map((v) => ({ name: v.name }));
    case 'function':
      return (objects.functions ?? []).map((f) => ({ name: f.name }));
    case 'procedure':
      return (objects.procedures ?? []).map((p) => ({ name: p.name }));
    case 'trigger':
      return (objects.triggers ?? []).map((t) => ({ name: t.name, tableName: t.tableName }));
    case 'sequence':
      return (objects.sequences ?? []).map((s) => ({ name: s.name }));
    case 'event':
      return (objects.events ?? []).map((e) => ({ name: e.name }));
    case 'type':
      return (objects.types ?? []).filter((t) => t.type !== 'domain').map((t) => ({ name: t.name }));
    case 'extension':
      return (objects.extensions ?? []).map((e) => ({ name: e.name }));
    case 'policy':
      return (objects.policies ?? []).map((p) => ({ name: p.name, tableName: p.tableName }));
    case 'domain':
      return (objects.types ?? []).filter((t) => t.type === 'domain').map((t) => ({ name: t.name }));
    default:
      return [];
  }
}

function getTableByName(objects: Partial<ISchemaObjects>, name: string): ITable | undefined {
  return objects.tables?.find((t) => t.name === name);
}

function getChildObjects(childType: TTableChildType, table: ITable, objects: Partial<ISchemaObjects>): { name: string; extra?: string }[] {
  switch (childType) {
    case 'columns':
      return table.columns.map((c) => ({ name: c.name, extra: c.dataType }));
    case 'indexes':
      return (objects.indexes ?? [])
        .filter((i) => i.tableName === table.name)
        .map((i) => ({ name: i.name }));
    case 'triggers':
      return (objects.triggers ?? [])
        .filter((t) => t.tableName === table.name)
        .map((t) => ({ name: t.name }));
    case 'policies':
      return (objects.policies ?? [])
        .filter((p) => p.tableName === table.name)
        .map((p) => ({ name: p.name }));
    default:
      return [];
  }
}

function getColumnIcon(col: IColumn) {
  if (col.keyTypes.includes('PK')) return <Key className="h-3 w-3 text-amber-500 shrink-0" />;
  if (col.keyTypes.includes('FK')) return <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />;
  return <span className="w-3 text-center text-muted-foreground shrink-0">&middot;</span>;
}

const TABLE_CHILD_LABELS: Record<TTableChildType, string> = {
  columns: 'Columns',
  indexes: 'Indexes',
  triggers: 'Triggers',
  policies: 'Policies',
};

// ─── Component ───

export function ObjectTree({ connectionId, vendorConfig, schemaObjects, isLoading, onRefresh }: ObjectTreeProps) {
  const {
    expandedCategories,
    expandedObjects,
    expandedSubCategories,
    searchFilter,
    toggleCategory,
    toggleObject,
    toggleSubCategory,
    setSearchFilter,
    openTab,
  } = useObjectBrowserStore();

  const [searchInput, setSearchInput] = useState(searchFilter);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      const timeout = setTimeout(() => setSearchFilter(value), 200);
      return () => clearTimeout(timeout);
    },
    [setSearchFilter],
  );

  const handleObjectClick = useCallback(
    (type: TObjectType, name: string, tableName?: string) => {
      const tab: IObjectTab = {
        id: `${type}:${name}`,
        type,
        name,
        tableName,
      };
      openTab(tab);
    },
    [openTab],
  );

  // Filter objects by search
  const filteredCategories = useMemo(() => {
    const filter = searchFilter.toLowerCase();
    return vendorConfig.categories.map((catDef) => {
      const items = getObjectsForCategory(catDef.type, schemaObjects);
      const filtered = filter
        ? items.filter((item) => item.name.toLowerCase().includes(filter))
        : items;
      return { catDef, items: filtered, totalCount: items.length };
    }).filter((c) => !searchFilter || c.items.length > 0);
  }, [vendorConfig.categories, schemaObjects, searchFilter]);

  return (
    <>
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-full rounded border bg-background pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto text-xs py-1">
        {isLoading ? (
          <div className="px-3 py-2 text-muted-foreground">Loading...</div>
        ) : (
          filteredCategories.map(({ catDef, items, totalCount }) => {
            const catId = catDef.type;
            const isExpanded = expandedCategories.has(catId) || !!searchFilter;
            const Icon = catDef.icon;
            const count = searchFilter ? items.length : totalCount;

            return (
              <div key={catId}>
                {/* Category row */}
                <button
                  type="button"
                  onClick={() => toggleCategory(catId)}
                  className="flex w-full items-center gap-1 px-2 py-0.5 hover:bg-muted/50 text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium">{catDef.label}</span>
                  <span className="ml-auto text-muted-foreground text-[10px]">({count})</span>
                </button>

                {/* Objects */}
                {isExpanded && (
                  <div>
                    {items.length === 0 ? (
                      <div className="pl-8 py-0.5 text-muted-foreground italic">
                        No {catDef.label.toLowerCase()} found
                      </div>
                    ) : (
                      items.map((item) => (
                        <ObjectNode
                          key={`${catId}:${item.name}`}
                          type={catDef.type}
                          name={item.name}
                          tableName={item.tableName}
                          isDependentOnTable={catDef.isDependentOnTable}
                          tableChildren={catDef.type === 'table' ? vendorConfig.tableChildren : undefined}
                          schemaObjects={schemaObjects}
                          expandedObjects={expandedObjects}
                          expandedSubCategories={expandedSubCategories}
                          onToggleObject={toggleObject}
                          onToggleSubCategory={toggleSubCategory}
                          onObjectClick={handleObjectClick}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* SQLite DB Info */}
        {vendorConfig.showDbInfo && !isLoading && (
          <SqliteDbInfoSection connectionId={connectionId} />
        )}
      </div>

      {/* Refresh */}
      <div className="border-t p-1.5">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </>
  );
}

// ─── SQLite DB Info ───

function SqliteDbInfoSection({ connectionId }: { connectionId: string }) {
  const { data } = useSqliteDbInfo(connectionId);
  if (!data) return null;

  return (
    <div className="mt-2 border-t px-3 py-2">
      <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">DB Info</div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> <span className="truncate" title={data.filePath}>{data.filePath.split('/').pop()}</span></div>
        <div className="flex items-center gap-1.5"><HardDrive className="h-3 w-3" /> {data.fileSize}</div>
        <div className="flex items-center gap-1.5"><Tag className="h-3 w-3" /> SQLite {data.sqliteVersion}</div>
        <div className="flex items-center gap-1.5"><Ruler className="h-3 w-3" /> Page: {data.pageSize} ({data.pageCount.toLocaleString()} pages)</div>
      </div>
    </div>
  );
}

// ─── Object Node (table with sub-categories, or simple object) ───

interface ObjectNodeProps {
  type: TObjectType;
  name: string;
  tableName?: string;
  isDependentOnTable?: boolean;
  tableChildren?: TTableChildType[];
  schemaObjects: Partial<ISchemaObjects>;
  expandedObjects: Set<string>;
  expandedSubCategories: Set<string>;
  onToggleObject: (id: string) => void;
  onToggleSubCategory: (id: string) => void;
  onObjectClick: (type: TObjectType, name: string, tableName?: string) => void;
}

function ObjectNode({
  type,
  name,
  tableName,
  isDependentOnTable,
  tableChildren,
  schemaObjects,
  expandedObjects,
  expandedSubCategories,
  onToggleObject,
  onToggleSubCategory,
  onObjectClick,
}: ObjectNodeProps) {
  const objectId = `${type}:${name}`;
  const isTable = type === 'table';
  const hasChildren = isTable && tableChildren && tableChildren.length > 0;
  const isExpanded = expandedObjects.has(objectId);
  const table = isTable ? getTableByName(schemaObjects, name) : undefined;

  return (
    <div>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleObject(objectId)}
            className="pl-4 pr-0.5 py-0.5 text-muted-foreground hover:text-foreground"
          >
            {isExpanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="pl-4 pr-0.5 w-[22px]" />
        )}
        <button
          type="button"
          onClick={() => onObjectClick(type, name, tableName)}
          className="flex-1 flex items-center gap-1 py-0.5 pr-2 truncate hover:bg-muted/50 text-left"
        >
          <span className="truncate">{name}</span>
          {isDependentOnTable && tableName && (
            <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded px-1 shrink-0">
              {tableName}
            </span>
          )}
        </button>
      </div>

      {/* Table sub-categories */}
      {hasChildren && isExpanded && table && tableChildren.map((childType) => {
        const subId = `${objectId}:${childType}`;
        const isSubExpanded = expandedSubCategories.has(subId);
        const children = getChildObjects(childType, table, schemaObjects);

        return (
          <div key={subId}>
            <button
              type="button"
              onClick={() => onToggleSubCategory(subId)}
              className="flex w-full items-center gap-1 pl-9 pr-2 py-0.5 hover:bg-muted/50 text-left text-muted-foreground"
            >
              {isSubExpanded
                ? <ChevronDown className="h-2.5 w-2.5" />
                : <ChevronRight className="h-2.5 w-2.5" />}
              <span>{TABLE_CHILD_LABELS[childType]}</span>
              <span className="ml-auto text-[10px]">({children.length})</span>
            </button>

            {isSubExpanded && (
              <div>
                {childType === 'columns' && table.columns.map((col) => (
                  <div key={col.name} className="flex items-center gap-1 pl-14 pr-2 py-0.5 text-muted-foreground">
                    {getColumnIcon(col)}
                    <span className="truncate">{col.name}</span>
                    <span className="ml-auto text-[10px] opacity-60">{col.dataType}</span>
                  </div>
                ))}
                {childType !== 'columns' && children.map((child) => (
                  <button
                    key={child.name}
                    type="button"
                    onClick={() =>
                      onObjectClick(
                        childType === 'indexes' ? 'table' : (childType === 'triggers' ? 'trigger' : 'policy'),
                        childType === 'indexes' ? name : child.name,
                        childType === 'indexes' ? undefined : name,
                      )
                    }
                    className="flex w-full items-center gap-1 pl-14 pr-2 py-0.5 hover:bg-muted/50 text-left text-muted-foreground"
                  >
                    <span className="truncate">{child.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
