import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/design-system/padelion";
import { SiteFooter, TopBar } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { dayLabel, idr, jkt, rememberWa, timeLabel } from "@/lib/padel";

type Offer = {
  id: string; court: string; court_id: string; starts_at: string; status: string;
  offer_expires_at: string | null; guest: string; total_idr: number; deposit_idr: number;
};

import { useMoney } from "@/lib/currency";
export const Route = createFileRoute("/offer/$id")({
  head: () => ({
    meta: [
      { title: "A court opened up for you at Padelion" },
      { name: "description", content: "A time you waited for is free. Take it or pass it to the next player." },
      { property: "og:title", content: "A court opened up for you at Padelion" },
      { property: "og:description", content: "A time you waited for is free. Take it or pass it to the next player." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfferPage,
});

function OfferPage() {
  const money = useMoney();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const q = useQuery({
    queryKey: ["offer", id],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_offer", { _id: id });
      if (error) throw error;
      return data as unknown as Offer | null;
    },
  });
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);

  const o = q.data;
  const left = o?.offer_expires_at && now != null ? Math.max(0, new Date(o.offer_expires_at).getTime() - now) : 0;
  const live = !!o && o.status === "offered" && left > 0 && !passed;

  async function take() {
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("take_offer", { _id: id });
    setBusy(false);
    if (error) { setErr(error.message); q.refetch(); return; }
    const r = data as { code: string; wa: string };
    rememberWa(r.code, r.wa);
    navigate({ to: "/booking/$code", params: { code: r.code } });
  }
  async function pass() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.rpc("pass_offer", { _id: id });
    setBusy(false);
    if (error) return setErr(error.message);
    setPassed(true);
  }

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  return (
    <>
      <TopBar />
      <main className="wrap page-pad">
        <div className="stack-8 narrow">
          {!valid || (!q.isLoading && !o) ? (
            <div className="stack-4">
              <h1 className="pds-section-title">We could not find that offer</h1>
              <Link to="/book" className="textlink">Book a court</Link>
            </div>
          ) : q.isLoading || !o || now == null ? (
            <p className="t2">Loading your offer</p>
          ) : passed ? (
            <div className="stack-4">
              <h1 className="pds-display">Thanks for letting us know</h1>
              <p className="body-lg">We passed it to the next player in line.</p>
              <Link to="/book" className="textlink">Find another time</Link>
            </div>
          ) : o.status === "taken" ? (
            <div className="stack-4">
              <h1 className="pds-display">You already took this time</h1>
              <Link to="/find" className="textlink">Find my booking</Link>
            </div>
          ) : !live ? (
            <div className="stack-4">
              <h1 className="pds-display">This offer ended and went to the next player</h1>
              <Link to="/book" className="textlink">Find another time</Link>
            </div>
          ) : (
            <>
              <div className="stack-3">
                <p className="meta">Waitlist offer for {o.guest.split(" ")[0]}</p>
                <h1 className="pds-display pds-num">
                  {o.court}, {dayLabel(jkt(o.starts_at).date)}, {timeLabel(o.starts_at)} is yours if you want it
                </h1>
              </div>
              <p className="hold-box pds-num" aria-live="polite">
                Held for you for {mm}:{String(ss).padStart(2, "0")}
              </p>
              <p className="t2 pds-num">60 min, {money(o.total_idr)}. Pay the deposit now and the rest before you play.</p>
              {err ? <p className="notice notice--error" role="alert">{err}</p> : null}
              <div className="row">
                <Button disabled={busy} onClick={take}>Take it, pay {money(o.deposit_idr)}</Button>
                <Button variant="secondary" disabled={busy} onClick={pass}>Pass</Button>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
