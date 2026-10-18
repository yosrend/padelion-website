import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHead } from "@/components/staff/StaffUI";
import { courtLook } from "@/lib/landing-photos";
import { UsersIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Chip } from "@/design-system/padelion";
import { dayLabel, hm, jkt } from "@/lib/padel";
import { activeBooking, fetchBookingsList, fetchCourtsAll, fetchWaitlist, mmss, rpc, useLive, useNow, type Row } from "@/lib/desk-data";

export const Route = createFileRoute("/_staff/desk_/waitlist")({
  head: () => ({
    meta: [
      { title: "Waitlist, Padelion front desk" },
      { name: "description", content: "Who is waiting for which court, and who has an offer running." },
      { property: "og:title", content: "Waitlist, Padelion front desk" },
      { property: "og:description", content: "Who is waiting for which court, and who has an offer running." },
    ],
  }),
  component: Waitlist,
});

function Waitlist() {
  const qc = useQueryClient();
  const now = useNow();
  useLive("waitlist", ["waitlist_entries", "bookings"]);
  const wl = useQuery({ queryKey: ["desk", "waitlist"], queryFn: fetchWaitlist });
  const courts = useQuery({ queryKey: ["desk", "courts"], queryFn: fetchCourtsAll });
  const bookings = useQuery({ queryKey: ["desk", "bookings"], queryFn: fetchBookingsList });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const courtName = (id: string) => courts.data?.find((c) => c.id === id)?.name ?? "Court";

  const groups = new Map<string, Row[]>();
  for (const w of wl.data ?? []) {
    const k = `${w.court_id}|${new Date(w.starts_at).getTime()}`;
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  let neonUsed = false;

  async function act(key: string, name: string, args: Record<string, unknown>) {
    setBusy(key);
    setErr(null);
    try {
      await rpc(name, args);
      qc.invalidateQueries({ queryKey: ["desk"] });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <main className="stack-8">
      <PageHead icon={UsersIcon} eyebrow="Front desk" title="Waitlist" desc="Players waiting for a full time. When a hold runs out, the next one gets an offer on their own." />
      {err ? <p className="pds-meta alert-text" role="alert">{err}</p> : null}

      {wl.error ? (
        <Card surface="desk"><p className="pds-body" role="alert">The waitlist didn't load. Refresh to try again.</p></Card>
      ) : wl.isLoading ? (
        <div className="skel skel--timeline" aria-busy="true" />
      ) : groups.size === 0 ? (
        <Card surface="desk"><Empty icon={UsersIcon} title="Nobody is waiting" desc="When a time is full, players can join here from the booking page." /></Card>
      ) : (
        <div className="wl-grid">
          {[...groups.entries()].map(([k, list]) => {
            const first = list[0];
            const offered = list.find((w) => w.status === "offered");
            const waiting = list.filter((w) => w.status === "waiting");
            const hold = (bookings.data ?? []).find(
              (b) => b.status === "hold" && activeBooking(b, now) && b.court_id === first.court_id && new Date(b.starts_at).getTime() === new Date(first.starts_at).getTime(),
            );
            const s = jkt(first.starts_at);
            let state: React.ReactNode;
            if (offered) {
              state = <p className="pds-label pds-num" aria-live="polite">Held for {offered.guest}, {mmss(new Date(offered.offer_expires_at).getTime() - now)}</p>;
            } else if (hold) {
              const primary = !neonUsed;
              neonUsed = true;
              state = (
                <div className="stack-3">
                  <p className="pds-label pds-num">Guest hold ends {hm(jkt(hold.hold_expires_at!).mins)}</p>
                  {waiting[0] ? (
                    <Button surface="desk" variant={primary ? "primary" : "secondary"} disabled={busy === k} onClick={() => act(k, "end_hold_and_offer", { _booking: hold.id })}>
                      End hold, offer to {waiting[0].guest}
                    </Button>
                  ) : null}
                </div>
              );
            } else {
              state = <p className="pds-meta">Queue only</p>;
            }
            return (
              <Card key={k} surface="desk" className="stack-4">
                <div className="stack-1">
                  <p className="pds-meta pds-num">{dayLabel(s.date)}, {hm(s.mins)}</p>
                  <h2 className="pds-card-title court-tag"><span className={`court-dot${courtLook({ name: courtName(first.court_id) }).center ? " court-dot--green" : ""}`} aria-hidden="true" />{courtName(first.court_id)}</h2>
                </div>
                {state}
                <ol className="wl-queue">
                  {list.map((w, i) => (
                    <li key={w.id} className="wl-person">
                      <span className="pds-meta pds-num">{i + 1}</span>
                      <span className="pds-body">{w.guest}</span>
                      {w.status === "offered" ? <Chip tone="balance">Offer sent</Chip> : <span />}
                      <div className="row-actions">
                        {w.status !== "offered" ? (
                          <Button surface="desk" variant="secondary" disabled={busy === w.id} onClick={() => act(w.id, "waitlist_offer_now", { _entry: w.id })}>Offer now</Button>
                        ) : null}
                        <button type="button" className="text-btn pds-label" disabled={busy === w.id} onClick={() => act(w.id, "waitlist_remove", { _entry: w.id })}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
