interface DataTableProps {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, React.ReactNode>[];
}

export function DataTable({ columns, rows }: DataTableProps) {
  if (rows.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-muted-foreground">No data</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 text-left font-medium text-muted-foreground ${col.className ?? ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b hover:bg-muted/20">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-1.5 ${col.className ?? ''}`}>
                  {row[col.key] ?? <span className="text-muted-foreground">-</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
