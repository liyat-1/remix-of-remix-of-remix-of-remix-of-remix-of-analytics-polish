import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { nf } from "@/lib/analytics-model";
import { LEVEL2_POTENTIAL_RATE, type Reach } from "@/lib/reach-model";

/**
 * Remaining opportunity and missed opportunities — secondary context that must
 * never be mixed with what Directful has already delivered.
 */
export function OpportunityPanel({ r, rangeLabel }: { r: Reach; rangeLabel: string }) {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Remaining opportunity</h2>
        <p className="text-sm text-muted-foreground">
          Guest data from this period that is still available to make reachable.
        </p>
        <div className="num mt-3 text-4xl font-bold" style={{ color: "var(--recoverable)" }}>
          {nf.format(r.remaining)}
        </div>
        <p className="num mt-1 text-xs text-muted-foreground">{rangeLabel}</p>

        {!r.level2Active && (
          <div className="mt-5 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <h3 className="font-semibold">Reach more guests with Level 2</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Level 2 could make {Math.round(LEVEL2_POTENTIAL_RATE * 100)}% of your remaining
              eligible booking data reachable — around{" "}
              <span className="num font-semibold text-foreground">
                {nf.format(r.potentialLevel2)}
              </span>{" "}
              more guests.
            </p>
            <p className="mt-1 text-xs font-medium tracking-wide text-primary uppercase">
              Potential — not included in your results
            </p>
            <Button className="mt-3 gap-1.5">
              See Level 2 pricing <ArrowUpRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Missed opportunities</h2>
        <p className="text-sm text-muted-foreground">
          Guest data we could no longer recover for this period.
        </p>
        <div className="num mt-3 text-4xl font-bold text-muted-foreground">
          {nf.format(r.missed)}
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total bookings analysed</dt>
            <dd className="num font-semibold">{nf.format(r.bookings)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Guests you can reach</dt>
            <dd className="num font-semibold text-primary">{nf.format(r.guests.now)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Remaining opportunity</dt>
            <dd className="num font-semibold">{nf.format(r.remaining)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Missed opportunities</dt>
            <dd className="num font-semibold">{nf.format(r.missed)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
