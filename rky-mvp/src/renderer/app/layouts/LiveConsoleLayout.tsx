import { Outlet } from 'react-router';
import {
  Plug,
  GitBranch,
  Table,
  Terminal,
  Database,
} from 'lucide-react';
import { ROUTES } from '@/shared/config/constants';
import { ViewTabs } from '@/widgets/db-view-tabs';
import type { IViewTabItem } from '@/widgets/db-view-tabs';
import { useConnectionStore } from '@/features/db-connection/model/connectionStore';
import { useConnections } from '@/features/db-connection';
import { ConnectionBadge } from '@/entities/connection';
import { Badge } from '@/shared/components/ui/badge';
import { SchemaSelector } from '@/features/object-browser/ui/SchemaSelector';
import { useObjectTree } from '@/features/object-browser/model/useObjectTree';
import type { TDbType } from '~/shared/types/db';

export function LiveConsoleLayout() {
  const { selectedConnectionId, statusMap, selectedSchema, setSelectedSchema } = useConnectionStore();
  const { data: connections } = useConnections();
  const selectedConnection = connections?.find((c) => c.id === selectedConnectionId);
  const connStatus = selectedConnectionId
    ? statusMap[selectedConnectionId] ?? (selectedConnection?.ignored ? 'ignored' : 'disconnected')
    : undefined;

  const hasConnection = !!selectedConnectionId;
  const dbType: TDbType = (selectedConnection?.dbType as TDbType) ?? 'postgresql';

  // Fetch schema list for PG schema selector
  const { data: schemaObjects } = useObjectTree(selectedConnectionId ?? '', dbType);

  const tabs: IViewTabItem[] = [
    { id: 'connection', label: 'Connection', icon: Plug, path: ROUTES.DB.LIVE_CONSOLE.CONNECTION },
    { id: 'diagram', label: 'Diagram', icon: GitBranch, path: ROUTES.DB.LIVE_CONSOLE.DIAGRAM, disabled: !hasConnection },
    { id: 'data', label: 'Data', icon: Table, path: ROUTES.DB.LIVE_CONSOLE.DATA, disabled: !hasConnection },
    { id: 'query', label: 'Query', icon: Terminal, path: ROUTES.DB.LIVE_CONSOLE.QUERY, disabled: !hasConnection },
    { id: 'object', label: 'Object', icon: Database, path: ROUTES.DB.LIVE_CONSOLE.OBJECT, disabled: !hasConnection },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b bg-muted/20">
        <ViewTabs items={tabs} areaRoot={ROUTES.DB.LIVE_CONSOLE.ROOT} className="border-b-0 bg-transparent" />
        {selectedConnection && (
          <div className="ml-auto flex items-center gap-2 px-3 shrink-0">
            <SchemaSelector
              dbType={dbType}
              schemaObjects={schemaObjects}
              selectedSchema={selectedSchema}
              onSchemaChange={setSelectedSchema}
            />
            <div className="flex items-center gap-1.5">
              <ConnectionBadge status={connStatus ?? 'disconnected'} />
              <span className="text-xs font-medium truncate max-w-[120px]">{selectedConnection.name}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">{selectedConnection.dbType}</Badge>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
