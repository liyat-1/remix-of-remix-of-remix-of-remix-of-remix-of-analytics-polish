/**
 * Time-series graph model.
 *
 * The tree the graph can plot:
 *
 *   Level 1 → OTA baseline / Whois AI → Email / Phone / Address
 *   Level 2 → Guest Journey / During Stay → Staff / ID Scan → Email / Phone / Address
 *   Opportunity remaining (bookings that are not usable yet)
 *
 * Hard rule: when a node is expanded, its children REPLACE it on the graph so
 * parent and child totals are never plotted at the same time.
 */
import {
  FIELDS,
  FIELD_LABELS,
  activeLeaves,
  formatDay,
  splitTotal,
  type DayRow,
  type FieldKey,
  type LeafKey,
  type Selection,
} from "@/lib/analytics-model";

/** Nodes that can be expanded into children. */
export type ExpandKey =
  | "level1"
  | "ota"
  | "whois"
  | "l2"
  | "journey"
  | "duringStay"
  | "staff"
  | "idscan";

export type Expansion = Record<ExpandKey, boolean>;

export const DEFAULT_EXPANSION: Expansion = {
  level1: false,
  ota: false,
  whois: false,
  l2: false,
  journey: false,
  duringStay: false,
  staff: false,
  idscan: false,
};

export type SourceKey = "level1" | "l2";

export const SOURCE_LABELS: Record<SourceKey, string> = {
  level1: "Level 1",
  l2: "Level 2",
};

export function level1On(sel: Selection) {
  return sel.ota || sel.l1;
}

/** What the graph plots: enrichment levels, or the guest information fields. */
export type GraphMode = "levels" | "fields";

export const GRAPH_MODE_LABELS: Record<GraphMode, string> = {
  levels: "Level breakdown",
  fields: "Field breakdown",
};

/** Heading + hint for the "Over time" panel, derived from mode + selection. */
export function graphTitle(sel: Selection, mode: GraphMode = "levels") {
  if (mode === "fields") return "Field breakdown — email, phone and address";
  const l1 = level1On(sel);
  if (l1 && sel.l2) return "Level 1, Level 2 and the opportunity remaining";
  if (l1) return "Level 1 — OTA baseline + Whois AI";
  if (sel.l2) return "Level 2 — Guest Journey + During Stay";
  return "Opportunity remaining";
}

export function graphHint(sel: Selection, mode: GraphMode = "levels") {
  if (mode === "fields")
    return "Usable email, phone and address per day across every selected level. Level series are off while this view is on.";
  const l1 = level1On(sel);
  if (l1 && sel.l2)
    return "Daily usable guest information from Level 1 and Level 2, against the opportunity still open.";
  if (l1)
    return "Guest information usable from the OTA booking itself plus what Whois AI recovers each day.";
  if (sel.l2)
    return "Guest information collected through Guest Journey and During Stay each day.";
  return "Bookings whose guest information is still not usable.";
}

export type GraphNode = {
  /** Stable id, also used for visibility state. */
  key: string;
  label: string;
  /** Optional parent context, e.g. "Staff Collection". */
  context?: string;
  color: string;
  depth: number;
  /** Present when this node can be broken down further. */
  expand?: ExpandKey;
  value: (row: DayRow, sel: Selection) => number;
};

function mix(color: string, amount: number, into = "var(--surface-2)") {
  return `color-mix(in oklab, ${color} ${amount}%, ${into})`;
}

/** Fields get their own distinct hues so they never read as shades of one line. */
const FIELD_HUE: Record<FieldKey, string> = {
  email: "var(--l2)",
  phone: "var(--l1)",
  address: "var(--ceiling)",
};

const leafValue = (k: LeafKey) => (row: DayRow) => splitTotal(row.leaves[k]);

const fieldValue = (k: LeafKey, f: FieldKey) => (row: DayRow) => row.leaves[k][f];

function usableValue(row: DayRow, sel: Selection) {
  return activeLeaves(sel).reduce((s, k) => s + splitTotal(row.leaves[k]), 0);
}

const l2Value = (r: DayRow) =>
  splitTotal(r.leaves.journey) + splitTotal(r.leaves.staff) + splitTotal(r.leaves.idscan);

const stayValue = (r: DayRow) => splitTotal(r.leaves.staff) + splitTotal(r.leaves.idscan);

const level1Value = (r: DayRow) => splitTotal(r.leaves.ota) + splitTotal(r.leaves.l1);

const OTA = "var(--ota)";
const L1 = "var(--l1)";
const L2 = "var(--l2)";

function fieldNodes(leaf: LeafKey, label: string, depth: number): GraphNode[] {
  return FIELDS.map((f) => ({
    key: `${leaf}.${f}`,
    label: FIELD_LABELS[f],
    context: label,
    color: FIELD_HUE[f],
    depth,
    value: fieldValue(leaf, f),
  }));
}

/** A leaf that can only expand into its fields. */
function leafBranch(
  leaf: LeafKey,
  key: ExpandKey,
  label: string,
  color: string,
  depth: number,
  ex: Expansion,
): GraphNode[] {
  if (ex[key]) return fieldNodes(leaf, label, depth + 1);
  return [{ key: leaf, label, color, depth, expand: key, value: leafValue(leaf) }];
}

function level1Branch(sel: Selection, ex: Expansion, depth: number): GraphNode[] {
  const both = sel.ota && sel.l1;
  if (!ex.level1 && both) {
    return [
      {
        key: "level1",
        label: "Level 1",
        color: L1,
        depth,
        expand: "level1",
        value: level1Value,
      },
    ];
  }
  const out: GraphNode[] = [];
  const childDepth = both ? depth + 1 : depth;
  if (sel.ota) out.push(...leafBranch("ota", "ota", "OTA baseline", OTA, childDepth, ex));
  if (sel.l1) out.push(...leafBranch("l1", "whois", "Whois AI", L1, childDepth, ex));
  return out;
}

function duringStayBranch(sel: Selection, ex: Expansion, depth: number): GraphNode[] {
  const both = sel.staff && sel.idscan;
  if (!ex.duringStay && both) {
    return [
      {
        key: "duringStay",
        label: "During Stay",
        context: "Level 2",
        color: mix(L2, 62),
        depth,
        expand: "duringStay",
        value: stayValue,
      },
    ];
  }
  const out: GraphNode[] = [];
  const d = both ? depth + 1 : depth;
  if (sel.staff) out.push(...leafBranch("staff", "staff", "Staff Collection", mix(L2, 82), d, ex));
  if (sel.idscan) out.push(...leafBranch("idscan", "idscan", "ID Scan", mix(L2, 46), d, ex));
  return out;
}

function l2Branch(sel: Selection, ex: Expansion, depth: number): GraphNode[] {
  if (!ex.l2) {
    return [{ key: "l2", label: "Level 2", color: L2, depth, expand: "l2", value: l2Value }];
  }
  const out: GraphNode[] = [];
  if (sel.journey) out.push(...leafBranch("journey", "journey", "Guest Journey", L2, depth + 1, ex));
  if (sel.duringStay) out.push(...duringStayBranch(sel, ex, depth + 1));
  return out;
}

/** Opportunity remaining — bookings whose information is not usable yet. */
function remainingNode(): GraphNode {
  return {
    key: "remaining",
    label: "Opportunity remaining",
    color: "var(--recoverable)",
    depth: 0,
    value: (row, sel) => Math.max(0, row.bookings - usableValue(row, sel)),
  };
}

/** Email / phone / address totals across every selected level. */
function fieldTotalNodes(): GraphNode[] {
  return FIELDS.map((f) => ({
    key: `field.${f}`,
    label: FIELD_LABELS[f],
    context: "Usable",
    color: FIELD_HUE[f],
    depth: 0,
    value: (row: DayRow, sel: Selection) =>
      activeLeaves(sel).reduce((s, k) => s + row.leaves[k][f], 0),
  }));
}

/** The node list the graph should plot for the current mode + expansion. */
export function resolveNodes(sel: Selection, ex: Expansion, mode: GraphMode = "levels"): GraphNode[] {
  if (mode === "fields") return fieldTotalNodes();
  const out: GraphNode[] = [];
  if (level1On(sel)) out.push(...level1Branch(sel, ex, 0));
  if (sel.l2) out.push(...l2Branch(sel, ex, 0));
  out.push(remainingNode());
  return out;
}

export type ChartSeries = {
  key: string;
  label: string;
  context?: string;
  color: string;
  values: number[];
  prev?: number[];
};

export function buildChartSeries(
  nodes: GraphNode[],
  rows: DayRow[],
  compareRows: DayRow[] | null,
  sel: Selection,
): ChartSeries[] {
  return nodes.map((n) => {
    const values = rows.map((r) => n.value(r, sel));
    const prev = compareRows ? compareRows.map((r) => n.value(r, sel)) : undefined;
    return {
      key: n.key,
      label: n.label,
      color: n.color,
      values,
      ...(n.context ? { context: n.context } : {}),
      ...(prev ? { prev } : {}),
    };
  });
}

export function dayLabels(rows: DayRow[]) {
  return rows.map((r) => formatDay(r.date));
}

/** Total bookings per day — the context line every tooltip should carry. */
export function bookingsPerDay(rows: DayRow[]) {
  return rows.map((r) => r.bookings);
}
