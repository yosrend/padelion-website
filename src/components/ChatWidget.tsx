import { useEffect, useRef, useState } from "react";
import { ChatBubbleOvalLeftEllipsisIcon, PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { idr } from "@/lib/padel";

type Msg = { me?: boolean; text: string; at: string };

const QUICK = ["How much is an hour?", "Is there parking?", "What if it rains?", "Can I move my booking?", "Do you rent rackets?"];

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Auto replies by keyword, in the desk's voice. A real venue would hand these to a person. */
function answer(q: string): string {
  const t = q.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("price", "cost", "how much", "harga", "berapa", "rate", "hour")) return `Court 1 and 2 are ${idr(350000)} an hour off-peak and ${idr(550000)} from 17.00. Court 3 is ${idr(400000)} and ${idr(600000)}. Weekends are peak all day. One price for the court, however many play.`;
  if (has("park", "parkir", "car", "motor")) return "Free parking for 20 cars right at the dome, and a motorbike bay by the entrance.";
  if (has("rain", "hujan", "flood", "banjir", "weather")) return "The courts are under the dome, so rain never stops play. If Kemang Raya floods, we message you and offer a later time for free.";
  if (has("move", "reschedule", "cancel", "change", "pindah", "batal")) return "Open your ticket and tap Reschedule. It is free up to 12 hours before you play. Closer than that, message us here and we will try.";
  if (has("racket", "raket", "ball", "bola", "towel", "rent", "sewa")) return `Rackets are ${idr(35000)} each (balanced, control or power), a can of balls ${idr(60000)}, a towel ${idr(15000)}. Add them when you book or grab them at the desk.`;
  if (has("open", "hours", "jam", "buka", "close", "tutup", "time")) return "We are open every day, 06.00 to 23.00. The last booking starts at 22.00.";
  if (has("member", "club", "langganan")) return "The Social plan is Rp 250.000 a month and the Club plan Rp 650.000. Both give you early booking and member prices. You can join from the Club section on this page.";
  if (has("where", "address", "location", "alamat", "lokasi", "map")) return "Jl. Kemang Raya, South Jakarta. Look for the glass dome among the palms. There is a Google Maps link in the Visit section.";
  if (has("coach", "lesson", "learn", "beginner", "pemula", "latihan")) return "Coach Anto runs beginner sessions on weekday mornings. Book any court and add a note asking for a coach, and we will confirm on WhatsApp.";
  if (has("shoe", "sepatu", "dress", "wear")) return "Clean, non-marking soles only. Street shoes stay off the court. Showers and lockers are free.";
  if (has("hi", "hello", "halo", "hai", "pagi", "sore", "malam")) return "Hi! Ask me about prices, parking, rentals or your booking. The desk reads this too.";
  return "Thanks, the desk has your message and replies here within a few minutes during opening hours. For a booking question, keep your code (like PDL-2048) handy.";
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(0);
  const typing = pending > 0;
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 220); }, [open]);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  function send(q: string) {
    const v = q.trim().slice(0, 280);
    if (!v) return;
    setMsgs((m) => [...m, { me: true, text: v, at: now() }]);
    setText("");
    timers.current.push(window.setTimeout(() => setPending((n) => n + 1), 400));
    timers.current.push(window.setTimeout(() => {
      setPending((n) => Math.max(0, n - 1));
      setMsgs((m) => [...m, { text: answer(v), at: now() }]);
    }, 400 + 900 + Math.min(v.length * 12, 700)));
  }

  return (
    <div className={`chatw${open ? " chatw--open" : ""}`}>
      <div className="chatw__tray" role="dialog" aria-label="Chat with the Padelion desk" aria-hidden={!open} inert={!open ? true : undefined}>
        <div className="chatw__head">
          <img src="/padelion-mark.svg" alt="" width={32} height={32} />
          <div>
            <p className="chatw__title">Padelion desk</p>
            <p className="chatw__sub"><span className="chatw__dot" aria-hidden="true" />Usually replies in a minute</p>
          </div>
          <button type="button" className="chatw__x" onClick={() => setOpen(false)} aria-label="Close chat"><XMarkIcon /></button>
        </div>

        <div className="chatw__list" ref={list} aria-live="polite">
          <div className="chatw__msg"><p className="chatw__bubble">Hi, this is the Padelion desk. Ask anything about courts, prices or your booking.</p></div>
          {msgs.map((m, i) => (
            <div key={i} className={`chatw__msg${m.me ? " chatw__msg--me" : ""}`}>
              <p className="chatw__bubble">{m.text}<span className="chatw__at pds-num">{m.at}</span></p>
            </div>
          ))}
          {typing ? <div className="chatw__msg"><p className="chatw__bubble chatw__typing" aria-label="The desk is typing"><i /><i /><i /></p></div> : null}
          {msgs.length === 0 ? (
            <div className="chatw__quick">
              {QUICK.map((q) => <button key={q} type="button" onClick={() => send(q)}>{q}</button>)}
            </div>
          ) : null}
        </div>

        <form className="chatw__form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Write a message" aria-label="Your message" />
          <button type="submit" disabled={!text.trim()} aria-label="Send"><PaperAirplaneIcon /></button>
        </form>
      </div>

      <button type="button" className="chatw__fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close chat" : "Chat with the desk"}>
        <ChatBubbleOvalLeftEllipsisIcon className="chatw__ico chatw__ico--chat" aria-hidden="true" />
        <XMarkIcon className="chatw__ico chatw__ico--x" aria-hidden="true" />
      </button>
    </div>
  );
}
