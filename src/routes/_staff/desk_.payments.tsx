import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHead, SectionHead } from "@/components/staff/StaffUI";
import { CheckBadgeIcon, ExclamationTriangleIcon, InboxArrowDownIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BanknotesIcon, ExclamationCircleIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, KpiCard } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { hm, idr, jkt } from "@/lib/padel";
import { fetchBookingsList, fetchCourtsAll, fetchPayments, rpc, useLive, type Row } from "@/lib/desk-data";

export const Route = createFileRoute("/_staff/desk_/payments")({
  head: () => ({
    meta: [
      { title: "Payments to check, Padelion front desk" },
      { name: "description", content: "Sort out overpayments, missing codes and late payments." },
      { property: "og:title", content: "Payments to check, Padelion front desk" },
      { property: "og:description", content: "Sort out overpayments, missing codes and late payments." },
    ],
  }),
  component: Payments,
});

const METHOD: Record<string, string> = { qris: "Online", va: "Transfer", transfer: "Transfer", cash: "Cash" };

function Payments() {
  const qc = useQueryClient();
  useLive("payments", ["payments", "bookings"]);
  const pay = useQuery({ queryKey: ["desk", "payments"], queryFn: fetchPayments });
  const courts = useQuery({ queryKey: ["desk", "courts"], queryFn: fetchCourtsAll });
  const [leaving, setLeaving] = useState<string[]>([]);
  const courtName = (id?: string) => courts.data?.find((c) => c.id === id)?.name ?? "Court";

  const received = (pay.data?.today ?? []).filter((p) => p.status === "received" || p.resolution === "matched" || p.resolution === "honored");
  const sum = (m?: string) => received.filter((p) => !m || p.method === m).reduce((s, p) => s + p.amount_idr, 0);
  const flagged = pay.data?.flagged ?? [];

  function resolved(id: string) {
    setLeaving((l) => [...l, id]);
    setTimeout(() => qc.invalidateQueries({ queryKey: ["desk"] }), 220);
  }

  return (
    <main className="stack-8">
      <PageHead icon={BanknotesIcon} eyebrow="Front desk" title="Payments to check" desc="Money that did not line up with a booking. Sort each one out in a tap." />

      {pay.error ? (
        <Card surface="desk"><p className="pds-body" role="alert">Payments didn't load. Refresh to try again.</p></Card>
      ) : pay.isLoading ? (
        <div className="skel skel--timeline" aria-busy="true" />
      ) : (
        <>
          <div className="kpi-grid kpi-grid--3">
            <KpiCard icon={ExclamationCircleIcon} label="To check" value={String(flagged.length)} sub="Flagged payments" />
            <KpiCard icon={BanknotesIcon} label="Received today" value={idr(sum())} sub={`${received.length} payments`} />
            <KpiCard icon={QrCodeIcon} label="Online vs cash" value={`${idr(sum("qris"))} / ${idr(sum("cash"))}`} sub="Online first, then cash" />
          </div>

          <section className="stack-4" aria-labelledby="look">
            <SectionHead id="look" icon={ExclamationTriangleIcon} title="Needs a look" hint="Overpaid, no booking code, or paid after the hold ended" />
            {flagged.length === 0 ? (
              <Card surface="desk"><Empty icon={CheckBadgeIcon} title="Every payment is sorted" desc="New ones show up here on their own." /></Card>
            ) : (
              <div className="stack-4">
                {flagged.map((p, i) => (
                  <div key={p.id} className={`fade${leaving.includes(p.id) ? " fade--out" : ""}`}>
                    <FlagCard p={p} primary={i === 0} courtName={courtName} onDone={() => resolved(p.id)} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="stack-4" aria-labelledby="rec">
            <SectionHead id="rec" icon={InboxArrowDownIcon} title="Received today" hint="Newest first" />
            {received.length === 0 ? (
              <Card surface="desk"><Empty icon={InboxArrowDownIcon} title="No payments yet today" /></Card>
            ) : (
              <Card surface="desk" className="needs">
                {received.map((p) => (
                  <div key={p.id} className="rec-row">
                    <span className="pds-meta pds-num">{hm(jkt(p.created_at).mins)}</span>
                    <span className="pds-body">{p.bookings?.guest_name ?? p.payer ?? "Guest"}</span>
                    <span className="pds-meta">{METHOD[p.method] ?? p.method}</span>
                    <span className="pds-label pds-num">{idr(p.amount_idr)}</span>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function FlagCard({ p, primary, courtName, onDone }: { p: Row; primary: boolean; courtName: (id?: string) => string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = (first: boolean) => (primary && first ? "primary" : "secondary");

  async function act(action: string, booking?: string) {
    setBusy(true);
    setErr(null);
    try {
      await rpc("resolve_payment", { _payment: p.id, _action: action, _booking: booking ?? null });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  let body: React.ReactNode = null;
  if (p.flag === "overpaid") {
    const due = p.note?.match(/Rp [\d.]+/)?.[0];
    body = (
      <>
        <div className="stack-1">
          <p className="pds-meta">{p.bookings?.code}, overpaid</p>
          <p className="pds-card-title">{p.payer} overpaid {idr(p.amount_idr)}</p>
          <p className="pds-body">Sent {idr(p.amount_idr)}{due ? ` for a deposit of ${due}` : ""}.</p>
        </div>
        <div className="row-actions">
          <Button surface="desk" variant={v(true)} disabled={busy} onClick={() => act("refund")}>Refund</Button>
          <Button surface="desk" variant="secondary" disabled={busy} onClick={() => act("credit")}>Keep as credit</Button>
        </div>
      </>
    );
  } else if (p.flag === "no_code") {
    body = <NoCode p={p} busy={busy} variant={v(true)} courtName={courtName} onMatch={(id) => act("match", id)} />;
  } else if (p.flag === "late") {
    body = <Late p={p} busy={busy} variant={v(true)} courtName={courtName} act={act} />;
  }

  return (
    <Card surface="desk" className="stack-4 flag-card">
      {body}
      {err ? <p className="pds-meta alert-text" role="alert">{err}</p> : null}
    </Card>
  );
}

function NoCode({ p, busy, variant, courtName, onMatch }: {
  p: Row; busy: boolean; variant: "primary" | "secondary"; courtName: (id?: string) => string; onMatch: (id: string) => void;
}) {
  const list = useQuery({ queryKey: ["desk", "bookings"], queryFn: fetchBookingsList });
  const [q, setQ] = useState("");
  const open = (list.data ?? []).filter((b) => b.status === "deposit_paid" && b.total_idr > b.paid_idr);
  const payer = (p.payer ?? "").toLowerCase();
  const suggested =
    open.find((b) => b.guest_name.toLowerCase().includes(payer) && b.total_idr - b.paid_idr === p.amount_idr) ??
    open.find((b) => b.guest_name.toLowerCase().includes(payer)) ??
    open.find((b) => b.total_idr - b.paid_idr === p.amount_idr);
  const term = q.trim().toLowerCase();
  const hits = term ? open.filter((b) => b.guest_name.toLowerCase().includes(term) || b.code.toLowerCase().includes(term)).slice(0, 5) : [];
  const label = (b: Row) => `${b.guest_name}, ${courtName(b.court_id)}, ${hm(jkt(b.starts_at).mins)}`;

  return (
    <>
      <div className="stack-1">
        <p className="pds-meta">Transfer, no booking code</p>
        <p className="pds-card-title">{p.payer ?? "A guest"} sent {idr(p.amount_idr)} with no booking code</p>
        {suggested ? <p className="pds-body">Looks like {label(suggested)} ({suggested.code}), balance {idr(suggested.total_idr - suggested.paid_idr)}.</p> : <p className="pds-body">No obvious match. Search below.</p>}
      </div>
      {suggested ? (
        <div className="row-actions">
          <Button surface="desk" variant={variant} disabled={busy} onClick={() => onMatch(suggested.id)}>Match to this booking</Button>
        </div>
      ) : null}
      <Input label="Or find another booking" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or code" />
      {hits.length ? (
        <ul className="plain-list stack-2">
          {hits.map((b) => (
            <li key={b.id} className="pick-row">
              <span className="pds-body">{b.code}, {label(b)}</span>
              <Button surface="desk" variant="secondary" disabled={busy} onClick={() => onMatch(b.id)}>Match</Button>
            </li>
          ))}
        </ul>
      ) : term ? <p className="pds-meta">No open booking matches.</p> : null}
    </>
  );
}

function Late({ p, busy, variant, courtName, act }: {
  p: Row; busy: boolean; variant: "primary" | "secondary"; courtName: (id?: string) => string; act: (a: string) => void;
}) {
  const b = p.bookings;
  const free = useQuery({
    queryKey: ["desk", "slotfree", p.id],
    enabled: !!b,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("slot_free" as never, { _court: b.court_id, _s: b.starts_at, _e: b.ends_at, _except: p.booking_id } as never);
      if (error) throw new Error(error.message);
      return data as unknown as boolean;
    },
  });
  const where = b ? `${courtName(b.court_id)}, ${hm(jkt(b.starts_at).mins)}` : p.note;
  return (
    <>
      <div className="stack-1">
        <p className="pds-meta">Late online payment, {where}</p>
        <p className="pds-card-title">{idr(p.amount_idr)} arrived after the hold ran out</p>
        <p className="pds-body">
          {free.isLoading ? "Checking the slot." : free.data ? "The slot is still free, so you can honour it." : "Someone else has the slot now. Refund the guest."}
        </p>
      </div>
      <div className="row-actions">
        {free.data ? (
          <Button surface="desk" variant={variant} disabled={busy} onClick={() => act("honor")}>Honor it</Button>
        ) : null}
        <Button surface="desk" variant={free.data ? "secondary" : variant} disabled={busy || free.isLoading} onClick={() => act("refund")}>Refund</Button>
      </div>
    </>
  );
}
