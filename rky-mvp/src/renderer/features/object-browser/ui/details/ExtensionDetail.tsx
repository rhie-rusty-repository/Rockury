import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DdlView } from '../shared/DdlView';
import type { IExtension } from '~/shared/types/db';

interface ExtensionDetailProps {
  extension: IExtension;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'ddl', label: 'DDL' },
];

export function ExtensionDetail({ extension, connectionId }: ExtensionDetailProps) {
  const [activeTab, setActiveTab] = useState('info');

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type="extension" name={extension.name} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <KeyValueGrid
            items={[
              { key: 'Version', value: extension.version ?? '-' },
              { key: 'Schema', value: extension.schema ?? '-' },
              { key: 'Comment', value: extension.comment ?? '-' },
            ]}
          />
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType="extension" objectName={extension.name} />
        )}
      </div>
    </div>
  );
}
