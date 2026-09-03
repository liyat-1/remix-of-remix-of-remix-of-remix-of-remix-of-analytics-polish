import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPARISONS,
  PERIODS,
  PROPERTIES,
  dateToISO,
  formatRange,
  isoToDate,
  type ComparisonId,
  type PeriodId,
  type PropertyId,
  type Range,
} from "@/lib/analytics-model";
import {
  GUEST_SOURCES,
  STATE_LABELS,
  hasNonOta,
  type GuestSource,
  type StateView,
} from "@/lib/reach-model";

function RangeField({
  value,
  onChange,
  label,
}: {
  value: Range | null;
  onChange: (r: Range) => void;
  label: string;
}) {
  const selected: DateRange | undefined = value
    ? { from: isoToDate(value.start), to: isoToDate(value.end) }
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 justify-start gap-2 bg-surface-2/60 font-normal"
          aria-label={label}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="num text-sm">{value ? formatRange(value) : label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          {...(selected?.from ? { defaultMonth: selected.from } : {})}
          selected={selected}
          onSelect={(r) => {
            if (r?.from && r?.to) onChange({ start: dateToISO(r.from), end: dateToISO(r.to) });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Small segmented control used for the guest source and the state view. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-xl border border-border bg-surface-2/60 p-1"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={o.disabled}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type ReachControlsProps = {
  source: GuestSource;
  onSource: (s: GuestSource) => void;
  state: StateView;
  onState: (s: StateView) => void;
  property: PropertyId;
  onProperty: (p: PropertyId) => void;
  period: PeriodId;
  onPeriod: (p: PeriodId) => void;
  customRange: Range | null;
  onCustomRange: (r: Range) => void;
  comparison: ComparisonId;
  onComparison: (c: ComparisonId) => void;
  customCompare: Range | null;
  onCustomCompare: (r: Range) => void;
  currentRange: Range;
  compareRange: Range | null;
};

export function ReachControls(p: ReachControlsProps) {
  const nonOta = hasNonOta(p.property);

  return (
    <section className="panel mb-6 space-y-3 p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Guest source"
          value={p.source}
          onChange={p.onSource}
          options={GUEST_SOURCES.map((s) => ({
            id: s.id,
            label: s.label,
            disabled: s.id === "nonota" && !nonOta,
          }))}
        />

        <Segmented
          label="View"
          value={p.state}
          onChange={p.onState}
          options={[
            { id: "start" as StateView, label: STATE_LABELS.start },
            { id: "now" as StateView, label: STATE_LABELS.now },
          ]}
        />

        {!nonOta && (
          <span className="text-xs text-muted-foreground">
            No non-OTA guest data for this property yet.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={p.property} onValueChange={(v) => p.onProperty(v as PropertyId)}>
          <SelectTrigger className="w-52 bg-surface-2/60" aria-label="Property">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTIES.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={p.period} onValueChange={(v) => p.onPeriod(v as PeriodId)}>
          <SelectTrigger className="w-44 bg-surface-2/60" aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {p.period === "custom" && (
          <RangeField value={p.customRange} onChange={p.onCustomRange} label="Pick dates" />
        )}

        <Select value={p.comparison} onValueChange={(v) => p.onComparison(v as ComparisonId)}>
          <SelectTrigger className="w-56 bg-surface-2/60" aria-label="Compare with another period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARISONS.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {p.comparison === "custom" && (
          <RangeField
            value={p.customCompare}
            onChange={p.onCustomCompare}
            label="Comparison dates"
          />
        )}

        <span className="num ml-auto text-xs text-muted-foreground">
          {formatRange(p.currentRange)}
          {p.compareRange ? ` · vs ${formatRange(p.compareRange)}` : ""}
        </span>
      </div>
    </section>
  );
}
