import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowPathIcon, CameraIcon, CheckBadgeIcon, ExclamationTriangleIcon, KeyIcon, QrCodeIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/design-system/padelion";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { getStaffMe } from "@/lib/staff";
import { hm, idr, jkt } from "@/lib/padel";
import { photos } from "@/lib/landing-photos";

export const Route = createFileRoute("/checkin")({
  head: () => ({
    meta: [
      { title: "Check in, Padelion Kemang" },
      { name: "description", content: "Scan your ticket or type your code to check in for your game." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { c?: string; k?: string } => ({
    c: typeof s.c === "string" ? s.c : undefined,
    // the router reads "2045" as a number, so take it either way and keep leading zeros by padding
    k: s.k != null && /^\d{1,4}$/.test(String(s.k)) ? String(s.k).padStart(4, "0") : undefined,
  }),
  component: CheckIn,
});

type Result = { code: string; guest_name: string; court: string; starts_at: string; ends_at: string; balance_idr: number; already: boolean; checked_in_at: string; demo?: boolean };

/**
 * Demo venue: WhatsApp codes are simulated, so a code or QR that is not in the system still
 * checks in. The guest sees a clear "demo pass" note instead of an error.
 */
function demoPass(code: string): Result {
  const n = new Date();
  const start = new Date(n);
  start.setMinutes(n.getMinutes() < 30 ? 30 : 60, 0, 0);
  const courts = ["Court 1", "Court 2", "Court 3"];
  const d = code.replace(/\D/g, "");
  return {
    code, guest_name: "Guest", court: courts[(Number(d.slice(-1)) || 0) % 3],
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3600000).toISOString(),
    balance_idr: 0, already: false, checked_in_at: n.toISOString(), demo: true,
  };
}
type Phase = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; r: Result } | { kind: "error"; msg: string };

const RESET_MS = 9000;

/** "2048", "pdl2048", "PDL-2048" and a scanned check-in link all become { code, k }. */
function parse(raw: string): { code: string; k?: string } | null {
  const t = raw.trim();
  try {
    const u = new URL(t);
    const c = u.searchParams.get("c");
    if (c) return { code: c.toUpperCase(), k: u.searchParams.get("k") ?? undefined };
  } catch { /* not a link */ }
  const m = t.toUpperCase().replace(/\s/g, "").match(/^(?:PDL-?)?(\d{3,6})$/);
  return m ? { code: `PDL-${m[1]}` } : null;
}

function CheckIn() {
  const search = Route.useSearch();
  const [staff, setStaff] = useState(false);
  const [mode, setMode] = useState<"scan" | "type">("scan");
  // Opened from a scanned ticket: show "Checking" straight away instead of the scanner.
  const [phase, setPhase] = useState<Phase>(search.c ? { kind: "busy" } : { kind: "idle" });
  const [code, setCode] = useState("");
  const [k, setK] = useState("");
  const kRef = useRef<HTMLInputElement>(null);
  const lastTry = useRef("");

  useEffect(() => {
    getStaffMe().then((me) => setStaff(!!me)).catch(() => {});
  }, []);

  const submit = useCallback(async (c: string, key?: string) => {
    const sig = `${c}|${key ?? ""}`;
    if (lastTry.current === sig) return;
    lastTry.current = sig;
    setPhase({ kind: "busy" });
    // Never leave a guest waiting at the door: a slow answer falls back to the demo pass.
    const slow = new Promise<{ data: null; error: Error }>((res) => setTimeout(() => res({ data: null, error: new Error("timeout") }), 4000));
    const { data, error } = await Promise.race([
      supabase.rpc("check_in" as never, { _code: c, _wa4: key ?? null } as never) as unknown as Promise<{ data: unknown; error: unknown }>,
      slow,
    ]);
    if (error || !data) {
      setPhase({ kind: "ok", r: demoPass(c) });
      return;
    }
    setPhase({ kind: "ok", r: data as unknown as Result });
  }, []);

  // A scanned QR opens this page with the code in the address: confirm straight away.
  useEffect(() => {
    if (search.c) submit(search.c.toUpperCase(), search.k);
  }, []);

  // Typed: confirm on its own once the code and the 4 digits are both in. Staff only need the code.
  useEffect(() => {
    if (mode !== "type" || phase.kind === "busy" || phase.kind === "ok") return;
    const p = parse(code);
    if (!p) return;
    if (staff && code.replace(/\D/g, "").length >= 4) {
      const t = setTimeout(() => submit(p.code), 500);
      return () => clearTimeout(t);
    }
    if (k.length === 4) submit(p.code, k);
  }, [code, k, staff, mode]);

  const reset = useCallback(() => {
    lastTry.current = "";
    setCode("");
    setK("");
    setPhase({ kind: "idle" });
    if (search.c) window.history.replaceState(null, "", "/checkin");
  }, [search.c]);

  // Kiosk: go back to scanning a while after a result, so the next guest can walk up.
  useEffect(() => {
    if (phase.kind !== "ok" && phase.kind !== "error") return;
    const t = setTimeout(reset, phase.kind === "ok" ? RESET_MS : RESET_MS + 4000);
    return () => clearTimeout(t);
  }, [phase, reset]);

  const onScan = useCallback((text: string) => {
    const p = parse(text);
    if (!p) {
      const d = text.replace(/\D/g, "").slice(-4);
      submit(d ? `PDL-${d.padStart(4, "0")}` : `PDL-${String(Math.floor(1000 + Math.random() * 9000))}`);
      return;
    }
    submit(p.code, p.k);
  }, [submit]);

  return (
    <main className="ci">
      <aside className="ci__art" aria-hidden="true">
        <img src={photos.visit.src} alt="" />
        <div className="ci__shade" />
      </aside>
      <section className="ci__panel">
        <header className="ci__top">
          <Link to="/" aria-label="Padelion, home"><Logo className="brand__logo" /></Link>
          <span className="ci__tag">{staff ? "Desk check-in" : "Check-in"}</span>
        </header>

        {phase.kind === "ok" ? (
          <Done r={phase.r} onNext={reset} />
        ) : (
          <div className="ci__body">
            <div className="stack-2">
              <h1 className="ci__title">Welcome to Padelion.</h1>
              <p className="ci__lede">Scan the QR on your ticket, or type your booking code. You are checked in the moment it matches.</p>
            </div>

            <div className="ci__tabs" role="tablist" aria-label="How to check in">
              <button type="button" role="tab" aria-selected={mode === "scan"} onClick={() => { setMode("scan"); setPhase({ kind: "idle" }); lastTry.current = ""; }}>
                <QrCodeIcon aria-hidden="true" />Scan ticket
              </button>
              <button type="button" role="tab" aria-selected={mode === "type"} onClick={() => { setMode("type"); setPhase({ kind: "idle" }); lastTry.current = ""; }}>
                <KeyIcon aria-hidden="true" />Type code
              </button>
            </div>

            {mode === "scan" ? (
              <Scanner active={phase.kind !== "busy"} onResult={onScan} onNoCamera={() => setMode("type")} />
            ) : (
              <div className="ci__type">
                <label className="ci__field">
                  <span>Booking code</span>
                  <span className="ci__code">
                    <span className="ci__prefix">PDL-</span>
                    <input
                      inputMode="numeric"
                      autoFocus
                      placeholder="2048"
                      maxLength={10}
                      value={code.replace(/^PDL-?/i, "")}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setCode(v);
                        if (phase.kind === "error") { setPhase({ kind: "idle" }); lastTry.current = ""; }
                        if (v.length >= 4 && !staff) kRef.current?.focus();
                      }}
                      aria-label="Booking code, the digits after PDL"
                    />
                  </span>
                </label>
                {!staff ? (
                  <label className="ci__field">
                    <span>Last 4 digits of your WhatsApp</span>
                    <input
                      ref={kRef}
                      className="ci__pin pds-num"
                      inputMode="numeric"
                      placeholder="0000"
                      maxLength={4}
                      value={k}
                      onChange={(e) => {
                        setK(e.target.value.replace(/\D/g, "").slice(0, 4));
                        if (phase.kind === "error") { setPhase({ kind: "idle" }); lastTry.current = ""; }
                      }}
                    />
                  </label>
                ) : (
                  <p className="t2">Signed in as staff, so the code is enough.</p>
                )}
              </div>
            )}

            {mode === "type" ? (
              <div className="ci__go">
                <Button disabled={phase.kind === "busy" || !code.replace(/\D/g, "")} onClick={() => { const d = code.replace(/\D/g, ""); lastTry.current = ""; submit(`PDL-${d.padStart(4, "0")}`, k.length === 4 ? k : undefined); }}>Check me in</Button>
              </div>
            ) : null}
            <p className="ci__demo">Demo venue: no real WhatsApp code is sent, so any code or QR checks in. Try any number, like 1234.</p>

            <div className="ci__status" aria-live="polite">
              {phase.kind === "busy" ? <p className="ci__busy"><ArrowPathIcon aria-hidden="true" />Checking your booking</p> : null}
              {phase.kind === "error" ? (
                <div className="ci__error" role="alert">
                  <ExclamationTriangleIcon aria-hidden="true" />
                  <div>
                    <p className="ci__error-t">{phase.msg}</p>
                    <p className="t2">Check the code on your ticket, or ask the desk.</p>
                  </div>
                  <button type="button" className="textbtn" onClick={reset}>Try again</button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Done({ r, onNext }: { r: Result; onNext: () => void }) {
  const first = r.guest_name.split(" ")[0];
  return (
    <div className="ci__body ci__done" role="status">
      <span className="ci__tick" aria-hidden="true"><CheckBadgeIcon /></span>
      <div className="stack-2">
        <p className="ci__eyebrow pds-num">{r.code}</p>
        <h1 className="ci__title">{r.already ? `You are already in, ${first}.` : `You are checked in, ${first}.`}</h1>
        <p className="ci__lede pds-num">
          {r.court}, {hm(jkt(r.starts_at).mins)} to {hm(jkt(r.ends_at).mins)}.{" "}
          {r.already ? `Checked in at ${hm(jkt(r.checked_in_at).mins)}.` : "Head to your court."}
        </p>
      </div>
      {r.demo ? <p className="ci__demo ci__demo--done">Demo pass. This code is not a real booking, so we let you in for testing.</p> : null}
      {r.balance_idr > 0 ? (
        <p className="ci__due pds-num">Balance due at the desk: <strong>{idr(r.balance_idr)}</strong></p>
      ) : (
        <p className="ci__paid">Paid in full. Nothing to settle.</p>
      )}
      <div className="ci__next">
        <Button onClick={onNext} icon={CameraIcon}>Next guest</Button>
        <span className="t3">Resets on its own in a few seconds</span>
      </div>
    </div>
  );
}

/** Camera preview that reads QR codes a few times a second. Falls back to typing when there is no camera. */
function Scanner({ active, onResult, onNoCamera }: { active: boolean; onResult: (t: string) => void; onNoCamera: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"starting" | "on" | "denied">("starting");
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let stopped = false;
    (async () => {
      try {
        // The browser's own reader (Chrome on Android) is fast and sharp. jsQR covers the rest, iPhone included.
        type Det = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Det }).BarcodeDetector;
        let native: Det | null = null;
        try { native = BD ? new BD({ formats: ["qr_code"] }) : null; } catch { native = null; }
        const jsQRload = native ? null : import("jsqr");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const jsQR = jsQRload ? (await jsQRload).default : null;
        setState("on");
        let busy = false;
        let wide = false;
        const tick = (t: number) => {
          raf = requestAnimationFrame(tick);
          if (busy || t - last < 120 || !activeRef.current || v.readyState < 2 || !v.videoWidth) return;
          last = t;
          if (native) {
            busy = true;
            native.detect(v).then((r) => { if (r[0]?.rawValue) onResult(r[0].rawValue); }).catch(() => {}).finally(() => { busy = false; });
            return;
          }
          // Alternate a tight centre square (a QR on another phone's screen) and the full frame.
          const vw = v.videoWidth, vh = v.videoHeight;
          wide = !wide;
          const side = wide ? Math.min(vw, vh) : Math.min(vw, vh) * 0.6;
          const sx = (vw - side) / 2, sy = (vh - side) / 2;
          const size = 640;
          const c = canvas.current!;
          c.width = size;
          c.height = size;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, sx, sy, side, side, 0, 0, size, size);
          const hit = jsQR!(ctx.getImageData(0, 0, size, size).data, size, size, { inversionAttempts: "attemptBoth" });
          if (hit?.data) onResult(hit.data);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setState("denied");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="ci__scan">
      <video ref={video} muted playsInline aria-label="Camera preview" />
      <canvas ref={canvas} hidden />
      <span className="ci__frame" aria-hidden="true"><i /><i /><i /><i /></span>
      {state === "on" ? <span className="ci__laser" aria-hidden="true" /> : null}
      {state === "starting" ? <p className="ci__scan-msg">Starting the camera</p> : null}
      {state === "denied" ? (
        <div className="ci__scan-msg">
          <p>The camera is off for this page.</p>
          <button type="button" className="textbtn" onClick={onNoCamera}>Type your code instead</button>
        </div>
      ) : null}
    </div>
  );
}
