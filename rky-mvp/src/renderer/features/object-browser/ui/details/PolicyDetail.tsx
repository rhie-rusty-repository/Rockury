import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DdlView } from '../shared/DdlView';
import type { IRlsPolicy } from '~/shared/types/db';

interface PolicyDetailProps {
  policy: IRlsPolicy;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'ddl', label: 'DDL' },
];

export function PolicyDetail({ policy, connectionId }: PolicyDetailProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="policy" name={policy.name} tableName={policy.tableName} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <KeyValueGrid
            items={[
              { key: 'Table', value: policy.tableName },
              { key: 'Command', value: policy.command },
              { key: 'Roles', value: policy.roles.join(', ') || '-' },
              { key: 'USING', value: policy.using ? <code className="text-xs bg-muted px-1 rounded">{policy.using}</code> : '-' },
              { key: 'WITH CHECK', value: policy.withCheck ? <code className="text-xs bg-muted px-1 rounded">{policy.withCheck}</code> : '-' },
              { key: 'Comment', value: policy.comment ?? '-' },
            ]}
          />
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="policy" objectName={policy.name} />
        )}
      </div>
    </div>
  );
}
