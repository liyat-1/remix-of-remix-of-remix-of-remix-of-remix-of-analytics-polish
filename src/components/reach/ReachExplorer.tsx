import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Segmented } from "@/components/reach/ReachControls";
import {
  FIELDS,
  FIELD_LABELS,
  nf,
  splitTotal,
  type FieldKey,
} from "@/lib/analytics-model";
import {
  ATTRIBUTION_LABEL,
  FIELD_COLOR,
  L1_SOURCE_LABELS,
  L2_SOURCE_LABELS,
  LEVEL_BLURB,
  LEVEL_LABELS,
  STATE_LABELS,
  guestsFromDetails,
  sampleGuests,
  splitFor,
  type Guest,
  type LevelView,
  type Reach,
  type StateView,
} from "@/lib/reach-model";

const ROOT_LABEL = "Guests you can reach";

/* ------------------------------------------------------------------ donut */

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function Donut({
  slices,
  size = 320,
  centerTop,
  centerValue,
  onSelect,
  active,
}: {
  slices: { key: string; label: string; value: number; color: string }[];
  size?: number;
  centerTop: string;
  centerValue: string;
  onSelect?: (key: string) => void;
  active?: string | null;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  let angle = -Math.PI / 2;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={centerTop}>
      {slices.map((s) => {
        const sweep = (s.value / total) * Math.PI * 2;
        const d = arc(cx, cy, r, angle, angle + Math.max(0.0001, sweep - 0.02));
        angle += sweep;
        const isActive = active === s.key;
        return (
          <path
            key={s.key}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={isActive ? 40 : 30}
            strokeLinecap="butt"
            className={onSelect ? "cursor-pointer transition-[stroke-width]" : undefined}
            onClick={onSelect ? () => onSelect(s.key) : undefined}
          >
            <title>{`${s.label}: ${nf.format(Math.round(s.value))}`}</title>
          </path>
        );
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize="12"
      >
        {centerTop}
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        className="num"
        fill="var(--foreground)"
        fontSize="28"
        fontWeight="700"
      >
        {centerValue}
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------- explorer */

export function ReachExplorer({
  r,
  level,
  onLevel,
  state,
  onState,
  seed,
}: {
  r: Reach;
  level: LevelView;
  onLevel: (l: LevelView) => void;
  state: StateView;
  onState: (s: StateView) => void;
  seed: string;
}) {
  const [field, setField] = useState<FieldKey | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const split = splitFor(r, level, state);
  const total = splitTotal(split);

  const slices = FIELDS.map((f) => ({
    key: f,
    label: FIELD_LABELS[f],
    value: split[f],
    color: FIELD_COLOR[f],
  }));

  const guests = useMemo(
    () => (field ? sampleGuests(seed, field, level) : []),
    [seed, field, level],
  );

  const levelOptions: { id: LevelView; label: string; disabled?: boolean }[] = [
    { id: "combined", label: LEVEL_LABELS.combined },
    { id: "level1", label: LEVEL_LABELS.level1 },
    { id: "level2", label: LEVEL_LABELS.level2, disabled: !r.level2Active },
  ];

  const crumbs: { label: string; onClick?: () => void }[] = [
    {
      label: ROOT_LABEL,
      onClick: () => {
        setGuest(null);
        setField(null);
        onLevel("combined");
      },
    },
    {
      label: LEVEL_LABELS[level],
      onClick: () => {
        setGuest(null);
        setField(null);
      },
    },
    ...(field
      ? [{ label: FIELD_LABELS[field], onClick: () => setGuest(null) }]
      : []),
    ...(guest ? [{ label: guest.name }] : []),
  ];

  const back = () => {
    if (guest) return setGuest(null);
    if (field) return setField(null);
    if (level !== "combined") return onLevel("combined");
  };

  const canBack = !!guest || !!field || level !== "combined";

  return (
    <section className="panel p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {LEVEL_LABELS[level]} · {STATE_LABELS[state]}
          </h2>
          <p className="text-sm text-muted-foreground">{LEVEL_BLURB[level]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Level" value={level} onChange={onLevel} options={levelOptions} />
          <Segmented
            label="View"
            value={state}
            onChange={onState}
            options={[
              { id: "start" as StateView, label: STATE_LABELS.start },
              { id: "now" as StateView, label: STATE_LABELS.now },
            ]}
          />
        </div>
      </div>

      {/* breadcrumb */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={back}
          disabled={!canBack}
          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" /> Back
        </button>
        {crumbs.map((c, i) => (
          <span key={c.label + i} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
            {c.onClick && i < crumbs.length - 1 ? (
              <button
                type="button"
                onClick={c.onClick}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.label}
              </button>
            ) : (
              <span className="font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </div>

      {guest ? (
        <GuestDetail guest={guest} />
      ) : field ? (
        <GuestList
          field={field}
          level={level}
          details={split[field]}
          guests={guests}
          onGuest={setGuest}
        />
      ) : (
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className="flex justify-center">
            <Donut
              slices={slices}
              centerTop={state === "start" ? "Reachable then" : "Reachable now"}
              centerValue={nf.format(guestsFromDetails(total))}
              onSelect={(k) => setField(k as FieldKey)}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What kind of guest information{" "}
              {level === "combined" ? "you can use" : `${LEVEL_LABELS[level]} made reachable`} — click a
              slice for the guests behind it.
            </p>
            {FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setField(f)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-surface-2/60"
              >
                <i className="size-3 rounded-[4px]" style={{ background: FIELD_COLOR[f] }} />
                <span className="font-medium">{FIELD_LABELS[f]}</span>
                <span className="num ml-auto font-semibold">{nf.format(split[f])}</span>
                <span className="num w-14 text-right text-xs text-muted-foreground">
                  {total ? `${((split[f] / total) * 100).toFixed(0)}%` : "0%"}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}

            {state === "now" && level !== "combined" && (
              <div className="rounded-xl border border-border bg-surface-2/40 p-3">
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-sm font-medium text-primary"
                >
                  {showDetails ? "Hide details" : "See details"}
                </button>
                {showDetails && (
                  <div className="mt-3 space-y-2 text-sm">
                    {level === "level1"
                      ? (["cleanup", "whois"] as const).map((k) => (
                          <Row
                            key={k}
                            label={L1_SOURCE_LABELS[k]}
                            value={splitTotal(r.level1By[k])}
                          />
                        ))
                      : (["journey", "staff", "idscan"] as const).map((k) => (
                          <Row
                            key={k}
                            label={L2_SOURCE_LABELS[k]}
                            value={splitTotal(r.level2By[k])}
                          />
                        ))}
                    <p className="text-xs text-muted-foreground">
                      How the information was collected. These add up to the{" "}
                      {LEVEL_LABELS[level]} total above.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-semibold">{nf.format(Math.round(value))}</span>
    </div>
  );
}

/* ------------------------------------------------------------ guest views */

function GuestList({
  field,
  level,
  details,
  guests,
  onGuest,
}: {
  field: FieldKey;
  level: LevelView;
  details: number;
  guests: Guest[];
  onGuest: (g: Guest) => void;
}) {
  if (details === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No {FIELD_LABELS[field].toLowerCase()} became reachable here for this period.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">
        <span className="num">{nf.format(guestsFromDetails(details))}</span> guests with newly
        reachable {FIELD_LABELS[field].toLowerCase()}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {nf.format(details)} {FIELD_LABELS[field].toLowerCase()} details became reachable
        {level === "combined" ? " with Directful" : ` with ${LEVEL_LABELS[level]}`}. A sample of the
        guests behind that result:
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {guests.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onGuest(g)}
              className="flex w-full items-center gap-4 p-3 text-left transition-colors hover:bg-surface-2/60"
            >
              <span className="font-medium">{g.name}</span>
              <span className="text-sm text-muted-foreground">
                {g.city} · {g.stay}
              </span>
              <span className="ml-auto flex gap-1.5">
                {FIELDS.map((f) => (
                  <i
                    key={f}
                    title={`${FIELD_LABELS[f]} — ${ATTRIBUTION_LABEL[g.fields[f]]}`}
                    className="size-2.5 rounded-full"
                    style={{
                      background:
                        g.fields[f] === "none" ? "var(--gap)" : FIELD_COLOR[f],
                      opacity: g.fields[f] === "start" ? 0.45 : 1,
                    }}
                  />
                ))}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuestDetail({ guest }: { guest: Guest }) {
  const stages: { key: string; title: string; test: (a: string) => boolean }[] = [
    { key: "start", title: STATE_LABELS.start, test: (a) => a === "start" },
    { key: "level1", title: "After Level 1", test: (a) => a === "start" || a === "level1" },
    {
      key: "level2",
      title: "After Level 2",
      test: (a) => a === "start" || a === "level1" || a === "level2",
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold">{guest.name}</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {guest.city} · {guest.stay}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {stages.map((s) => (
          <div key={s.key} className="rounded-xl border border-border p-4">
            <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {s.title}
            </div>
            {FIELDS.map((f) => {
              const reachable = s.test(guest.fields[f]);
              return (
                <div key={f} className="flex items-center justify-between py-1 text-sm">
                  <span>{FIELD_LABELS[f]}</span>
                  <span className={reachable ? "font-medium text-primary" : "text-muted-foreground"}>
                    {reachable ? "Reachable" : "Not reachable"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        {FIELDS.map((f) => (
          <li key={f}>
            <span className="font-medium text-foreground">{FIELD_LABELS[f]}</span> —{" "}
            {ATTRIBUTION_LABEL[guest.fields[f]]}
          </li>
        ))}
      </ul>
    </div>
  );
}
