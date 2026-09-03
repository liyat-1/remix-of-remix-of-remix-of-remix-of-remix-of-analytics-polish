/**
 * Reach model — the guest-facing analytics model.
 *
 * The story it has to tell, in the hotelier's language:
 *
 *   Starting point → Level 1 added → Level 2 added → Guests you can reach
 *   plus: remaining opportunity, missed opportunities
 *
 * Everything is derived from the day rows in `analytics-model`, so the whole UI
 * can move onto a real API later without touching a component:
 *
 *   row.leaves.ota      → already reachable at the starting point
 *   row.leaves.l1       → what Level 1 added (Cleanup + Whois AI)
 *   row.leaves.journey  → Level 2 · Guest Journey
 *   row.leaves.staff    → Level 2 · During Stay · Staff Collection
 *   row.leaves.idscan   → Level 2 · During Stay · ID Scan
 */
import {
  FIELDS,
  FIELD_LABELS,
  formatDay,
  getRows,
  splitTotal,
  type DayRow,
  type FieldKey,
  type FieldSplit,
  type PropertyId,
  type Range,
} from "@/lib/analytics-model";

/* ------------------------------------------------------------------ types */

/** Which guest population the user is looking at. */
export type GuestSource = "ota" | "nonota";

export const GUEST_SOURCES: { id: GuestSource; label: string }[] = [
  { id: "ota", label: "OTA guests" },
  { id: "nonota", label: "Non-OTA guests" },
];

/** State comparison — where you began vs where you are now. */
export type StateView = "start" | "now";

export const STATE_LABELS: Record<StateView, string> = {
  start: "Starting point",
  now: "Now",
};

/** Which package the user is analysing. */
export type LevelView = "combined" | "level1" | "level2";

export const LEVEL_LABELS: Record<LevelView, string> = {
  combined: "All Directful",
  level1: "Level 1",
  level2: "Level 2",
};

/** What each level is called in plain language. */
export const LEVEL_BLURB: Record<LevelView, string> = {
  combined: "Everything Directful made reachable",
  level1: "Make more of your existing guest data usable",
  level2: "Collect what the booking never had",
};

/** Level 2's supporting sources, only shown when the user asks for details. */
export type L2SourceKey = "journey" | "staff" | "idscan";

export const L2_SOURCE_LABELS: Record<L2SourceKey, string> = {
  journey: "Guest Journey",
  staff: "Staff Collection",
  idscan: "ID Scan",
};

/** Level 1's contributors — supporting evidence only. */
export type L1SourceKey = "cleanup" | "whois";

export const L1_SOURCE_LABELS: Record<L1SourceKey, string> = {
  cleanup: "Cleanup",
  whois: "Whois AI",
};

/* --------------------------------------------------- what each property has */

type PropertyMeta = { level2: boolean; nonOta: boolean };

const PROPERTY_META: Record<string, PropertyMeta> = {
  all: { level2: true, nonOta: true },
  harborview: { level2: true, nonOta: true },
  seaside: { level2: true, nonOta: false },
  metro: { level2: false, nonOta: true },
  alpine: { level2: false, nonOta: false },
};

export function hasLevel2(property: PropertyId) {
  return PROPERTY_META[property]?.level2 ?? false;
}

export function hasNonOta(property: PropertyId) {
  return PROPERTY_META[property]?.nonOta ?? false;
}

/** Share of the remaining opportunity Level 2 is expected to make reachable. */
export const LEVEL2_POTENTIAL_RATE = 0.3;

/** Average reachable contact details per reachable guest. */
const DETAILS_PER_GUEST = 1.34;

/** Share of bookings whose guest data can no longer be recovered. */
const MISSED_RATE = 0.042;

/* --------------------------------------------------------------- day rows */

const NON_OTA_SCALE = 0.36;

/** Non-OTA guests arrive with more of their own data, and fewer of them. */
function scaleSplit(s: FieldSplit, f: number, bias: FieldSplit): FieldSplit {
  return {
    email: Math.round(s.email * f * bias.email),
    phone: Math.round(s.phone * f * bias.phone),
    address: Math.round(s.address * f * bias.address),
  };
}

const NON_OTA_BIAS: Record<"start" | "added", FieldSplit> = {
  start: { email: 1.6, phone: 1.35, address: 1.2 },
  added: { email: 0.7, phone: 0.75, address: 0.8 },
};

export function getReachRows(
  property: PropertyId,
  source: GuestSource,
  range: Range,
): DayRow[] {
  const rows = getRows(property, range);
  if (source === "ota") return rows;
  return rows.map((r) => ({
    date: r.date,
    bookings: Math.round(r.bookings * NON_OTA_SCALE),
    leaves: {
      ota: scaleSplit(r.leaves.ota, NON_OTA_SCALE, NON_OTA_BIAS.start),
      l1: scaleSplit(r.leaves.l1, NON_OTA_SCALE, NON_OTA_BIAS.added),
      journey: scaleSplit(r.leaves.journey, NON_OTA_SCALE, NON_OTA_BIAS.added),
      staff: scaleSplit(r.leaves.staff, NON_OTA_SCALE, NON_OTA_BIAS.added),
      idscan: scaleSplit(r.leaves.idscan, NON_OTA_SCALE, NON_OTA_BIAS.added),
    },
  }));
}

/* ------------------------------------------------------------- aggregation */

const CLEANUP_SHARE = 0.45;

function part(s: FieldSplit, f: number): FieldSplit {
  return {
    email: Math.round(s.email * f),
    phone: Math.round(s.phone * f),
    address: Math.round(s.address * f),
  };
}

function sub(a: FieldSplit, b: FieldSplit): FieldSplit {
  return {
    email: Math.max(0, a.email - b.email),
    phone: Math.max(0, a.phone - b.phone),
    address: Math.max(0, a.address - b.address),
  };
}

function add(...parts: FieldSplit[]): FieldSplit {
  return parts.reduce(
    (acc, s) => ({
      email: acc.email + s.email,
      phone: acc.phone + s.phone,
      address: acc.address + s.address,
    }),
    { email: 0, phone: 0, address: 0 },
  );
}

export const emptySplit = (): FieldSplit => ({ email: 0, phone: 0, address: 0 });

/** Contact details → unique guests. */
export function guestsFromDetails(details: number) {
  return Math.round(details / DETAILS_PER_GUEST);
}

export type Reach = {
  range: Range;
  days: number;
  /** Total bookings analysed in the period. */
  bookings: number;
  /** Reachable contact details at the starting point. */
  start: FieldSplit;
  /** Contact details Level 1 added, and its contributors. */
  level1: FieldSplit;
  level1By: Record<L1SourceKey, FieldSplit>;
  /** Contact details Level 2 added, and its supporting sources. */
  level2: FieldSplit;
  level2By: Record<L2SourceKey, FieldSplit>;
  /** Everything reachable now. */
  now: FieldSplit;
  /** Guest counts (unique guests, never contact details). */
  guests: { start: number; level1: number; level2: number; now: number };
  /** Bookings still available to make reachable. */
  remaining: number;
  /** Bookings that can no longer be recovered. */
  missed: number;
  /** What Level 2 could add if it is not active yet. */
  potentialLevel2: number;
  /** Level 2 is active for this property. */
  level2Active: boolean;
};

export function aggregateReach(
  rows: DayRow[],
  range: Range,
  level2Active: boolean,
): Reach {
  let bookings = 0;
  let start = emptySplit();
  let l1 = emptySplit();
  let journey = emptySplit();
  let staff = emptySplit();
  let idscan = emptySplit();

  for (const r of rows) {
    bookings += r.bookings;
    start = add(start, r.leaves.ota);
    l1 = add(l1, r.leaves.l1);
    journey = add(journey, r.leaves.journey);
    staff = add(staff, r.leaves.staff);
    idscan = add(idscan, r.leaves.idscan);
  }

  const level2 = level2Active ? add(journey, staff, idscan) : emptySplit();
  const cleanup = part(l1, CLEANUP_SHARE);
  const now = add(start, l1, level2);

  const startTotal = splitTotal(start);
  const l1Total = splitTotal(l1);
  const l2Total = splitTotal(level2);
  const nowTotal = splitTotal(now);

  const missed = Math.round(bookings * MISSED_RATE);
  const reachedGuests = guestsFromDetails(nowTotal);
  const remaining = Math.max(0, bookings - reachedGuests - missed);

  return {
    range,
    days: rows.length,
    bookings,
    start,
    level1: l1,
    level1By: { cleanup, whois: sub(l1, cleanup) },
    level2,
    level2By: level2Active
      ? { journey, staff, idscan }
      : { journey: emptySplit(), staff: emptySplit(), idscan: emptySplit() },
    now,
    guests: {
      start: guestsFromDetails(startTotal),
      level1: guestsFromDetails(l1Total),
      level2: guestsFromDetails(l2Total),
      now: reachedGuests,
    },
    remaining,
    missed,
    potentialLevel2: level2Active ? 0 : Math.round(remaining * LEVEL2_POTENTIAL_RATE),
    level2Active,
  };
}

/** Contact details for the selected level + state, as a field split. */
export function splitFor(r: Reach, level: LevelView, state: StateView): FieldSplit {
  if (state === "start") return r.start;
  if (level === "level1") return r.level1;
  if (level === "level2") return r.level2;
  return r.now;
}

/** Guests for the selected level + state. */
export function guestsFor(r: Reach, level: LevelView, state: StateView) {
  if (state === "start") return r.guests.start;
  if (level === "level1") return r.guests.level1;
  if (level === "level2") return r.guests.level2;
  return r.guests.now;
}

/** Uplift always needs a stated reference point (increase / starting value). */
export function uplift(current: number, startValue: number) {
  return startValue > 0 ? (current - startValue) / startValue : 0;
}

/** Share of the total booking population. */
export function shareOfBookings(value: number, bookings: number) {
  return bookings > 0 ? value / bookings : 0;
}

/* ------------------------------------------------------------ time series */

export type ChartSeries = {
  key: string;
  label: string;
  context?: string;
  color: string;
  values: number[];
  prev?: number[];
};

export const FIELD_COLOR: Record<FieldKey, string> = {
  email: "var(--l1)",
  phone: "var(--ceiling)",
  address: "var(--l2)",
};

export const COLORS = {
  reach: "var(--primary)",
  start: "var(--ota)",
  level1: "var(--l1)",
  level2: "var(--l2)",
  remaining: "var(--recoverable)",
  missed: "var(--unrecoverable)",
};

function shade(color: string, amount: number) {
  return `color-mix(in oklab, ${color} ${amount}%, var(--surface-2))`;
}

/** How the timeline is broken down. */
export type TimelineMode = "reach" | "contact" | "levels";

export const TIMELINE_LABELS: Record<TimelineMode, string> = {
  reach: "Guests you can reach",
  contact: "By contact type",
  levels: "See details",
};

export type TimelineOptions = {
  mode: TimelineMode;
  /** Field checkboxes, used in "By contact type". */
  fields: Record<FieldKey, boolean>;
  /** Level checkboxes, used in "See details". */
  levels: { level1: boolean; level2: boolean };
  /** Level 2 supporting sources, used in "See details". */
  sources: Record<L2SourceKey, boolean>;
  showSources: boolean;
  /** Optional remaining-opportunity line. */
  remaining: boolean;
};

export const DEFAULT_TIMELINE: TimelineOptions = {
  mode: "reach",
  fields: { email: true, phone: true, address: true },
  levels: { level1: true, level2: true },
  sources: { journey: true, staff: true, idscan: true },
  showSources: false,
  remaining: false,
};

type RowValue = (row: DayRow) => number;

const dayStart: RowValue = (r) => splitTotal(r.leaves.ota);
const dayL1: RowValue = (r) => splitTotal(r.leaves.l1);
const dayL2 = (active: boolean): RowValue => (r) =>
  active ? splitTotal(r.leaves.journey) + splitTotal(r.leaves.staff) + splitTotal(r.leaves.idscan) : 0;

function dayField(level: LevelView, f: FieldKey, active: boolean): RowValue {
  return (r) => {
    if (level === "level1") return r.leaves.l1[f];
    if (level === "level2")
      return active ? r.leaves.journey[f] + r.leaves.staff[f] + r.leaves.idscan[f] : 0;
    return (
      r.leaves.ota[f] +
      r.leaves.l1[f] +
      (active ? r.leaves.journey[f] + r.leaves.staff[f] + r.leaves.idscan[f] : 0)
    );
  };
}

function reachValue(level: LevelView, state: StateView, active: boolean): RowValue {
  if (state === "start") return dayStart;
  if (level === "level1") return dayL1;
  if (level === "level2") return dayL2(active);
  return (r) => dayStart(r) + dayL1(r) + dayL2(active)(r);
}

function remainingValue(active: boolean): RowValue {
  return (r) => {
    const reached = guestsFromDetails(dayStart(r) + dayL1(r) + dayL2(active)(r));
    return Math.max(0, r.bookings - reached - Math.round(r.bookings * MISSED_RATE));
  };
}

/** Series for the timeline, honouring the level, state and checkbox options. */
export function buildTimeline(
  rows: DayRow[],
  compareRows: DayRow[] | null,
  level: LevelView,
  state: StateView,
  opts: TimelineOptions,
  level2Active: boolean,
): ChartSeries[] {
  const out: { key: string; label: string; context?: string; color: string; value: RowValue }[] = [];

  if (opts.mode === "reach") {
    out.push({
      key: "reach",
      label:
        state === "start"
          ? "Reachable at your starting point"
          : level === "level2"
            ? "Made reachable by Level 2"
            : level === "level1"
              ? "Made reachable by Level 1"
              : "Guests you can reach",
      color: level === "level2" ? COLORS.level2 : level === "level1" ? COLORS.level1 : COLORS.reach,
      value: reachValue(level, state, level2Active),
    });
  }

  if (opts.mode === "contact") {
    for (const f of FIELDS) {
      if (!opts.fields[f]) continue;
      out.push({
        key: `field-${f}`,
        label: FIELD_LABELS[f],
        color: FIELD_COLOR[f],
        value: dayField(level, f, level2Active),
      });
    }
  }

  if (opts.mode === "levels") {
    if (opts.levels.level1)
      out.push({ key: "level1", label: "Level 1", color: COLORS.level1, value: dayL1 });
    if (opts.levels.level2 && level2Active) {
      if (!opts.showSources) {
        out.push({ key: "level2", label: "Level 2", color: COLORS.level2, value: dayL2(true) });
      } else {
        if (opts.sources.journey)
          out.push({
            key: "journey",
            label: L2_SOURCE_LABELS.journey,
            context: "Level 2",
            color: COLORS.level2,
            value: (r) => splitTotal(r.leaves.journey),
          });
        if (opts.sources.staff)
          out.push({
            key: "staff",
            label: L2_SOURCE_LABELS.staff,
            context: "Level 2 · During Stay",
            color: shade(COLORS.level2, 78),
            value: (r) => splitTotal(r.leaves.staff),
          });
        if (opts.sources.idscan)
          out.push({
            key: "idscan",
            label: L2_SOURCE_LABELS.idscan,
            context: "Level 2 · During Stay",
            color: shade(COLORS.level2, 50),
            value: (r) => splitTotal(r.leaves.idscan),
          });
      }
    }
  }

  if (opts.remaining) {
    out.push({
      key: "remaining",
      label: "Remaining opportunity",
      color: COLORS.remaining,
      value: remainingValue(level2Active),
    });
  }

  return out.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    values: rows.map(s.value),
    ...(s.context ? { context: s.context } : {}),
    ...(compareRows ? { prev: compareRows.map(s.value) } : {}),
  }));
}

export function dayLabels(rows: DayRow[]) {
  return rows.map((r) => formatDay(r.date));
}

export function bookingsPerDay(rows: DayRow[]) {
  return rows.map((r) => r.bookings);
}

/* --------------------------------------------------------------- guests */

const FIRST = [
  "Leah", "Marcus", "Sofia", "Daniel", "Amara", "Jonas", "Priya", "Elena",
  "Tomas", "Noah", "Ines", "Karim", "Mia", "Lucas", "Hannah", "Diego",
  "Yara", "Felix", "Nora", "Samuel", "Clara", "Omar", "Ava", "Henrik",
];

const LAST = [
  "Whitfield", "Okonkwo", "Marchetti", "Bergström", "Haddad", "Novak",
  "Ferreira", "Lindqvist", "Rahman", "Delgado", "Kowalski", "Sørensen",
];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Where a guest's contact detail became reachable. */
export type Attribution = "start" | "level1" | "level2" | "none";

export type Guest = {
  id: string;
  name: string;
  city: string;
  stay: string;
  fields: Record<FieldKey, Attribution>;
};

const CITIES = ["Lisbon", "Hamburg", "Osaka", "Toronto", "Nairobi", "Milan", "Austin", "Lyon"];

/**
 * Sample guests behind a level + contact-type result. Deterministic per seed so
 * the same result always lists the same guests.
 */
export function sampleGuests(
  seed: string,
  field: FieldKey,
  level: LevelView,
  count = 12,
): Guest[] {
  const out: Guest[] = [];
  for (let i = 0; i < count; i++) {
    const h = hash(`${seed}:${field}:${level}:${i}`);
    const h2 = hash(`${seed}:${field}:${level}:${i}:b`);
    const name = `${FIRST[Math.floor(h * FIRST.length)]} ${LAST[Math.floor(h2 * LAST.length)]}`;
    const credited: Attribution = level === "combined" ? (h2 > 0.5 ? "level2" : "level1") : level;

    const fields = {} as Record<FieldKey, Attribution>;
    for (const f of FIELDS) {
      if (f === field) {
        fields[f] = credited;
        continue;
      }
      const r = hash(`${seed}:${field}:${level}:${i}:${f}`);
      fields[f] = r > 0.72 ? "start" : r > 0.46 ? "level1" : r > 0.24 ? "level2" : "none";
    }

    out.push({
      id: `${seed}-${field}-${i}`,
      name,
      city: CITIES[Math.floor(h2 * CITIES.length)]!,
      stay: `${2 + Math.floor(h * 5)} nights`,
      fields,
    });
  }
  return out;
}

export const ATTRIBUTION_LABEL: Record<Attribution, string> = {
  start: "Already reachable",
  level1: "Became reachable with Level 1",
  level2: "Became reachable with Level 2",
  none: "Not reachable",
};
