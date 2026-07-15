import { useState, useMemo } from 'react';
import { Key, ArrowRight } from 'lucide-react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { DataTable } from '../shared/DataTable';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DdlView } from '../shared/DdlView';
import { useTableStatistics, useSqlitePragma } from '../../model/useObjectDetail';
import type { TDbType, ITable, ISchemaObjects } from '~/shared/types/db';

interface TableDetailProps {
  table: ITable;
  connectionId: string;
  dbType: TDbType;
  schemaObjects: Partial<ISchemaObjects>;
}

function getTabs(dbType: TDbType) {
  const tabs = [
    { id: 'columns', label: 'Columns' },
  ];
  if (dbType === 'postgresql') tabs.push({ id: 'constraints', label: 'Constraints' });
  tabs.push({ id: 'indexes', label: 'Indexes' });
  tabs.push({ id: 'triggers', label: 'Triggers' });
  if (dbType !== 'sqlite') tabs.push({ id: 'statistics', label: 'Statistics' });
  tabs.push({ id: 'ddl', label: 'DDL' });
  if (dbType === 'sqlite') tabs.push({ id: 'pragma', label: 'PRAGMA' });
  return tabs;
}

export function TableDetail({ table, connectionId, dbType, schemaObjects }: TableDetailProps) {
  const tabs = useMemo(() => getTabs(dbType), [dbType]);
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const indexes = useMemo(
    () => (schemaObjects.indexes ?? []).filter((i) => i.tableName === table.name),
    [schemaObjects.indexes, table.name],
  );

  const triggers = useMemo(
    () => (schemaObjects.triggers ?? []).filter((t) => t.tableName === table.name),
    [schemaObjects.triggers, table.name],
  );

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="table" name={table.name} />
      <DetailSubTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-auto">
        {activeTab === 'columns' && (
          <DataTable
            columns={[
              { key: '#', label: '#', className: 'w-10' },
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type' },
              { key: 'nullable', label: 'Nullable', className: 'w-20' },
              { key: 'default', label: 'Default' },
              { key: 'pk', label: 'PK', className: 'w-10' },
              { key: 'fk', label: 'FK', className: 'w-10' },
            ]}
            rows={table.columns.map((col, i) => ({
              '#': i + 1,
              name: col.name,
              type: col.dataType,
              nullable: col.nullable ? 'YES' : 'NO',
              default: col.defaultValue ?? '',
              pk: col.keyTypes.includes('PK') ? <Key className="h-3 w-3 text-amber-500" /> : null,
              fk: col.keyTypes.includes('FK') ? <ArrowRight className="h-3 w-3 text-blue-500" /> : null,
            }))}
          />
        )}

        {activeTab === 'constraints' && (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type', className: 'w-20' },
              { key: 'columns', label: 'Columns' },
              { key: 'references', label: 'References' },
            ]}
            rows={table.constraints.map((c) => ({
              name: c.name,
              type: c.type,
              columns: c.columns.join(', '),
              references: c.reference ? `${c.reference.table}(${c.reference.column})` : '',
            }))}
          />
        )}

        {activeTab === 'indexes' && (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'columns', label: 'Columns' },
              { key: 'type', label: 'Type', className: 'w-24' },
              { key: 'unique', label: 'Unique', className: 'w-20' },
            ]}
            rows={indexes.map((idx) => ({
              name: idx.name,
              columns: idx.columns.join(', '),
              type: idx.type ?? '-',
              unique: idx.isUnique ? 'YES' : 'NO',
            }))}
          />
        )}

        {activeTab === 'triggers' && (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'timing', label: 'Timing' },
              { key: 'event', label: 'Events' },
            ]}
            rows={triggers.map((t) => ({
              name: t.name,
              timing: t.timing,
              event: t.event,
            }))}
          />
        )}

        {activeTab === 'statistics' && (
          <StatisticsTab connectionId={connectionId} tableName={table.name} />
        )}

        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="table" objectName={table.name} />
        )}

        {activeTab === 'pragma' && (
          <PragmaTab connectionId={connectionId} tableName={table.name} />
        )}
      </div>
    </div>
  );
}

function StatisticsTab({ connectionId, tableName }: { connectionId: string; tableName: string }) {
  const { data, isLoading, error } = useTableStatistics(connectionId, tableName);

  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading statistics...</div>;
  if (error) return <div className="p-4 text-xs text-destructive">Failed to load statistics</div>;
  if (!data) return null;

  return (
    <KeyValueGrid
      items={[
        { key: 'Row Count (est)', value: data.rowCountEstimate.toLocaleString() },
        { key: 'Total Size', value: data.totalSize },
        { key: 'Data Size', value: data.dataSize },
        { key: 'Index Size', value: data.indexSize },
        ...(data.deadTuples !== undefined ? [{ key: 'Dead Tuples', value: data.deadTuples.toLocaleString() }] : []),
        ...(data.lastAnalyzed ? [{ key: 'Last Analyzed', value: data.lastAnalyzed }] : []),
      ]}
    />
  );
}

function PragmaTab({ connectionId, tableName }: { connectionId: string; tableName: string }) {
  const { data, isLoading, error } = useSqlitePragma(connectionId, tableName);

  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading PRAGMA...</div>;
  if (error) return <div className="p-4 text-xs text-destructive">Failed to load PRAGMA</div>;
  if (!data) return null;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">table_info</h4>
        <DataTable
          columns={[
            { key: 'cid', label: '#', className: 'w-10' },
            { key: 'name', label: 'Name' },
            { key: 'type', label: 'Type' },
            { key: 'notnull', label: 'NOT NULL', className: 'w-20' },
            { key: 'dflt_value', label: 'Default' },
            { key: 'pk', label: 'PK', className: 'w-10' },
          ]}
          rows={data.tableInfo.map((r) => ({
            cid: r.cid,
            name: r.name,
            type: r.type,
            notnull: r.notnull ? 'YES' : 'NO',
            dflt_value: r.dflt_value ?? '',
            pk: r.pk ? 'YES' : '',
          }))}
        />
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">foreign_key_list</h4>
        <DataTable
          columns={[
            { key: 'table', label: 'Table' },
            { key: 'from', label: 'From' },
            { key: 'to', label: 'To' },
            { key: 'on_update', label: 'ON UPDATE' },
            { key: 'on_delete', label: 'ON DELETE' },
          ]}
          rows={data.foreignKeyList.map((r) => ({
            table: r.table,
            from: r.from,
            to: r.to,
            on_update: r.on_update,
            on_delete: r.on_delete,
          }))}
        />
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">index_list</h4>
        <DataTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'unique', label: 'Unique', className: 'w-20' },
            { key: 'origin', label: 'Origin' },
            { key: 'partial', label: 'Partial', className: 'w-20' },
          ]}
          rows={data.indexList.map((r) => ({
            name: r.name,
            unique: r.unique ? 'YES' : 'NO',
            origin: r.origin,
            partial: r.partial ? 'YES' : 'NO',
          }))}
        />
      </div>
    </div>
  );
}
