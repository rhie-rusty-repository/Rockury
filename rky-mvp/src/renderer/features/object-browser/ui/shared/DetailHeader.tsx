import { Copy, ScrollText } from 'lucide-react';
import { OBJECT_CATEGORY_META } from '../../lib/vendorConfig';
import type { TObjectType } from '../../lib/vendorConfig';

interface DetailHeaderProps {
  type: TObjectType;
  name: string;
  schema?: string;
  tableName?: string;
  subtitle?: string;
  onCopyName?: () => void;
  onViewDdl?: () => void;
}

export function DetailHeader({ type, name, schema, tableName, subtitle, onCopyName, onViewDdl }: DetailHeaderProps) {
  const meta = OBJECT_CATEGORY_META[type];
  const Icon = meta.icon;

  const handleCopy = () => {
    navigator.clipboard.writeText(name);
    onCopyName?.();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/10">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-medium text-sm">{name}</span>
      {schema && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{schema}</span>
      )}
      {tableName && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
          {tableName}
        </span>
      )}
      {subtitle && (
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onViewDdl && (
          <button
            type="button"
            onClick={onViewDdl}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            title="View DDL"
          >
            <ScrollText className="h-3.5 w-3.5" />
            DDL
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Copy name"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
