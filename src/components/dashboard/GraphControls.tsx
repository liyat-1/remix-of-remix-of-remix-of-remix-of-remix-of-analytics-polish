import { Checkbox } from "@/components/ui/checkbox";
import {
  GRAPH_MODE_LABELS,
  type Expansion,
  type GraphMode,
  type GraphNode,
} from "@/lib/graph-series";

/**
 * Controls for the time graph.
 *
 * Two views: the level breakdown (Level 1 / Level 2 / Opportunity remaining,
 * each expandable) and the field breakdown (email, phone, address). Only one is
 * active at a time — switching to fields deactivates every level series so the
 * graph stays readable.
 */
export function GraphControls({
  nodes,
  hidden,
  onToggleVisible,
  expansion,
  onToggleExpand,
  mode,
  onMode,
}: {
  nodes: GraphNode[];
  hidden: Record<string, boolean>;
  onToggleVisible: (key: string) => void;
  expansion: Expansion;
  onToggleExpand: (key: keyof Expansion) => void;
  mode: GraphMode;
  onMode: (mode: GraphMode) => void;
}) {
  const shown = nodes.filter((n) => !hidden[n.key]);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Graph view
        </span>
        <div className="flex rounded-lg border border-border bg-surface/60 p-0.5">
          {(["levels", "fields"] as GraphMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {GRAPH_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {mode === "levels"
            ? "Levels plotted; field series are off."
            : "Email, phone and address plotted; level series are off."}
        </span>
      </div>

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
