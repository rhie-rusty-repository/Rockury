import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DdlView } from '../shared/DdlView';
import type { IDbEvent } from '~/shared/types/db';

interface EventDetailProps {
  event: IDbEvent;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'source', label: 'Source' },
  { id: 'ddl', label: 'DDL' },
];

export function EventDetail({ event, connectionId }: EventDetailProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="event" name={event.name} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <KeyValueGrid
            items={[
              { key: 'Status', value: event.status },
              { key: 'Schedule', value: event.schedule },
              { key: 'Comment', value: event.comment ?? '-' },
            ]}
          />
        )}
        {activeTab === 'source' && (
          <div className="p-4">
            <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[600px] whitespace-pre-wrap">
              {event.definition || 'No source available'}
            </pre>
          </div>
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="event" objectName={event.name} />
        )}
      </div>
    </div>
  );
}
