import { ArrowRight, Sparkles } from "lucide-react";

import { FIELDS, FIELD_LABELS, compact, nf, pct, splitTotal } from "@/lib/analytics-model";
import {
  COLORS,
  STATE_LABELS,
  shareOfBookings,
  uplift,
  type Reach,
  type StateView,
} from "@/lib/reach-model";

/**
 * The hero: guests you can reach now, and the progression that got there —
 * starting point → Level 1 → Level 2 → now.
 */
export function ReachHero({
  r,
  state,
  sourceLabel,
  rangeLabel,
}: {
  r: Reach;
  state: StateView;
  sourceLabel: string;
  rangeLabel: string;
}) {
  const shownGuests = state === "start" ? r.guests.start : r.guests.now;
  const added = r.guests.now - r.guests.start;
  const up = uplift(r.guests.now, r.guests.start);

  const steps = [
    {
      key: "start",
      label: STATE_LABELS.start,
      value: r.guests.start,
      color: COLORS.start,
      note: "Reachable before Directful",
    },
    {
      key: "level1",
      label: "Level 1 added",
      value: r.guests.level1,
      color: COLORS.level1,
      note: "More of your data made usable",
      plus: true,
    },
    ...(r.level2Active
      ? [
          {
            key: "level2",
            label: "Level 2 added",
            value: r.guests.level2,
            color: COLORS.level2,
            note: "Collected during the guest journey",
            plus: true,
          },
        ]
      : []),
    {
      key: "now",
      label: STATE_LABELS.now,
      value: r.guests.now,
      color: COLORS.reach,
      note: "Guests you can reach today",
    },
  ];

  const peak = Math.max(1, ...steps.map((s) => s.value));

  return (
    <section className="panel mb-6 p-6 lg:p-8">
      <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Sparkles className="size-3.5 text-primary" /> {sourceLabel} ·{" "}
        {state === "start" ? STATE_LABELS.start : STATE_LABELS.now}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {state === "start" ? "Guests you could reach at your starting point" : "Guests you can reach"}
          </h2>
          <div className="num mt-1 text-6xl font-bold text-primary lg:text-7xl">
            {nf.format(shownGuests)}
          </div>
          {state === "now" && (
            <p className="mt-2 text-lg">
              <span className="num font-semibold text-primary">+{nf.format(added)}</span>{" "}
              <span className="text-muted-foreground">
                more guests than your starting point ({pct(up)} increase)
              </span>
            </p>
          )}
          {state === "start" && (
            <p className="mt-2 text-muted-foreground">
              Switch to <span className="font-medium text-foreground">Now</span> to see where you are
              today.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
          <Stat label={`Total ${sourceLabel.toLowerCase()} bookings`} value={nf.format(r.bookings)} />
          <Stat
            label="Remaining opportunity"
            value={nf.format(r.remaining)}
            hint="Guest data still available to make reachable"
          />
          <Stat
            label="Missed opportunities"
            value={nf.format(r.missed)}
            muted
            hint="Guest data we could no longer recover"
          />
        </div>
      </div>

      {/* progression */}
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.key} className="rounded-xl border border-border bg-surface-2/40 p-4">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <i className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
              {i < steps.length - 1 && <ArrowRight className="ml-auto size-3.5 opacity-50" />}
            </div>
            <div className="num mt-2 text-3xl font-bold" style={{ color: s.color }}>
              {s.plus ? "+" : ""}
              {compact(s.value)}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${(s.value / peak) * 100}%`, background: s.color }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>
            <p className="num mt-1 text-xs text-muted-foreground">
              {(shareOfBookings(s.value, r.bookings) * 100).toFixed(1)}% of total bookings
            </p>
          </div>
        ))}
      </div>

      {/* contact detail summary, starting point vs now */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f} className="rounded-xl border border-border p-4">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {FIELD_LABELS[f]} you can reach
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="num text-sm text-muted-foreground">{nf.format(r.start[f])}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="num text-2xl font-bold">{nf.format(r.now[f])}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="num mt-4 text-xs text-muted-foreground">
        {rangeLabel} · {nf.format(splitTotal(r.now))} reachable contact details across{" "}
        {nf.format(r.guests.now)} guests
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  muted,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div title={hint}>
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={`num text-xl font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
