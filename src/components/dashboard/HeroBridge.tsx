import { useState } from "react";
import {
  FIELDS,
  FIELD_LABELS,
  compact,
  nf,
  pct,
  splitTotal,
  type FieldSplit,
  type StageFieldMap,
  type Totals,
} from "@/lib/analytics-model";

type Layers = { level1: boolean; l2: boolean };

export type L2Detail = { journey: number; staff: number; idscan: number; duringStay: number };

const W = 1080;
const H = 540;
const TOP = 62;
const BOTTOM = 400;
const LEFT = 96;
const RIGHT = W - 40;

type Tip = {
  x: number;
  y: number;
  title: string;
  color: string;
  rows: { k: string; v: string }[];
  note?: string;
};

const L1_COLOR = "var(--l1)";
const L2_COLOR = "var(--l2)";
const REMAIN_COLOR = "var(--recoverable)";

function splitRows(s: FieldSplit) {
  return FIELDS.map((f) => ({ k: FIELD_LABELS[f], v: nf.format(Math.round(s[f])) }));
}

/** For values with no field-level truth (bookings, remaining): scale by the usable mix. */
function scaledRows(value: number, ref: FieldSplit) {
  const t = splitTotal(ref) || 1;
  return FIELDS.map((f) => ({
    k: FIELD_LABELS[f],
    v: nf.format(Math.round((ref[f] / t) * value)),
  }));
}

function niceTicks(max: number, count = 5) {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

export function HeroBridge({
  t,
  layers,
  fields,
  l2,
  bookings,
  rangeLabel,
}: {
  t: Totals;
  layers: Layers;
  fields: StageFieldMap;
  l2: L2Detail;
  bookings: number;
  rangeLabel: string;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(bookings, t.usable, 1);
  const y = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const h = (v: number) => (v / max) * (BOTTOM - TOP);
  const ticks = niceTicks(max);

  const cols: { key: string; label: string; sub: string }[] = [];
  if (layers.level1) cols.push({ key: "level1", label: "Level 1", sub: "OTA baseline + Whois AI" });
  if (layers.l2) cols.push({ key: "l2", label: "Level 2", sub: "Guest Journey + During Stay" });
  cols.push({ key: "final", label: "Opportunity remaining", sub: "Usable vs total bookings" });

  const bw = 108;
  const slot = (RIGHT - LEFT) / cols.length;
  const x = (i: number) => LEFT + slot * i + (slot - bw) / 2;

  let run = 0;
  const seg = cols.map((c) => {
    const from = run;
    const val = c.key === "final" ? 0 : (t as unknown as Record<string, number>)[c.key]!;
    run += val;
    return { ...c, from, to: from + val, val };
  });

  const finalIdx = cols.length - 1;

  const show = (e: React.MouseEvent<SVGElement>, tp: Omit<Tip, "x" | "y">) => {
    const svg = e.currentTarget.ownerSVGElement ?? (e.currentTarget as unknown as SVGSVGElement);
    const r = svg.getBoundingClientRect();
    setTip({ ...tp, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const infoIcon = (cx: number, cy: number, tp: Omit<Tip, "x" | "y">) => (
    <g
      className="cursor-help"
      onMouseMove={(e) => show(e, tp)}
      onMouseLeave={() => setTip(null)}
    >
      <circle cx={cx} cy={cy} r="9" fill="var(--surface-2, transparent)" stroke={tp.color} strokeWidth="1.4" />
      <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill={tp.color}>
        i
      </text>
    </g>
  );

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Usable guest information from Level 1 and Level 2 against total bookings"
      >
        {/* plot background */}
        <rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} fill="var(--surface)" rx="10" />

        {/* y gridlines + ticks */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={LEFT}
              y1={y(v)}
              x2={RIGHT}
              y2={y(v)}
              stroke="var(--border)"
              strokeOpacity={v === 0 ? 1 : 0.6}
              strokeWidth="1"
            />
            <line x1={LEFT - 6} y1={y(v)} x2={LEFT} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text
              x={LEFT - 12}
              y={y(v) + 4}
              textAnchor="end"
              className="num"
              fill="var(--muted-foreground)"
              fontSize="12"
            >
              {compact(v)}
            </text>
          </g>
        ))}

        {/* axes */}
        <line x1={LEFT} y1={TOP - 10} x2={LEFT} y2={BOTTOM} stroke="var(--border)" strokeWidth="1.5" />
        <line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} stroke="var(--border)" strokeWidth="1.5" />
        <text
          x={26}
          y={(TOP + BOTTOM) / 2}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="12"
          fontWeight="600"
          transform={`rotate(-90 26 ${(TOP + BOTTOM) / 2})`}
        >
          Guest profiles
        </text>
        <text
          x={(LEFT + RIGHT) / 2}
          y={H - 10}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="12"
          fontWeight="600"
        >
          Enrichment stage · {rangeLabel}
        </text>

        {/* total bookings ceiling — every booking is usable or still an open opportunity */}
        <line
          x1={LEFT}
          y1={y(bookings)}
          x2={RIGHT}
          y2={y(bookings)}
          stroke="var(--border)"
          strokeWidth="2"
          strokeDasharray="7 6"
        />
        <text
          x={RIGHT - 4}
          y={y(bookings) - 12}
          textAnchor="end"
          className="num"
          fill="var(--muted-foreground)"
          fontSize="13"
          fontWeight="600"
        >
          Total bookings · {compact(bookings)}
        </text>
        {infoIcon(LEFT + 24, y(bookings) + 18, {
          title: "Total bookings",
          color: "var(--muted-foreground)",
          note: "Every booking received in this period. Each one is either usable or still an open opportunity.",
          rows: [
            { k: "Total bookings", v: nf.format(Math.round(bookings)) },
            { k: "Usable", v: nf.format(Math.round(t.usable)) },
            { k: "Opportunity remaining", v: nf.format(Math.round(t.remaining)) },
          ],
        })}

        {/* connectors */}
        {seg.map((s, i) => {
          if (i === finalIdx) return null;
          const next = seg[i + 1]!;
          return (
            <line
              key={`c${i}`}
              x1={x(i) + bw}
              y1={y(s.to)}
              x2={x(i + 1)}
              y2={i + 1 === finalIdx ? y(t.usable) : y(next.from)}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          );
        })}

        {seg.map((s, i) => {
          const isFinal = i === finalIdx;
          if (isFinal) {
            return (
              <g key={s.key} className="rise" style={{ animationDelay: `${i * 90}ms` }}>
                {/* opportunity remaining: from usable up to total bookings */}
                <rect
                  x={x(i)}
                  y={y(bookings)}
                  width={bw}
                  height={Math.max(0, y(t.usable) - y(bookings))}
                  fill={REMAIN_COLOR}
                  opacity="0.85"
                  rx="6"
                  className="cursor-help"
                  onMouseMove={(e) =>
                    show(e, {
                      title: "Opportunity remaining",
                      color: REMAIN_COLOR,
                      note: "Bookings where guest information is still not usable — the opportunity still open.",
                      rows: [
                        { k: "Opportunity remaining", v: nf.format(Math.round(t.remaining)) },
                        {
                          k: "Share of bookings",
                          v: `${Math.round((t.remaining / (bookings || 1)) * 100)}%`,
                        },
                        ...scaledRows(t.remaining, fields.usable),
                      ],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
                <text
                  x={x(i) + bw / 2}
                  y={y(bookings) + 20}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontSize="12"
                  className="num pointer-events-none"
                >
                  {compact(t.remaining)} left
                </text>

                {/* usable total, stacked: Level 1 then Level 2 */}
                <rect
                  x={x(i)}
                  y={y(t.level1)}
                  width={bw}
                  height={Math.max(3, h(t.level1))}
                  rx="8"
                  fill={L1_COLOR}
                  className="cursor-help"
                  onMouseMove={(e) =>
                    show(e, {
                      title: "Level 1 inside the total",
                      color: L1_COLOR,
                      note: "Usable guest information from the OTA baseline plus what Whois AI recovers.",
                      rows: [
                        { k: "Level 1", v: nf.format(Math.round(t.level1)) },
                        { k: "— OTA baseline", v: nf.format(Math.round(t.ota)) },
                        { k: "— Whois AI", v: nf.format(Math.round(t.whois)) },
                        { k: "Share of usable", v: `${Math.round((t.level1 / (t.usable || 1)) * 100)}%` },
                      ],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
                <rect
                  x={x(i)}
                  y={y(t.usable)}
                  width={bw}
                  height={Math.max(3, h(t.l2))}
                  rx="8"
                  fill={L2_COLOR}
                  className="cursor-help"
                  onMouseMove={(e) =>
                    show(e, {
                      title: "Level 2 inside the total",
                      color: L2_COLOR,
                      note: "Profiles made usable by Level 2 (Guest Journey + During Stay).",
                      rows: [
                        { k: "Level 2", v: `+${nf.format(Math.round(t.l2))}` },
                        { k: "— Guest Journey", v: nf.format(Math.round(l2.journey)) },
                        { k: "— During Stay", v: nf.format(Math.round(l2.duringStay)) },
                        { k: "   · Staff Collection", v: nf.format(Math.round(l2.staff)) },
                        { k: "   · ID Scan Collection", v: nf.format(Math.round(l2.idscan)) },
                        { k: "Uplift vs Level 1 result", v: pct(t.l2Uplift) },
                        { k: "Usable guest information", v: nf.format(Math.round(t.usable)) },
                        { k: "Uplift vs baseline", v: pct(t.totalUplift) },
                      ],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />

                <text
                  x={x(i) + bw / 2}
                  y={y(t.usable) - 46}
                  textAnchor="middle"
                  className="num pointer-events-none"
                  fill={L2_COLOR}
                  fontSize="38"
                  fontWeight="700"
                >
                  {compact(t.usable)}
                </text>
                {infoIcon(x(i) + bw / 2 + 60, y(t.usable) - 58, {
                  title: "Usable guest information — field breakdown",
                  color: L2_COLOR,
                  rows: [
                    { k: "Usable", v: nf.format(Math.round(t.usable)) },
                    ...splitRows(fields.usable),
                  ],
                })}
                <text
                  x={x(i) + bw / 2}
                  y={y(t.usable) - 24}
                  textAnchor="middle"
                  className="num pointer-events-none"
                  fill={L2_COLOR}
                  fontSize="13"
                  fontWeight="600"
                >
                  {pct(t.totalUplift)} vs baseline
                </text>
              </g>
            );
          }

          const color = s.key === "level1" ? L1_COLOR : L2_COLOR;
          const tipFor: Omit<Tip, "x" | "y"> =
            s.key === "level1"
              ? {
                  title: "Level 1 — OTA baseline + Whois AI",
                  color,
                  note: "Guest information usable from the booking itself, plus what Whois AI recovers.",
                  rows: [
                    { k: "Level 1", v: nf.format(Math.round(t.level1)) },
                    { k: "— OTA baseline", v: nf.format(Math.round(t.ota)) },
                    { k: "— Whois AI", v: `+${nf.format(Math.round(t.whois))}` },
                    { k: "Uplift vs OTA baseline", v: pct(t.l1Uplift) },
                    { k: "Share of bookings", v: `${Math.round((t.level1 / (bookings || 1)) * 100)}%` },
                    ...splitRows(fields.level1),
                  ],
                }
              : {
                  title: "Level 2 — Guest Journey + During Stay",
                  color,
                  note: "Profiles made usable by Level 2 collection.",
                  rows: [
                    { k: "Added", v: `+${nf.format(Math.round(s.val))}` },
                    { k: "Running total", v: nf.format(Math.round(s.to)) },
                    { k: "Uplift vs Level 1 result", v: pct(t.l2Uplift) },
                    ...splitRows(fields.l2),
                    { k: "— Guest Journey", v: nf.format(Math.round(l2.journey)) },
                    { k: "— During Stay", v: nf.format(Math.round(l2.duringStay)) },
                    { k: "   · Staff Collection", v: nf.format(Math.round(l2.staff)) },
                    { k: "   · ID Scan Collection", v: nf.format(Math.round(l2.idscan)) },
                  ],
                };
          return (
            <g key={s.key} className="rise" style={{ animationDelay: `${i * 90}ms` }}>
              {s.from > 0 && (
                <rect x={x(i)} y={y(s.from)} width={bw} height={h(s.from)} fill="var(--gap)" rx="6" />
              )}
              <rect
                x={x(i)}
                y={y(s.to)}
                width={bw}
                height={Math.max(3, h(s.val))}
                rx="6"
                fill={color}
                className="cursor-help"
                onMouseMove={(e) => show(e, tipFor)}
                onMouseLeave={() => setTip(null)}
              />
              <text
                x={x(i) + bw / 2}
                y={y(s.to) - 14}
                textAnchor="middle"
                className="num pointer-events-none"
                fill={color}
                fontSize="20"
                fontWeight="700"
              >
                {s.key === "level1" ? compact(s.val) : `+${compact(s.val)}`}
              </text>
              {infoIcon(x(i) + bw / 2 + 46, y(s.to) - 20, tipFor)}
            </g>
          );
        })}

        {/* uplift brackets — sit in the gap between the previous column and this one */}
        {seg.map((s, i) => {
          if (i === 0 || i === finalIdx) return null;
          const left = x(i - 1) + bw;
          const right = x(i);
          const cx = (left + right) / 2;
          const yy = Math.min(BOTTOM - 12, y(s.from) + 30);
          return (
            <g key={`u${i}`} className="pointer-events-none">
              <path
                d={`M ${left + 6} ${yy - 6} v 6 h ${right - left - 12} v -6`}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeOpacity="0.55"
                strokeWidth="1.5"
              />
              <text x={cx} y={yy + 16} textAnchor="middle" className="num" fill="var(--muted-foreground)" fontSize="12" fontWeight="600">
                {pct(t.l2Uplift)} vs Level 1
              </text>
            </g>
          );
        })}

        {/* x-axis labels */}
        {seg.map((s, i) => (
          <g key={`l${i}`} className="pointer-events-none">
            <line x1={x(i) + bw / 2} y1={BOTTOM} x2={x(i) + bw / 2} y2={BOTTOM + 6} stroke="var(--border)" strokeWidth="1" />
            <text x={x(i) + bw / 2} y={BOTTOM + 26} textAnchor="middle" fill="var(--foreground)" fontSize="14" fontWeight="600">
              {s.label}
            </text>
            <text x={x(i) + bw / 2} y={BOTTOM + 46} textAnchor="middle" fill="var(--muted-foreground)" fontSize="12">
              {s.sub}
            </text>
            {i === finalIdx && (
              <text x={x(i) + bw / 2} y={BOTTOM + 66} textAnchor="middle" fill="var(--muted-foreground)" fontSize="12" className="num">
                {nf.format(Math.round(t.remaining))} of {nf.format(Math.round(bookings))}
              </text>
            )}
          </g>
        ))}
      </svg>

      {tip && (
        <div
          className="panel pointer-events-none absolute z-20 w-60 -translate-x-1/2 -translate-y-full rounded-xl border border-border p-3 text-xs shadow-lg"
          style={{ left: `${tip.x}%`, top: `calc(${tip.y}% - 12px)`, background: "var(--background)" }}
        >
          <div className="mb-1.5 font-semibold" style={{ color: tip.color }}>
            {tip.title}
          </div>
          {tip.note && <p className="mb-2 text-muted-foreground">{tip.note}</p>}
          <dl className="space-y-1">
            {tip.rows.map((r) => (
              <div key={r.k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{r.k}</dt>
                <dd className="num font-semibold">{r.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
