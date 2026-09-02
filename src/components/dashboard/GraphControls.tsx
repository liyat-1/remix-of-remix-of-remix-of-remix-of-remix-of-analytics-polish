import { Checkbox } from "@/components/ui/checkbox";
import type { Expansion, GraphNode } from "@/lib/graph-series";

/**
 * Progressive-disclosure controls for the time graph.
 *
 * Each visible node gets a visibility checkbox; expandable nodes also get a
 * "Show breakdown" toggle. Expanding a node replaces it with its children, so
 * a parent total and its components are never plotted together.
 */
export function GraphControls({
  nodes,
  hidden,
  onToggleVisible,
  expansion,
  onToggleExpand,
}: {
  nodes: GraphNode[];
  hidden: Record<string, boolean>;
  onToggleVisible: (key: string) => void;
  expansion: Expansion;
  onToggleExpand: (key: keyof Expansion) => void;
}) {
  const shown = nodes.filter((n) => !hidden[n.key]);

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-surface-2/40 p-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Series on graph
      </span>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {nodes.map((n) => (
          <div
            key={n.key}
            className="flex items-center gap-2"
            style={{ paddingLeft: n.depth * 10 }}
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={!hidden[n.key]}
                onCheckedChange={() => onToggleVisible(n.key)}
                aria-label={n.label}
                style={{ "--primary": n.color, "--border": n.color } as React.CSSProperties}
              />
              <i className="size-3 rounded-[4px]" style={{ background: n.color }} />
              {n.context ? <span className="text-muted-foreground">{n.context} ·</span> : null}
              {n.label}
            </label>
            {n.expand && (
              <label
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
                  expansion[n.expand]
                    ? "border-primary/60 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Checkbox
                  checked={expansion[n.expand]}
                  onCheckedChange={() => onToggleExpand(n.expand!)}
                  aria-label={`Show breakdown for ${n.label}`}
                  className="size-3.5"
                />
                Show breakdown
              </label>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {shown.length === 0
          ? "Nothing selected — check a series to plot it."
          : `Displayed on graph: ${shown.map((n) => (n.context ? `${n.context} · ${n.label}` : n.label)).join(", ")}`}
      </p>
    </div>
  );
}
