import { CodeBlock, KeyValueTable } from "./primitives";
import type { RendererProps } from "./types";

interface RobotsRule {
  lbl: string;
  val: string;
}

interface RobotsObj {
  robots?: RobotsRule[];
  message?: string;
}

export function RobotsTxtRenderer({ data }: RendererProps) {
  if (!data) return <span className="text-sm text-muted">No robots.txt data</span>;

  // String form
  if (typeof data === "string") {
    const truncated = data.length > 500 ? data.slice(0, 500) + "\n..." : data;
    return <CodeBlock>{truncated}</CodeBlock>;
  }

  // Object with robots array
  const d = data as RobotsObj;
  const rules = d.robots;

  if (!Array.isArray(rules) || rules.length === 0) {
    return <span className="text-sm text-muted">{d.message ?? "No robots.txt rules"}</span>;
  }

  const displayed = rules.slice(0, 10);
  const items = displayed.map((r) => ({ label: r.lbl, value: r.val }));

  return (
    <div>
      <KeyValueTable items={items} />
      {rules.length > 10 && (
        <p className="text-sm text-muted mt-1.5">+{rules.length - 10} more rules</p>
      )}
    </div>
  );
}
