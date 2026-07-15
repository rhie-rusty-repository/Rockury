import { useState, useMemo } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { DataTable } from '../shared/DataTable';
import { DdlView } from '../shared/DdlView';
import type { ISchemaView, ISchemaObjects } from '~/shared/types/db';

interface ViewDetailProps {
  view: ISchemaView;
  connectionId: string;
  schemaObjects: Partial<ISchemaObjects>;
}

export function ViewDetail({ view, connectionId, schemaObjects }: ViewDetailProps) {
  const isMaterialized = view.isMaterialized;
  const tabs = useMemo(() => {
    const t = [{ id: 'columns', label: 'Columns' }];
    if (isMaterialized) {
      t.push({ id: 'indexes', label: 'Indexes' });
      t.push({ id: 'statistics', label: 'Statistics' });
    }
    t.push({ id: 'ddl', label: 'DDL' });
    return t;
  }, [isMaterialized]);

  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const objectType = isMaterialized ? 'materialized_view' : 'view';

  const indexes = useMemo(
    () => (schemaObjects.indexes ?? []).filter((i) => i.tableName === view.name),
    [schemaObjects.indexes, view.name],
  );

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type={objectType} name={view.name} />
      <DetailSubTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'columns' && (
          <DataTable
            columns={[
              { key: '#', label: '#', className: 'w-10' },
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type' },
              { key: 'nullable', label: 'Nullable', className: 'w-20' },
            ]}
            rows={view.columns.map((col, i) => ({
              '#': i + 1,
              name: col.name,
              type: col.dataType,
              nullable: col.nullable ? 'YES' : 'NO',
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
        {activeTab === 'statistics' && (
          <div className="p-4 text-xs text-muted-foreground">Statistics not yet available</div>
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType={objectType} objectName={view.name} />
        )}
      </div>
    </div>
  );
}
