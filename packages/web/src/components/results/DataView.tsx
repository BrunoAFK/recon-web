export function DataView({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined)
    return <span className="text-muted">-</span>;

  if (typeof data === "boolean")
    return (
      <span className={data ? "text-success font-medium" : "text-danger font-medium"}>
        {data ? "Yes" : "No"}
      </span>
    );

  if (typeof data === "number")
    return <span className="text-accent font-medium tabular-nums">{data}</span>;

  if (typeof data === "string") {
    if (data.length > 300)
      return <span className="break-all">{data.slice(0, 300)}...</span>;
    return <span className="break-all">{data}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-muted italic">empty</span>;
    if (depth > 1)
      return <span className="text-muted">[{data.length} items]</span>;
    return (
      <ul className="space-y-1 pl-4 border-l-2 border-border/40 mt-1">
        {data.slice(0, 8).map((item, i) => (
          <li key={i}>
            <DataView data={item} depth={depth + 1} />
          </li>
        ))}
        {data.length > 8 && (
          <li className="text-muted italic">+{data.length - 8} more</li>
        )}
      </ul>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0)
      return <span className="text-muted italic">empty</span>;
    if (depth > 1)
      return <span className="text-muted">{entries.length} fields</span>;
    return (
      <div className="grid gap-2 mt-1">
        {entries.slice(0, 10).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(80px,auto)_1fr] gap-3">
            <span className="text-muted font-medium text-sm uppercase tracking-wide">
              {k.replace(/[_-]/g, " ")}
            </span>
            <div className="text-sm">
              <DataView data={v} depth={depth + 1} />
            </div>
          </div>
        ))}
        {entries.length > 10 && (
          <p className="text-muted italic">+{entries.length - 10} more</p>
        )}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}
