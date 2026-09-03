import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { OpportunityPanel } from "@/components/reach/OpportunityPanel";
import { ReachControls } from "@/components/reach/ReachControls";
import { ReachExplorer } from "@/components/reach/ReachExplorer";
import { ReachHero } from "@/components/reach/ReachHero";
import { ReachTimeline } from "@/components/reach/ReachTimeline";
import {
  DEFAULT_PROPERTY,
  formatRange,
  resolveComparison,
  resolvePeriod,
  type ComparisonId,
  type PeriodId,
  type PropertyId,
  type Range,
} from "@/lib/analytics-model";
import {
  DEFAULT_TIMELINE,
  GUEST_SOURCES,
  aggregateReach,
  bookingsPerDay,
  buildTimeline,
  dayLabels,
  getReachRows,
  hasLevel2,
  hasNonOta,
  type GuestSource,
  type LevelView,
  type StateView,
  type TimelineOptions,
} from "@/lib/reach-model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Guests You Can Reach — Directful Analytics" },
      {
        name: "description",
        content:
          "See how many more guests your hotel can reach: where you started, what Level 1 and Level 2 added, and the guest opportunity still available.",
      },
      { property: "og:title", content: "Guests You Can Reach — Directful Analytics" },
      {
        property: "og:description",
        content:
          "Starting point, Level 1, Level 2 and now — the guests your hotel can reach, with proof down to the individual guest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const [source, setSource] = useState<GuestSource>("ota");
  const [state, setState] = useState<StateView>("now");
  const [property, setProperty] = useState<PropertyId>(DEFAULT_PROPERTY);
  const [period, setPeriod] = useState<PeriodId>("15d");
  const [customRange, setCustomRange] = useState<Range | null>(null);
  const [comparison, setComparison] = useState<ComparisonId>("off");
  const [customCompare, setCustomCompare] = useState<Range | null>(null);
  const [level, setLevel] = useState<LevelView>("combined");
  const [timeline, setTimeline] = useState<TimelineOptions>(DEFAULT_TIMELINE);

  const level2Active = hasLevel2(property);

  // Only invalid selections are dropped when the context changes.
  useEffect(() => {
    if (!hasNonOta(property) && source === "nonota") setSource("ota");
  }, [property, source]);

  useEffect(() => {
    if (!level2Active && level === "level2") setLevel("combined");
  }, [level2Active, level]);

  const range = useMemo(() => resolvePeriod(period, customRange), [period, customRange]);
  const compareRange = useMemo(
    () => resolveComparison(comparison, range, customCompare),
    [comparison, range, customCompare],
  );

  const rows = useMemo(() => getReachRows(property, source, range), [property, source, range]);
  const compareRows = useMemo(
    () => (compareRange ? getReachRows(property, source, compareRange) : null),
    [property, source, compareRange],
  );

  const reach = useMemo(() => aggregateReach(rows, range, level2Active), [rows, range, level2Active]);

  const series = useMemo(
    () => buildTimeline(rows, compareRows, level, state, timeline, level2Active),
    [rows, compareRows, level, state, timeline, level2Active],
  );
  const labels = useMemo(() => dayLabels(rows), [rows]);
  const bookings = useMemo(() => bookingsPerDay(rows), [rows]);

  const rangeLabel = formatRange(range);
  const compareLabel = compareRange ? formatRange(compareRange) : null;
  const sourceLabel = GUEST_SOURCES.find((s) => s.id === source)!.label;
  const seed = `${property}|${source}|${range.start}|${range.end}`;

  const noData = reach.bookings === 0;

  return (
    <main className="w-full px-5 py-10 lg:px-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold lg:text-4xl">
          Look what Directful unlocked for your hotel.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          You gave Directful your guest data. Directful made more of it usable. Here are the guests
          you can reach today — and the ones still waiting.
        </p>
      </header>

      <ReachControls
        source={source}
        onSource={setSource}
        state={state}
        onState={setState}
        property={property}
        onProperty={setProperty}
        period={period}
        onPeriod={setPeriod}
        customRange={customRange}
        onCustomRange={setCustomRange}
        comparison={comparison}
        onComparison={setComparison}
        customCompare={customCompare}
        onCustomCompare={setCustomCompare}
        currentRange={range}
        compareRange={compareRange}
      />

      {noData ? (
        <section className="panel p-10 text-center">
          <h2 className="text-lg font-semibold">No guest data for this period</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another date range or property.
          </p>
        </section>
      ) : (
        <>
          {!level2Active && (
            <p className="mb-6 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm">
              <span className="font-semibold">You're at Level 1.</span> Level 2 isn't active for this
              property, so only your actual Level 1 results are shown below.
            </p>
          )}

          <ReachHero r={reach} state={state} sourceLabel={sourceLabel} rangeLabel={rangeLabel} />

          <ReachExplorer
            r={reach}
            level={level}
            onLevel={setLevel}
            state={state}
            onState={setState}
            seed={seed}
          />

          <ReachTimeline
            labels={labels}
            series={series}
            rangeLabel={rangeLabel}
            compareLabel={compareLabel}
            bookings={bookings}
            level={level}
            state={state}
            opts={timeline}
            onOpts={setTimeline}
            level2Active={level2Active}
          />

          <OpportunityPanel r={reach} rangeLabel={rangeLabel} />
        </>
      )}
    </main>
  );
}
