import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DdlView } from '../shared/DdlView';
import type { ICustomType } from '~/shared/types/db';

interface DomainDetailProps {
  domain: ICustomType;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'ddl', label: 'DDL' },
];

export function DomainDetail({ domain, connectionId }: DomainDetailProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="domain" name={domain.name} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <KeyValueGrid
            items={[
              { key: 'Type', value: domain.type },
              { key: 'Definition', value: domain.definition || '-' },
            ]}
          />
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="domain" objectName={domain.name} />
        )}
      </div>
    </div>
  );
}
