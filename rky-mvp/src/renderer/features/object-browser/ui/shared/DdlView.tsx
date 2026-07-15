import { useObjectDdl } from '../../model/useObjectDetail';
import type { TSchemaObjectType } from '~/shared/types/db';

interface DdlViewProps {
  connectionId: string;
  objectType: TSchemaObjectType;
  objectName: string;
}

export function DdlView({ connectionId, objectType, objectName }: DdlViewProps) {
  const { data: ddl, isLoading, error } = useObjectDdl(connectionId, objectType, objectName);

  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading DDL...</div>;
  }

  if (error) {
    return <div className="p-4 text-xs text-destructive">Failed to load DDL</div>;
  }

  return (
    <div className="p-4">
      <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[600px] whitespace-pre-wrap">
        {ddl || 'No DDL available'}
      </pre>
    </div>
  );
}
