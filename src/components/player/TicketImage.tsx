import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowDownTrayIcon, PhotoIcon, ShareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/design-system/padelion";
import { siteHost } from "@/lib/site";
import { checkinUrl } from "@/components/player/CheckinPass";
import { courtLook } from "@/lib/landing-photos";
import { dayLabel, hm, jkt, timeLabel, type BookingView } from "@/lib/padel";

const W = 1080;
const H = 1800;
const SPLIT = 1010;
const INK = "#3a261c";
const NEON = "#d4ff3a";
const DISPLAY = '"Satoshi", "Inter", system-ui, sans-serif';
const BODY = '"Inter", system-ui, sans-serif';

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

/** Draws the ticket as one portrait image: the game on top, the QR and how to arrive on the stub. */
export async function renderTicket(o: { b: BookingView; wa: string; status: string; balance: number; money: (n: number) => string }) {
  const { b, wa, status, balance, money } = o;
  await document.fonts?.ready;
  const look = courtLook({ name: b.court });
  const top = look.center ? INK : "#2d4e9c";
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // page
  ctx.fillStyle = "#f6f7f4";
  ctx.fillRect(0, 0, W, H);
  const M = 48;
  const TW = W - M * 2;

  // ticket body clip
  ctx.save();
  rr(ctx, M, M, TW, H - M * 2, 44);
  ctx.clip();

  // top: colour with the court photo faded on the right
  ctx.fillStyle = top;
  ctx.fillRect(M, M, TW, SPLIT - M);
  try {
    const photo = await load(look.photo.src);
    ctx.save();
    ctx.globalAlpha = 0.38;
    cover(ctx, photo, M, M, TW, SPLIT - M);
    ctx.restore();
    const g = ctx.createLinearGradient(M, 0, M + TW, 0);
    g.addColorStop(0, top);
    g.addColorStop(0.55, top + "cc");
    g.addColorStop(1, top + "33");
    ctx.fillStyle = g;
    ctx.fillRect(M, M, TW, SPLIT - M);
  } catch { /* photo is decoration */ }

  // stub
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(M, SPLIT, TW, H - SPLIT - M);
  ctx.restore();

  // notches and perforation
  ctx.fillStyle = "#f6f7f4";
  for (const x of [M, M + TW]) { ctx.beginPath(); ctx.arc(x, SPLIT, 30, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "#c9ccc4";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 14]);
  ctx.beginPath(); ctx.moveTo(M + 48, SPLIT); ctx.lineTo(M + TW - 48, SPLIT); ctx.stroke();
  ctx.setLineDash([]);

  const L = M + 64;
  const R = M + TW - 64;

  // logo
  try {
    const mark = await load("/padelion-mark.svg");
    ctx.drawImage(mark, L, M + 60, 64, 64);
  } catch { /* text still names the venue */ }
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 50px ${DISPLAY}`;
  ctx.textBaseline = "middle";
  ctx.fillText("padelion", L + 80, M + 94);

  // status pill
  ctx.font = `600 28px ${BODY}`;
  const pw = ctx.measureText(status).width + 48;
  ctx.fillStyle = "#ffffff";
  rr(ctx, R - pw, M + 66, pw, 56, 28); ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(status, R - pw + 24, M + 95);

  // when
  const s = jkt(b.starts_at);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `500 36px ${BODY}`;
  ctx.fillText(dayLabel(s.date), L, M + 250);
  ctx.fillStyle = "#ffffff";
  ctx.font = `500 220px ${DISPLAY}`;
  const t = hm(s.mins);
  ctx.fillText(t, L - 8, M + 470);
  const tw = ctx.measureText(t).width;
  ctx.font = `500 56px ${DISPLAY}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`to ${timeLabel(b.ends_at)}`, L + tw + 12, M + 470);

  // facts
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(L, M + 540); ctx.lineTo(R, M + 540); ctx.stroke();
  const facts: [string, string][] = [
    ["Court", b.court],
    ["Player", b.guest_name],
    ["Paid", money(b.paid_idr)],
    ["Balance", balance > 0 ? money(balance) : "Nothing left"],
  ];
  const colW = (R - L) / 2;
  facts.forEach(([k, v], i) => {
    const x = L + (i % 2) * colW;
    const y = M + 610 + Math.floor(i / 2) * 120;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `500 28px ${BODY}`;
    ctx.fillText(k, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 42px ${BODY}`;
    let val = v;
    while (ctx.measureText(val).width > colW - 24 && val.length > 4) val = val.slice(0, -2);
    ctx.fillText(val === v ? v : val + "…", x, y + 52);
  });
  const extras = b.addons.map((a) => `${a.qty} × ${a.name}`).join(", ");
  if (extras) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `500 28px ${BODY}`;
    let e = `Extras: ${extras}`;
    while (ctx.measureText(e).width > R - L && e.length > 10) e = e.slice(0, -2);
    ctx.fillText(e === `Extras: ${extras}` ? e : e + "…", L, M + 880);
  }

  // stub: QR on the left, code and arrival on the right
  const qrSize = 300;
  const qy = SPLIT + 70;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, checkinUrl(b.code, wa), { width: qrSize, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } });
  ctx.drawImage(qr, L, qy, qrSize, qrSize);

  const X = L + qrSize + 56;
  ctx.fillStyle = "#6b6e66";
  ctx.font = `500 26px ${BODY}`;
  ctx.fillText("Booking code", X, qy + 30);
  ctx.fillStyle = INK;
  ctx.font = `500 78px ${DISPLAY}`;
  ctx.fillText(b.code, X, qy + 112);
  ctx.fillStyle = "#6b6e66";
  ctx.font = `500 26px ${BODY}`;
  const k = wa.replace(/\D/g, "").slice(-4);
  ctx.fillText("Scan at the desk, or type", X, qy + 170);
  ctx.fillText(`the code and ${k}.`, X, qy + 206);
  ctx.font = `600 26px ${BODY}`;
  const pill = "Show this at the desk";
  ctx.fillStyle = NEON;
  rr(ctx, X, qy + 240, ctx.measureText(pill).width + 52, 56, 28); ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(pill, X + 26, qy + 277);

  // arrival rows
  const rows: [string, string][] = [
    ["Arrive", `15 minutes early, by ${hm(Math.max(0, s.mins - 15))}`],
    ["Where", "Jl. Kemang Raya, South Jakarta"],
    ["Bring", "Non-marking shoes. Showers are free"],
  ];
  let y = qy + qrSize + 90;
  ctx.strokeStyle = "#ecede8";
  rows.forEach(([kk, v]) => {
    ctx.beginPath(); ctx.moveTo(L, y - 46); ctx.lineTo(R, y - 46); ctx.stroke();
    ctx.fillStyle = "#6b6e66";
    ctx.font = `500 26px ${BODY}`;
    ctx.fillText(kk, L, y);
    ctx.fillStyle = INK;
    ctx.font = `500 30px ${BODY}`;
    ctx.fillText(v, L + 150, y);
    y += 76;
  });
  ctx.fillStyle = "#9a9c95";
  ctx.font = `500 22px ${BODY}`;
  ctx.textAlign = "center";
  ctx.fillText(`${siteHost()}  ·  Open every day, 06.00 to 23.00`, W / 2, H - M - 40);
  ctx.textAlign = "left";

  return new Promise<Blob>((res, rej) => c.toBlob((bl) => (bl ? res(bl) : rej(new Error("render"))), "image/png"));
}

/** Save and share bar under the ticket, with a preview of the exact image that gets saved. */
export function TicketImageBar(props: { b: BookingView; wa: string; status: string; balance: number; money: (n: number) => string }) {
  const { b } = props;
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const name = `padelion-${b.code}.png`;

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function make() {
    if (blob) return blob;
    setBusy(true);
    try {
      const bl = await renderTicket(props);
      setBlob(bl);
      setUrl(URL.createObjectURL(bl));
      return bl;
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setNote(null);
    await make();
    setOpen(true);
  }

  async function download() {
    const bl = await make();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(bl);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setNote("Saved. Check your downloads or photos.");
  }

  async function share() {
    setNote(null);
    const bl = await make();
    const file = new File([bl], name, { type: "image/png" });
    const text = `Padel at Padelion: ${b.court}, ${dayLabel(jkt(b.starts_at).date)}, ${timeLabel(b.starts_at)} to ${timeLabel(b.ends_at)}. Code ${b.code}.`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Padelion ticket", text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Padelion ticket", text, url: window.location.href });
        return;
      }
      await download();
      setNote("This browser cannot share images, so the ticket was saved instead.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Could not share. Save the image and send it yourself.");
    }
  }

  return (
    <div className="timg">
      <div className="timg__bar">
        <p className="timg__lede">Keep the ticket on your phone. It works without signal.</p>
        <div className="timg__btns">
          <Button variant="secondary" icon={PhotoIcon} onClick={preview} disabled={busy}>{busy ? "Making image" : "View image"}</Button>
          <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={download} disabled={busy}>Save</Button>
          <Button icon={ShareIcon} onClick={share} disabled={busy}>Share</Button>
        </div>
      </div>
      {note && !open ? <p className="t2 timg__note" role="status">{note}</p> : null}

      <dialog ref={dlg} className="timg__dlg" aria-label="Ticket image" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="timg__sheet">
          <div className="timg__head">
            <p className="pds-label">Your ticket image</p>
            <button type="button" className="timg__x" onClick={() => setOpen(false)} aria-label="Close"><XMarkIcon /></button>
          </div>
          {url ? <img className="timg__img" src={url} alt={`Ticket ${b.code} for ${b.court}`} /> : null}
          {note ? <p className="t2" role="status">{note}</p> : null}
          <div className="timg__btns timg__btns--sheet">
            <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={download}>Save image</Button>
            <Button icon={ShareIcon} onClick={share}>Share</Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
