import { useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import type { ISchemaObjects, TDbType } from '~/shared/types/db';

interface SchemaSelectorProps {
  dbType: TDbType;
  schemaObjects: Partial<ISchemaObjects> | undefined;
  selectedSchema: string;
  onSchemaChange: (schema: string) => void;
}

export function SchemaSelector({ dbType, schemaObjects, selectedSchema, onSchemaChange }: SchemaSelectorProps) {
  // Only show for PostgreSQL
  if (dbType !== 'postgresql') return null;

  const schemas = useMemo(() => {
    const names = (schemaObjects?.schemas ?? []).map((s) => s.name);
    // Ensure 'public' is always available even if not fetched yet
    if (!names.includes('public')) names.unshift('public');
    return names.sort((a, b) => {
      if (a === 'public') return -1;
      if (b === 'public') return 1;
      return a.localeCompare(b);
    });
  }, [schemaObjects?.schemas]);

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">Schema:</span>
      <div className="relative">
        <select
          value={selectedSchema}
          onChange={(e) => onSchemaChange(e.target.value)}
          className="appearance-none rounded border bg-background pl-2 pr-6 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          {schemas.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <ChevronsUpDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
