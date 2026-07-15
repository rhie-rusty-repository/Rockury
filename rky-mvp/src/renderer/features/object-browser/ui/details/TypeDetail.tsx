import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DataTable } from '../shared/DataTable';
import { DdlView } from '../shared/DdlView';
import type { ICustomType } from '~/shared/types/db';

interface TypeDetailProps {
  customType: ICustomType;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'ddl', label: 'DDL' },
];

export function TypeDetail({ customType, connectionId }: TypeDetailProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="type" name={customType.name} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <>
            <KeyValueGrid items={[{ key: 'Type', value: customType.type }]} />
            {customType.type === 'enum' && customType.values && (
              <div className="px-4 pb-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">Values</div>
                <div className="flex flex-wrap gap-1.5">
                  {customType.values.map((v) => (
                    <span key={v} className="rounded bg-muted px-2 py-0.5 text-xs">{v}</span>
                  ))}
                </div>
              </div>
            )}
            {customType.type === 'composite' && customType.attributes && (
              <div className="px-4 pb-4">
                <DataTable
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'type', label: 'Type' },
                  ]}
                  rows={customType.attributes.map((a) => ({
                    name: a.name,
                    type: a.dataType,
                  }))}
                />
              </div>
            )}
          </>
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="type" objectName={customType.name} />
        )}
      </div>
    </div>
  );
}
