interface KeyValueGridProps {
  items: { key: string; value: React.ReactNode }[];
}

export function KeyValueGrid({ items }: KeyValueGridProps) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-[180px_1fr] gap-y-2 gap-x-4 text-sm">
        {items.map((item) => (
          <div key={item.key} className="contents">
            <div className="text-muted-foreground font-medium">{item.key}</div>
            <div className="break-all">{item.value ?? <span className="text-muted-foreground italic">-</span>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
