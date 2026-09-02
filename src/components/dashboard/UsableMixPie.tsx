import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FIELDS,
  FIELD_LABELS,
  compact,
  nf,
  pct,
  share,
  splitTotal,
  type Agg,
  type FieldSplit,
  type LeafKey,
  type Selection,
} from "@/lib/analytics-model";

export type Breakdown = { level1: boolean; l2: boolean };

export type SourceKey = "level1" | "l2";

export type MixSlice = {
  key: string;
  parent: SourceKey | "remaining";
  label: string;
  sub: string;
  value: number;
  color: string;
  onDark?: boolean;
  /** Extra hover rows — the deeper breakdown behind a composite slice. */
  detail?: { k: string; v: string }[];
};

export const SOURCE_COLOR: Record<SourceKey, string> = {
  level1: "var(--l1)",
  l2: "var(--l2)",
};

export const OTA_COLOR = "var(--ota)";
export const REMAINING_COLOR = "var(--recoverable)";

function shade(color: string, amount: number) {
  return `color-mix(in oklab, ${color} ${amount}%, var(--surface-2))`;
}

const FIELD_SHADE: Record<string, number> = { email: 100, phone: 68, address: 42 };

function fieldSlices(
  parent: SourceKey,
  leaf: LeafKey,
  label: string,
  split: FieldSplit,
  base = SOURCE_COLOR[parent],
): MixSlice[] {
  return FIELDS.map((f) => ({
    key: `${leaf}-${f}`,
    parent,
    label: `${label} · ${FIELD_LABELS[f]}`,
    sub: FIELD_LABELS[f],
    value: split[f],
    color: shade(base, FIELD_SHADE[f]!),
    onDark: true,
  }));
}

/** Field split of several leaves combined. */
function combinedSplit(a: Agg, ...keys: LeafKey[]): FieldSplit {
  return {
    email: keys.reduce((s, k) => s + a.leaves[k].email, 0),
    phone: keys.reduce((s, k) => s + a.leaves[k].phone, 0),
    address: keys.reduce((s, k) => s + a.leaves[k].address, 0),
  };
}

function fieldDetail(split: FieldSplit): { k: string; v: string }[] {
  return FIELDS.map((f) => ({ k: FIELD_LABELS[f], v: nf.format(Math.round(split[f])) }));
}

export function level1On(sel: Selection) {
  return sel.ota || sel.l1;
}

/**
 * Slices of the mix donut, in ring order. Always sums to total bookings:
 * Level 1 + Level 2 + Opportunity remaining.
 */
export function mixSlices(a: Agg, sel: Selection, bd: Breakdown): MixSlice[] {
  const out: MixSlice[] = [];

  if (level1On(sel) && a.level1 > 0) {
    if (!bd.level1) {
      out.push({
        key: "level1",
        parent: "level1",
        label: "Level 1",
        sub: "OTA baseline + Whois AI",
        value: a.level1,
        color: SOURCE_COLOR.level1,
        onDark: true,
        detail: [
          { k: "OTA baseline", v: nf.format(Math.round(a.ota)) },
          { k: "Whois AI", v: nf.format(Math.round(a.whois)) },
          ...fieldDetail(combinedSplit(a, "ota", "l1")),
        ],
      });
    } else {
      const otaOn = sel.ota && a.ota > 0;
      const whoisOn = sel.l1 && a.whois > 0;
      if (otaOn && whoisOn) {
        out.push({
          key: "ota",
          parent: "level1",
          label: "OTA baseline",
          sub: "Usable on arrival",
          value: a.ota,
          color: OTA_COLOR,
          onDark: true,
          detail: fieldDetail(a.leaves.ota),
        });
        out.push({
          key: "whois",
          parent: "level1",
          label: "Whois AI",
          sub: "Recovered by Whois AI",
          value: a.whois,
          color: SOURCE_COLOR.level1,
          onDark: true,
          detail: [
            ...fieldDetail(a.leaves.l1),
            { k: "Usable after Level 1", v: nf.format(Math.round(a.level1)) },
            { k: "Uplift vs OTA baseline", v: pct(a.l1Uplift) },
          ],
        });
      } else if (otaOn) {
        out.push(...fieldSlices("level1", "ota", "OTA baseline", a.leaves.ota, OTA_COLOR));
      } else if (whoisOn) {
        out.push(...fieldSlices("level1", "l1", "Whois AI", a.leaves.l1));
      }
    }
  }

  if (sel.l2 && a.l2 > 0) {
    if (!bd.l2) {
      out.push({
        key: "l2",
        parent: "l2",
        label: "Level 2",
        sub: "Guest Journey + During Stay",
        value: a.l2,
        color: SOURCE_COLOR.l2,
        onDark: true,
        detail: [
          { k: "Guest Journey", v: nf.format(Math.round(a.journey)) },
          { k: "During Stay", v: nf.format(Math.round(a.duringStay)) },
          ...fieldDetail(combinedSplit(a, "journey", "staff", "idscan")),
          { k: "Usable guest information", v: nf.format(Math.round(a.usable)) },
          { k: "Uplift vs Level 1 result", v: pct(a.l2Uplift) },
        ],
      });
    } else {
      const journeyOn = sel.journey && a.journey > 0;
      const stayOn = sel.duringStay && a.duringStay > 0;

      if (journeyOn && stayOn) {
        out.push({
          key: "journey",
          parent: "l2",
          label: "Guest Journey",
          sub: "Collected before arrival",
          value: a.journey,
          color: SOURCE_COLOR.l2,
          onDark: true,
          detail: fieldDetail(a.leaves.journey),
        });
        out.push({
          key: "during",
          parent: "l2",
          label: "During Stay",
          sub: "Staff + ID scan",
          value: a.duringStay,
          color: shade(SOURCE_COLOR.l2, 58),
          onDark: true,
          detail: [
            { k: "Staff Collection", v: nf.format(Math.round(a.staff)) },
            { k: "ID Scan Collection", v: nf.format(Math.round(a.idscan)) },
            ...fieldDetail(combinedSplit(a, "staff", "idscan")),
          ],
        });
      } else if (journeyOn) {
        out.push(...fieldSlices("l2", "journey", "Guest Journey", a.leaves.journey));
      } else if (stayOn) {
        const staffOn = sel.staff && a.staff > 0;
        const idOn = sel.idscan && a.idscan > 0;
        if (staffOn && idOn) {
          out.push({
            key: "staff",
            parent: "l2",
            label: "Staff Collection",
            sub: "Captured by staff",
            value: a.staff,
            color: SOURCE_COLOR.l2,
            onDark: true,
            detail: fieldDetail(a.leaves.staff),
          });
          out.push({
            key: "idscan",
            parent: "l2",
            label: "ID Scan Collection",
            sub: "Captured by ID scan",
            value: a.idscan,
            color: shade(SOURCE_COLOR.l2, 55),
            onDark: true,
            detail: fieldDetail(a.leaves.idscan),
          });
        } else if (staffOn) {
          out.push(...fieldSlices("l2", "staff", "Staff Collection", a.leaves.staff));
        } else if (idOn) {
          out.push(...fieldSlices("l2", "idscan", "ID Scan Collection", a.leaves.idscan));
        }
      }
    }
  }

  out.push({
    key: "remaining",
    parent: "remaining",
    label: "Opportunity remaining",
    sub: "Not usable yet",
    value: Math.max(0, a.remaining),
    color: REMAINING_COLOR,
  });

  return out.filter((s) => s.value > 0);
}

/* ----------------------------------------------------------------- donut */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlice(cx: number, cy: number, r: number, thick: number, a0: number, a1: number) {
  const ri = r - thick;
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const p2 = polar(cx, cy, ri, a1);
  const p3 = polar(cx, cy, ri, a0);
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${ri} ${ri} 0 ${large} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

export function MixDonut({
  a,
  sel,
  bd,
  size = 380,
}: {
  a: Agg;
  sel: Selection;
  bd: Breakdown;
  size?: number;
}) {
  const [hover, setHover] = useState<MixSlice | null>(null);
  const slices = mixSlices(a, sel, bd);
  const total = Math.max(1, a.bookings);
  const S = 400;
  const C = S / 2;
  const R = 176;
  const THICK = 54;

  let acc = 0;
  const rendered = slices.map((s) => {
    const a0 = (acc / total) * 360;
    acc += s.value;
    return { s, a0, a1: (acc / total) * 360 };
  });

  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      style={{ width: size, maxWidth: "100%" }}
      role="img"
      aria-label={`Guest information mix across ${nf.format(a.bookings)} bookings`}
    >
      {rendered.map(({ s, a0, a1 }) => {
        const start = Math.min(a0 + 0.6, 359.4);
        const end = Math.min(Math.max(a1 - 0.6, start + 0.3), 360);
        const dim = hover && hover.key !== s.key;
        return (
          <path
            key={s.key}
            d={donutSlice(C, C, R, THICK, start, end)}
            fill={s.color}
            opacity={dim ? 0.35 : 1}
            className="cursor-help transition-opacity"
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
          />
        );
      })}

      {rendered.map(({ s, a0, a1 }) => {
        const sweep = a1 - a0;
        if (sweep < 10) return null;
        const mid = (a0 + a1) / 2;
        const outside = s.parent === "remaining";
        const p = polar(C, C, outside ? R + 22 : R - THICK / 2, mid);
        return (
          <text
            key={`lbl-${s.key}`}
            x={p.x}
            y={p.y + 5}
            textAnchor="middle"
            className="num pointer-events-none"
            fill={outside ? "var(--muted-foreground)" : s.onDark ? "var(--background)" : "var(--foreground)"}
            fontSize={sweep < 20 ? 12 : 15}
            fontWeight="700"
            opacity={hover && hover.key !== s.key ? 0.45 : 1}
          >
            {compact(s.value)}
          </text>
        );
      })}

      {hover ? (
        <>
          <text x={C} y={C - 40} textAnchor="middle" fill="var(--muted-foreground)" fontSize="13">
            {hover.label}
          </text>
          <text
            x={C}
            y={C - 2}
            textAnchor="middle"
            className="num"
            fill="var(--foreground)"
            fontSize="34"
            fontWeight="700"
          >
            {nf.format(Math.round(hover.value))}
          </text>
          <text x={C} y={C + 20} textAnchor="middle" className="num" fill="var(--muted-foreground)" fontSize="12">
            {share(hover.value, a.bookings)} of bookings
          </text>
          {hover.detail?.slice(0, 6).map((d, i) => (
            <text
              key={d.k}
              x={C}
              y={C + 40 + i * 15}
              textAnchor="middle"
              className="num"
              fill="var(--muted-foreground)"
              fontSize="11"
            >
              {d.k} · {d.v}
            </text>
          ))}
        </>
      ) : (
        <>
          <text
            x={C}
            y={C - 6}
            textAnchor="middle"
            className="num"
            fill="var(--foreground)"
            fontSize="46"
            fontWeight="700"
          >
            {compact(a.usable)}
          </text>
          <text x={C} y={C + 18} textAnchor="middle" fill="var(--muted-foreground)" fontSize="13">
            usable guest profiles
          </text>
          <text x={C} y={C + 40} textAnchor="middle" className="num" fill="var(--l2)" fontSize="13" fontWeight="700">
            {share(a.usable, a.bookings)} of bookings
          </text>
        </>
      )}
    </svg>
  );
}

/* --------------------------------------------------------- source toggles */

/** Compact source checkbox row — used as the legend above the bridge view. */
export function SourceToggles({
  sel,
  onToggle,
}: {
  sel: Selection;
  onToggle: (k: SourceKey) => void;
}) {
  const rows: { k: SourceKey; label: string; sub: string; on: boolean }[] = [
    { k: "level1", label: "Level 1", sub: "OTA baseline + Whois AI", on: level1On(sel) },
    { k: "l2", label: "Level 2", sub: "Guest Journey + During Stay", on: sel.l2 },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-surface-2/40 px-4 py-3">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Enrichment levels
      </span>
      {rows.map((r) => (
        <label key={r.k} className="flex cursor-pointer items-center gap-2 text-sm">
          <ColorCheckbox
            color={SOURCE_COLOR[r.k]}
            checked={r.on}
            onChange={() => onToggle(r.k)}
            label={r.label}
          />
          <i className="size-3 rounded-[4px]" style={{ background: SOURCE_COLOR[r.k] }} />
          {r.label}
          <span className="text-xs text-muted-foreground">· {r.sub}</span>
        </label>
      ))}
      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <i className="size-3 rounded-[4px]" style={{ background: REMAINING_COLOR }} /> Opportunity
        remaining
      </span>
    </div>
  );
}

function ColorCheckbox({
  color,
  checked,
  onChange,
  label,
}: {
  color: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      style={{ "--primary": color, "--border": color } as React.CSSProperties}
    />
  );
}

/* ---------------------------------------------------------------- legend */

type SelKey = keyof Selection;

export function MixLegend({
  a,
  prev,
  sel,
  bd,
  onToggleBreakdown,
  onToggleSel,
}: {
  a: Agg;
  prev: Agg | null;
  sel: Selection;
  bd: Breakdown;
  onToggleBreakdown: (k: SourceKey) => void;
  onToggleSel: (k: SelKey) => void;
}) {
  const sources: {
    k: SourceKey;
    label: string;
    sub: string;
    value: number;
    prev: number;
    on: boolean;
  }[] = [
    {
      k: "level1",
      label: "Level 1",
      sub: "OTA baseline + Whois AI",
      value: a.level1,
      prev: prev?.level1 ?? 0,
      on: level1On(sel),
    },
    {
      k: "l2",
      label: "Level 2",
      sub: "Guest Journey + During Stay",
      value: a.l2,
      prev: prev?.l2 ?? 0,
      on: sel.l2,
    },
  ];

  return (
    <div className="w-full">
      <div className="mb-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Where the {compact(a.bookings)} bookings sit
      </div>

      <div className="space-y-4">
        {sources.map((s) => (
          <div key={s.k} className={s.on ? "" : "opacity-55"}>
            <div className="flex items-start gap-3">
              <i
                className="mt-1.5 size-4 shrink-0 rounded-[5px]"
                style={{ background: s.on ? SOURCE_COLOR[s.k] : "var(--muted)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-semibold">{s.label}</span>
                  <span className="truncate text-sm text-muted-foreground">· {s.sub}</span>
                </div>
                <div className="num text-xs text-muted-foreground">
                  {nf.format(Math.round(s.value))} profiles · {share(s.value, a.bookings)} of bookings
                  {prev ? ` · prev ${compact(s.prev)}` : ""}
                </div>
              </div>
              <div className="num shrink-0 text-2xl font-bold" style={{ color: SOURCE_COLOR[s.k] }}>
                {s.k === "level1" ? compact(s.value) : `+${compact(s.value)}`}
              </div>
            </div>

            {s.on && (
              <div className="mt-2 ml-7">
                <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <ColorCheckbox
                    color={SOURCE_COLOR[s.k]}
                    checked={bd[s.k]}
                    onChange={() => onToggleBreakdown(s.k)}
                    label={`Show breakdown for ${s.label}`}
                  />
                  Show breakdown
                </label>

                {bd.level1 && s.k === "level1" && (
                  <Level1Tree a={a} sel={sel} onToggleSel={onToggleSel} />
                )}

                {bd.l2 && s.k === "l2" && <L2Tree a={a} sel={sel} onToggleSel={onToggleSel} />}
              </div>
            )}
          </div>
        ))}

        <FixedRow
          color={REMAINING_COLOR}
          label="Opportunity remaining"
          sub="Not usable yet"
          value={a.remaining}
          prev={prev?.remaining ?? null}
          whole={a.bookings}
          note={offNote(a, sel)}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Usable guest information</span>
        <span className="num text-2xl font-bold">{nf.format(Math.round(a.usable))}</span>
        <span className="num text-xl font-bold text-primary">{pct(a.totalUplift)} uplift</span>
      </div>
    </div>
  );
}

function FieldList({ split, color, whole }: { split: FieldSplit; color: string; whole: number }) {
  return (
    <div className="mt-2 space-y-1">
      {FIELDS.map((f) => (
        <Leaf
          key={f}
          label={FIELD_LABELS[f]}
          value={split[f]}
          whole={whole}
          color={shade(color, FIELD_SHADE[f]!)}
        />
      ))}
    </div>
  );
}

function Level1Tree({
  a,
  sel,
  onToggleSel,
}: {
  a: Agg;
  sel: Selection;
  onToggleSel: (k: SelKey) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div>
        <div className="flex items-center gap-2 text-xs">
          <ColorCheckbox
            color={OTA_COLOR}
            checked={sel.ota}
            onChange={() => onToggleSel("ota")}
            label="OTA baseline"
          />
          <i className="size-2.5 rounded-full" style={{ background: OTA_COLOR }} />
          <span className={sel.ota ? "" : "text-muted-foreground line-through"}>OTA baseline</span>
          <span className="num ml-auto font-semibold">{nf.format(Math.round(a.ota))}</span>
        </div>
        {sel.ota && !sel.l1 && (
          <div className="ml-6">
            <FieldList split={a.leaves.ota} color={OTA_COLOR} whole={a.ota} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs">
          <ColorCheckbox
            color={SOURCE_COLOR.level1}
            checked={sel.l1}
            onChange={() => onToggleSel("l1")}
            label="Whois AI"
          />
          <i className="size-2.5 rounded-full" style={{ background: SOURCE_COLOR.level1 }} />
          <span className={sel.l1 ? "" : "text-muted-foreground line-through"}>Whois AI</span>
          <span className="num ml-auto font-semibold">{nf.format(Math.round(a.whois))}</span>
        </div>
        {sel.l1 && !sel.ota && (
          <div className="ml-6">
            <FieldList split={a.leaves.l1} color={SOURCE_COLOR.level1} whole={a.whois} />
          </div>
        )}
      </div>

      {sel.ota && sel.l1 && (
        <p className="text-[11px] text-muted-foreground">
          Uncheck one branch to break the other down by field.
        </p>
      )}
    </div>
  );
}

function L2Tree({
  a,
  sel,
  onToggleSel,
}: {
  a: Agg;
  sel: Selection;
  onToggleSel: (k: SelKey) => void;
}) {
  const journeyOn = sel.journey;
  const stayOn = sel.duringStay;
  const green = SOURCE_COLOR.l2;

  return (
    <div className="mt-2 space-y-2">
      {/* Guest Journey */}
      <div>
        <div className="flex items-center gap-2 text-xs">
          <ColorCheckbox
            color={green}
            checked={journeyOn}
            onChange={() => onToggleSel("journey")}
            label="Guest Journey"
          />
          <i className="size-2.5 rounded-full" style={{ background: green }} />
          <span className={journeyOn ? "" : "text-muted-foreground line-through"}>Guest Journey</span>
          <span className="num ml-auto font-semibold">{nf.format(Math.round(a.journey))}</span>
        </div>
        {journeyOn && !stayOn && (
          <div className="ml-6">
            <FieldList split={a.leaves.journey} color={green} whole={a.journey} />
          </div>
        )}
      </div>

      {/* During Stay */}
      <div>
        <div className="flex items-center gap-2 text-xs">
          <ColorCheckbox
            color={green}
            checked={stayOn}
            onChange={() => onToggleSel("duringStay")}
            label="During Stay"
          />
          <i className="size-2.5 rounded-full" style={{ background: shade(green, 58) }} />
          <span className={stayOn ? "" : "text-muted-foreground line-through"}>During Stay</span>
          <span className="num ml-auto font-semibold">{nf.format(Math.round(a.duringStay))}</span>
        </div>

        {stayOn && !journeyOn && (
          <div className="mt-2 ml-6 space-y-2">
            <div>
              <div className="flex items-center gap-2 text-xs">
                <ColorCheckbox
                  color={green}
                  checked={sel.staff}
                  onChange={() => onToggleSel("staff")}
                  label="Staff Collection"
                />
                <i className="size-2.5 rounded-full" style={{ background: green }} />
                <span className={sel.staff ? "" : "text-muted-foreground line-through"}>
                  Staff Collection
                </span>
                <span className="num ml-auto font-semibold">{nf.format(Math.round(a.staff))}</span>
              </div>
              {sel.staff && !sel.idscan && (
                <div className="ml-6">
                  <FieldList split={a.leaves.staff} color={green} whole={a.staff} />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs">
                <ColorCheckbox
                  color={green}
                  checked={sel.idscan}
                  onChange={() => onToggleSel("idscan")}
                  label="ID Scan Collection"
                />
                <i className="size-2.5 rounded-full" style={{ background: shade(green, 55) }} />
                <span className={sel.idscan ? "" : "text-muted-foreground line-through"}>
                  ID Scan Collection
                </span>
                <span className="num ml-auto font-semibold">{nf.format(Math.round(a.idscan))}</span>
              </div>
              {sel.idscan && !sel.staff && (
                <div className="ml-6">
                  <FieldList split={a.leaves.idscan} color={green} whole={a.idscan} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {journeyOn && stayOn && (
        <p className="text-[11px] text-muted-foreground">
          Uncheck one branch to break the other down further.
        </p>
      )}
    </div>
  );
}

function Leaf({
  label,
  value,
  whole,
  color,
}: {
  label: string;
  value: number;
  whole: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <i className="size-2.5 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="num ml-auto font-semibold">{nf.format(Math.round(value))}</span>
      <span className="num w-14 text-right text-muted-foreground">{share(value, whole)}</span>
    </div>
  );
}

/**
 * When a level is switched off, its recovery folds back into the opportunity
 * remaining — say how much it could add back and what uplift that is.
 */
function offNote(a: Agg, sel: Selection): string | null {
  const raw = {
    ota: splitTotal(a.leaves.ota),
    whois: splitTotal(a.leaves.l1),
    l2: splitTotal(a.leaves.journey) + splitTotal(a.leaves.staff) + splitTotal(a.leaves.idscan),
  };
  const off: { label: string; value: number }[] = [];
  if (!sel.ota && raw.ota > 0) off.push({ label: "OTA baseline", value: raw.ota });
  if (!sel.l1 && raw.whois > 0) off.push({ label: "Whois AI", value: raw.whois });
  if (!sel.l2 && raw.l2 > 0) off.push({ label: "Level 2", value: raw.l2 });
  if (off.length === 0) return null;

  const total = off.reduce((s, o) => s + o.value, 0);
  const base = Math.max(1, a.usable);
  const names = off.map((o) => o.label).join(" + ");
  return `${names} could recover ${nf.format(Math.round(total))} of this — a ${pct(total / base)} uplift on what is usable today.`;
}

function FixedRow({
  color,
  label,
  sub,
  value,
  prev,
  whole,
  note,
}: {
  color: string;
  label: string;
  sub: string;
  value: number;
  prev: number | null;
  whole: number;
  note?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <i className="mt-1.5 size-4 shrink-0 rounded-[5px]" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">{label}</span>
          <span className="truncate text-sm text-muted-foreground">· {sub}</span>
        </div>
        <div className="num text-xs text-muted-foreground">
          {nf.format(Math.round(value))} profiles · {share(value, whole)} of bookings
          {prev !== null ? ` · prev ${compact(prev)}` : ""}
        </div>
        {note ? (
          <div
            className="mt-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
            style={{
              borderColor: `color-mix(in oklab, ${REMAINING_COLOR} 45%, transparent)`,
              background: `color-mix(in oklab, ${REMAINING_COLOR} 12%, transparent)`,
            }}
          >
            {note}
          </div>
        ) : null}
      </div>
      <div className="num shrink-0 text-2xl font-bold text-muted-foreground">{compact(value)}</div>
    </div>
  );
}
