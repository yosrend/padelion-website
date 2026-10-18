import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { Logo } from "@/components/Logo";
import { checkinUrl } from "@/components/player/CheckinPass";
import { courtLook } from "@/lib/landing-photos";
import { dayLabel, hm, jkt, timeLabel, type BookingView } from "@/lib/padel";

/**
 * The ticket as a ticket: the game on the main part, a tear-off stub with the check-in QR.
 * Side by side on desktop, stacked on phones.
 */
export function PadelTicket({ b, wa, status, balance, money, live }: {
  b: BookingView; wa: string; status: string; balance: number; money: (n: number) => string; live: boolean;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const url = checkinUrl(b.code, wa);
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } }).then(setSvg).catch(() => setSvg(null));
  }, [url]);
  const look = courtLook({ name: b.court });
  const s = jkt(b.starts_at);
  const k = wa.replace(/\D/g, "").slice(-4);

  return (
    <article className={`pticket${look.center ? " pticket--green" : ""}${live ? "" : " pticket--void"}`} aria-label={`Ticket ${b.code}`}>
      <div className="pticket__main">
        <img className="pticket__photo" src={look.photo.src} alt="" aria-hidden="true" />
        <div className="pticket__top">
          <Logo className="pticket__logo" />
          <span className="pticket__status">{status}</span>
        </div>
        <div className="pticket__when">
          <p className="pticket__day pds-num">{dayLabel(s.date)}</p>
          <p className="pticket__time pds-num">{hm(s.mins)}<span> to {timeLabel(b.ends_at)}</span></p>
        </div>
        <dl className="pticket__facts">
          <div><dt>Court</dt><dd>{b.court}</dd></div>
          <div><dt>Player</dt><dd>{b.guest_name}</dd></div>
          <div><dt>Paid</dt><dd className="pds-num">{money(b.paid_idr)}</dd></div>
          <div><dt>{balance > 0 ? "Balance" : "Balance"}</dt><dd className="pds-num">{balance > 0 ? money(balance) : "Nothing left"}</dd></div>
        </dl>
        {b.addons.length || b.note ? (
          <p className="pticket__extras pds-num">
            {b.addons.map((a) => `${a.qty} × ${a.name}`).join(", ")}
            {b.addons.length && b.note ? ". " : ""}
            {b.note ? `“${b.note}”` : ""}
          </p>
        ) : null}
      </div>
      <div className="pticket__stub">
        {b.checked_in_at ? (
          <div className="pticket__in">
            <CheckBadgeIcon aria-hidden="true" />
            <p>Checked in at {hm(jkt(b.checked_in_at).mins)}</p>
          </div>
        ) : (
          <div className="pticket__qr" role="img" aria-label={`Check-in QR for ${b.code}`} dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
        )}
        <p className="pticket__code pds-num">{b.code}</p>
        <p className="pticket__hint">Scan at the desk or by your court. No QR? Type the code and <strong className="pds-num">{k}</strong>.</p>
      </div>
    </article>
  );
}
