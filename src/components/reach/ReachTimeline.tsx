import { Checkbox } from "@/components/ui/checkbox";
import { FIELDS, FIELD_LABELS, type FieldKey } from "@/lib/analytics-model";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import {
  L2_SOURCE_LABELS,
  LEVEL_LABELS,
  STATE_LABELS,
  TIMELINE_LABELS,
  type ChartSeries,
  type L2SourceKey,
  type LevelView,
  type StateView,
  type TimelineMode,
  type TimelineOptions,
} from "@/lib/reach-model";

function Box({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label={label} />
      {label}
    </label>
  );
}

/**
 * The timeline: how many guests you could reach over time. It stays simple by
 * default and only opens up when the user asks for a breakdown.
 */
export function ReachTimeline({
  labels,
  series,
  rangeLabel,
  compareLabel,
  bookings,
  level,
  state,
  opts,
  onOpts,
  level2Active,
}: {
  labels: string[];
  series: ChartSeries[];
  rangeLabel: string;
  compareLabel: string | null;
  bookings: number[];
  level: LevelView;
  state: StateView;
  opts: TimelineOptions;
  onOpts: (next: TimelineOptions) => void;
  level2Active: boolean;
}) {
  const set = (patch: Partial<TimelineOptions>) => onOpts({ ...opts, ...patch });

  const title =
    opts.mode === "contact"
      ? `${LEVEL_LABELS[level]} — by contact type`
      : opts.mode === "levels"
        ? "What each level added over time"
        : level === "level2"
          ? "Level 2 — additional guests made reachable"
          : level === "level1"
            ? "Level 1 — guests made reachable"
            : "Guests you can reach over time";

  return (
    <section className="panel mt-6 p-6 lg:p-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {STATE_LABELS[state]} · {rangeLabel}
          {compareLabel ? ` compared with ${compareLabel}` : ""}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-surface/60 p-0.5">
            {(["reach", "contact", "levels"] as TimelineMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ mode: m })}
                aria-pressed={opts.mode === m}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  opts.mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TIMELINE_LABELS[m]}
              </button>
            ))}
          </div>
          <Box
            checked={opts.remaining}
            onChange={() => set({ remaining: !opts.remaining })}
            label="Remaining opportunity"
          />
        </div>

        {opts.mode === "contact" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {FIELDS.map((f: FieldKey) => (
              <Box
                key={f}
                checked={opts.fields[f]}
                onChange={() => set({ fields: { ...opts.fields, [f]: !opts.fields[f] } })}
                label={FIELD_LABELS[f]}
              />
            ))}
          </div>
        )}

        {opts.mode === "levels" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Box
              checked={opts.levels.level1}
              onChange={() => set({ levels: { ...opts.levels, level1: !opts.levels.level1 } })}
              label="Level 1"
            />
            {level2Active && (
              <>
                <Box
                  checked={opts.levels.level2}
                  onChange={() => set({ levels: { ...opts.levels, level2: !opts.levels.level2 } })}
                  label="Level 2"
                />
                <Box
                  checked={opts.showSources}
                  onChange={() => set({ showSources: !opts.showSources })}
                  label="Show how Level 2 collected it"
                />
                {opts.showSources &&
                  (["journey", "staff", "idscan"] as L2SourceKey[]).map((k) => (
                    <Box
                      key={k}
                      checked={opts.sources[k]}
                      onChange={() => set({ sources: { ...opts.sources, [k]: !opts.sources[k] } })}
                      label={L2_SOURCE_LABELS[k]}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </div>

      <TimeSeriesChart
        labels={labels}
        series={series}
        rangeLabel={rangeLabel}
        compareLabel={compareLabel}
        bookings={bookings}
      />
    </section>
  );
}
