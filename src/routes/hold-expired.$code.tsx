import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button, Slot, SlotGrid } from "@/design-system/padelion";
import { SiteFooter, TopBar } from "@/components/SiteChrome";
import { waitlistCopy } from "@/components/player/WaitlistSheet";
import { supabase } from "@/integrations/supabase/client";
import { availabilityQuery, catalogQuery, settingsQuery } from "@/lib/queries";
import { CLOSE_MIN, OPEN_MIN, dayLabel, hm, isoAt, jkt, overlaps, recallWa, rememberWa, type BookingView } from "@/lib/padel";

export const Route = createFileRoute("/hold-expired/$code")({
  head: () => ({
    meta: [
      { title: "Your hold ran out at Padelion" },
      { name: "description", content: "Your court hold ended. Hold it again, pick a nearby time or join the waitlist." },
      { property: "og:title", content: "Your hold ran out at Padelion" },
      { property: "og:description", content: "Your court hold ended. Hold it again, pick a nearby time or join the waitlist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HoldExpiredPage,
});

function HoldExpiredPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [wa, setWa] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const w = recallWa(code);
    if (!w) navigate({ to: "/booking/$code", params: { code }, replace: true });
    setWa(w);
  }, [code, navigate]);

  return (
    <>
      <TopBar />
      <main className="wrap page-pad">
        {wa ? <Expired code={code} wa={wa} /> : null}
      </main>
      <SiteFooter />
    </>
  );
}

function Expired({ code, wa }: { code: string; wa: string }) {
  const navigate = useNavigate();
  const b = useQuery({
    queryKey: ["booking", code, wa],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booking", { _code: code, _wa: wa });
      if (error) throw error;
      return data as unknown as BookingView | null;
    },
  });
  const st = useQuery(settingsQuery);
  const cat = useQuery(catalogQuery);
  const date = b.data ? jkt(b.data.starts_at).date : "";
  const avail = useQuery({ ...availabilityQuery(date), enabled: !!date, staleTime: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<number | null>(null);
  const [nowMins, setNowMins] = useState<number | null>(null);
  useEffect(() => {
    const n = jkt(new Date());
    setNowMins(n.date === date ? n.mins : n.date > date ? CLOSE_MIN : -1);
  }, [date]);

  const bk = b.data;
  const startMin = bk ? jkt(bk.starts_at).mins : 0;
  const busyList = avail.data ?? [];
  const stillFree = !!bk && !!avail.data && nowMins != null && startMin > nowMins && !overlaps(busyList, bk.court_id, date, startMin, bk.minutes);

  const nearest = useMemo(() => {
    if (!bk || !avail.data || nowMins == null || !cat.data) return [];
    const out: { courtId: string; court: string; m: number }[] = [];
    for (const c of cat.data.courts) {
      for (let m = OPEN_MIN; m + bk.minutes <= CLOSE_MIN; m += 30) {
        if (m <= nowMins) continue;
        if (c.id === bk.court_id && m === startMin) continue;
        if (!overlaps(busyList, c.id, date, m, bk.minutes)) out.push({ courtId: c.id, court: c.name, m });
      }
    }
    return out.sort((a, z) => Math.abs(a.m - startMin) - Math.abs(z.m - startMin) || a.m - z.m).slice(0, 3);
  }, [bk, avail.data, nowMins, cat.data, busyList, date, startMin]);

  async function hold(courtId: string, m: number) {
    if (!bk) return;
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("create_hold", {
      _court: courtId, _starts: isoAt(date, m), _minutes: bk.minutes, _name: bk.guest_name, _wa: wa, _email: "", _addons: [],
    });
    setBusy(false);
    if (error || !data) {
      setErr(error?.message ?? "Something went wrong. Try again.");
      avail.refetch();
      return;
    }
    rememberWa(data, wa);
    navigate({ to: "/booking/$code", params: { code: data } });
  }

  async function join() {
    if (!bk) return;
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("join_waitlist", { _court: bk.court_id, _starts: bk.starts_at, _name: bk.guest_name, _wa: wa });
    setBusy(false);
    if (error) return setErr(error.message);
    setPos(data as number);
  }

  if (b.isLoading) return <p className="t2">Loading</p>;
  if (!bk) return (
    <div className="stack-4">
      <h1 className="pds-section-title">We could not find that booking</h1>
      <Link to="/find" className="textlink">Find my booking</Link>
    </div>
  );
  if (bk.status !== "expired" && bk.status !== "hold") {
    return (
      <div className="stack-4">
        <h1 className="pds-section-title">This booking is still active</h1>
        <Link to="/booking/$code" params={{ code }} className="textlink">Open your ticket</Link>
      </div>
    );
  }

  const t = hm(startMin);
  return (
    <div className="stack-10 narrow">
      <div className="stack-3">
        <p className="meta pds-num">{code}, {dayLabel(date)}</p>
        <h1 className="pds-display">Your hold ran out</h1>
        <p className="body-lg pds-num">{bk.court}, {t} went back to the schedule after {st.data?.hold_minutes ?? 15} minutes.</p>
      </div>

      <section className="stack-4" aria-live="polite">
        {!avail.data ? (
          <p className="t2">Checking that time</p>
        ) : stillFree ? (
          <>
            <p className="t2 pds-num">{bk.court}, {t} is still free.</p>
            <div><Button disabled={busy} onClick={() => hold(bk.court_id, startMin)}>Hold it again</Button></div>
          </>
        ) : (
          <p className="pds-card-title">Someone else took it</p>
        )}
      </section>

      {err ? <p className="notice notice--error" role="alert">{err}</p> : null}

      <section className="block" aria-labelledby="near-h">
        <div className="block__head">
          <h2 id="near-h" className="pds-card-title">Nearest open times</h2>
          <p className="t2 pds-num">{dayLabel(date)}, {bk.minutes} min, any court.</p>
        </div>
        {nearest.length === 0 ? (
          <p className="t2">{avail.data ? "Nothing else is open that day." : "Loading"}</p>
        ) : (
          <SlotGrid>
            {nearest.map((n) => (
              <div key={n.courtId + n.m} className="slot-wait">
                <Slot time={hm(n.m)} disabled={busy} aria-label={`Hold ${n.court} at ${hm(n.m)}`} onClick={() => hold(n.courtId, n.m)} />
                <span className="meta">{n.court}</span>
              </div>
            ))}
          </SlotGrid>
        )}
      </section>

      {!stillFree && avail.data ? (
        <section className="stack-3">
          <h2 className="pds-card-title pds-num">Join the waitlist for {t}</h2>
          {pos != null ? (
            <p className="body-lg" role="status">{waitlistCopy(pos, st.data?.offer_minutes ?? 15)}</p>
          ) : (
            <>
              <p className="t2">We message {wa} if it opens up.</p>
              <div><Button variant="secondary" disabled={busy} onClick={join}>Join the waitlist</Button></div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
