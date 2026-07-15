import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DdlView } from '../shared/DdlView';
import type { ITrigger } from '~/shared/types/db';

interface TriggerDetailProps {
  trigger: ITrigger;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'source', label: 'Source' },
  { id: 'ddl', label: 'DDL' },
];

export function TriggerDetail({ trigger, connectionId }: TriggerDetailProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="trigger" name={trigger.name} tableName={trigger.tableName} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <KeyValueGrid
            items={[
              { key: 'Table', value: trigger.tableName },
              { key: 'Timing', value: trigger.timing },
              { key: 'Events', value: trigger.event },
              { key: 'Comment', value: trigger.comment ?? '-' },
            ]}
          />
        )}
        {activeTab === 'source' && (
          <div className="p-4">
            <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[600px] whitespace-pre-wrap">
              {trigger.definition || 'No source available'}
            </pre>
          </div>
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="trigger" objectName={trigger.name} />
        )}
      </div>
    </div>
  );
}
