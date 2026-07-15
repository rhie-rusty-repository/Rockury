interface DetailSubTabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function DetailSubTabs({ tabs, activeTab, onTabChange }: DetailSubTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b px-4 bg-muted/5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === tab.id
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
