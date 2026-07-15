import { useConnectionStore } from '@/features/db-connection/model/connectionStore';
import { useConnections } from '@/features/db-connection';
import { useObjectTree, useObjectBrowserStore, vendorRegistry } from '@/features/object-browser';
import { ObjectTree } from '@/features/object-browser/ui/ObjectTree';
import { ObjectTabBar } from '@/features/object-browser/ui/ObjectTabBar';
import { ObjectDetailRouter } from '@/features/object-browser/ui/ObjectDetailRouter';
import type { TDbType } from '~/shared/types/db';

export function ObjectBrowserPage() {
  const { selectedConnectionId } = useConnectionStore();
  const connectionId = selectedConnectionId ?? '';
  const { data: connections } = useConnections();
  const selectedConnection = connections?.find((c) => c.id === connectionId);
  const dbType: TDbType = (selectedConnection?.dbType as TDbType) ?? 'postgresql';
  const vendorConfig = vendorRegistry[dbType];

  const { data: schemaObjects, isLoading, refetch } = useObjectTree(connectionId, dbType);
  const { openTabs, activeTabId } = useObjectBrowserStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  if (!connectionId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">No active connection</p>
        <p className="mt-1 text-xs">Go to Connection tab to connect</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Object Tree */}
      <div className="w-[220px] shrink-0 border-r flex flex-col">
        <ObjectTree
          connectionId={connectionId}
          dbType={dbType}
          vendorConfig={vendorConfig}
          schemaObjects={schemaObjects ?? {}}
          isLoading={isLoading}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Right: Tab Bar + Detail View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {openTabs.length > 0 && <ObjectTabBar />}
        <div className="flex-1 overflow-auto">
          {activeTab ? (
            <ObjectDetailRouter
              tab={activeTab}
              connectionId={connectionId}
              dbType={dbType}
              schemaObjects={schemaObjects ?? {}}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <p className="text-sm">Select an object to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
