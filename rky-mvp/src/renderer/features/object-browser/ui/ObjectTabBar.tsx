import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useObjectBrowserStore } from '../model/objectBrowserStore';
import { OBJECT_CATEGORY_META } from '../lib/vendorConfig';

export function ObjectTabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs } = useObjectBrowserStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  return (
    <>
      <div className="flex items-center border-b bg-muted/20 overflow-x-auto">
        {openTabs.map((tab) => {
          const meta = OBJECT_CATEGORY_META[tab.type];
          const Icon = meta.icon;
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              className={`group flex items-center gap-1.5 border-r px-3 py-1.5 text-xs cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-background border-b-2 border-b-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
              onClick={() => setActiveTab(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[120px]">{tab.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 -mr-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            onClick={() => { closeTab(contextMenu.tabId); setContextMenu(null); }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { closeOtherTabs(contextMenu.tabId); setContextMenu(null); }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Close Others
          </button>
          <button
            type="button"
            onClick={() => { closeAllTabs(); setContextMenu(null); }}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            Close All
          </button>
        </div>
      )}
    </>
  );
}
