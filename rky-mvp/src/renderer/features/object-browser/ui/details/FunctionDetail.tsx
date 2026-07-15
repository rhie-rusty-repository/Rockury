import { useState } from 'react';
import { DetailHeader } from '../shared/DetailHeader';
import { DetailSubTabs } from '../shared/DetailSubTabs';
import { KeyValueGrid } from '../shared/KeyValueGrid';
import { DataTable } from '../shared/DataTable';
import { DdlView } from '../shared/DdlView';
import type { IRoutine } from '~/shared/types/db';

interface FunctionDetailProps {
  routine: IRoutine;
  connectionId: string;
}

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'source', label: 'Source' },
  { id: 'ddl', label: 'DDL' },
];

export function FunctionDetail({ routine, connectionId }: FunctionDetailProps) {
  const [activeTab, setActiveTab] = useState('info');
  const isFunction = routine.type === 'function';
  const objectType = isFunction ? 'function' : 'procedure';
  const displayType = isFunction ? 'function' : 'procedure';

  const signature = `(${routine.parameters.map((p) => `${p.name} ${p.dataType}`).join(', ')})${
    isFunction && routine.returnType ? ` -> ${routine.returnType}` : ''
  }`;

  return (
    <div className="flex flex-col h-full">
      <DetailHeader type={displayType} name={routine.name} subtitle={signature} />
      <DetailSubTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <KeyValueGrid
            items={[
              { key: 'Language', value: routine.language ?? '-' },
              ...(isFunction ? [{ key: 'Return Type', value: routine.returnType ?? '-' }] : []),
              { key: 'Comment', value: routine.comment ?? '-' },
            ]}
          />
        )}
        {activeTab === 'parameters' && (
          <DataTable
            columns={[
              { key: '#', label: '#', className: 'w-10' },
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type' },
              { key: 'mode', label: 'Mode', className: 'w-20' },
            ]}
            rows={routine.parameters.map((p, i) => ({
              '#': i + 1,
              name: p.name,
              type: p.dataType,
              mode: p.mode,
            }))}
          />
        )}
        {activeTab === 'source' && (
          <div className="p-4">
            <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[600px] whitespace-pre-wrap">
              {routine.definition || 'No source available'}
            </pre>
          </div>
        )}
        {activeTab === 'ddl' && (
          <DdlView connectionId={connectionId} objectType={objectType} objectName={routine.name} />
        )}
      </div>
    </div>
  );
}
