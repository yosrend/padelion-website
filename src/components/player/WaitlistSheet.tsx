import { useEffect, useState } from "react";
import { PhoneField } from "@/components/player/PhoneField";
import { Button, Input } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { ordinal } from "@/lib/padel";
import { normalizeWa, rules, useFieldErrors } from "@/lib/validate";

export function waitlistCopy(pos: number, offerMin: number) {
  return `You are ${ordinal(pos)} in line. We hold it for you for ${offerMin} minutes when it opens.`;
}

export function WaitlistSheet({
  title, courtId, startsAt, offerMin, initialName = "", initialWa = "", onClose,
}: {
  title: string; courtId: string; startsAt: string; offerMin: number; initialName?: string; initialWa?: string; onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [wa, setWa] = useState(initialWa);
  const [pos, setPos] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const form = useFieldErrors({ name: () => rules.name(name), wa: () => rules.wa(wa) });

  async function join() {
    if (!form.check({ name: "wl-name", wa: "wl-wa" })) return;
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("join_waitlist", { _court: courtId, _starts: startsAt, _name: name.trim(), _wa: normalizeWa(wa) ?? wa });
    setBusy(false);
    if (error) return setErr(error.message);
    setPos(data as number);
  }

  return (
    <div className="psheet" role="dialog" aria-modal="true" aria-labelledby="wl-h">
      <button type="button" className="psheet__scrim" aria-label="Close" onClick={onClose} />
      <div className="psheet__panel stack-5">
        <div className="stack-2">
          <p className="meta">Waitlist</p>
          <h2 id="wl-h" className="pds-card-title">{title}</h2>
        </div>
        {pos != null ? (
          <>
            <p className="body-lg" aria-live="polite">{waitlistCopy(pos, offerMin)}</p>
            <div><Button variant="secondary" onClick={onClose}>Done</Button></div>
          </>
        ) : (
          <form className="stack-4" onSubmit={(e) => { e.preventDefault(); join(); }}>
            <Input id="wl-name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={50} error={form.error("name")} {...form.blur("name")} />
            <PhoneField id="wl-wa" hint="We message you here when it opens." value={wa} onChange={setWa} error={form.error("wa")} {...form.blur("wa")} />
            {err ? <p className="notice notice--error" role="alert">{err}</p> : null}
            <div className="row">
              <Button type="submit" variant="secondary" disabled={busy}>
                {busy ? "Adding you" : "Join the waitlist"}
              </Button>
              <button type="button" className="textbtn" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
