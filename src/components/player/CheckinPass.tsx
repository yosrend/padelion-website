import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckBadgeIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { hm, jkt } from "@/lib/padel";
import { siteUrl } from "@/lib/site";

/** The QR a guest shows at the desk or scans at the court. It opens the check-in page with the code and the last 4 digits of their WhatsApp number. */
export function checkinUrl(code: string, wa: string) {
  const k = wa.replace(/\D/g, "").slice(-4);
  const local = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const origin = local ? window.location.origin : siteUrl();
  return `${origin}/checkin?c=${encodeURIComponent(code)}&k=${k}`;
}

export function CheckinPass({ code, wa, checkedInAt }: { code: string; wa: string; checkedInAt?: string | null }) {
  const [svg, setSvg] = useState<string | null>(null);
  const url = checkinUrl(code, wa);
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [url]);
  const k = wa.replace(/\D/g, "").slice(-4);

  if (checkedInAt) {
    return (
      <div className="cpass cpass--done" role="status">
        <span className="cpass__ok" aria-hidden="true"><CheckBadgeIcon /></span>
        <div>
          <p className="cpass__title">Checked in at {hm(jkt(checkedInAt).mins)}</p>
          <p className="cpass__sub">Head to your court. Have a good game.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="cpass">
      <div className="cpass__qr" aria-label={`Check-in QR code for ${code}`} role="img" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}>
        {svg ? undefined : <QrCodeIcon aria-hidden="true" />}
      </div>
      <div className="cpass__text">
        <p className="cpass__title">Your check-in pass</p>
        <p className="cpass__sub">Show it at the desk, or scan it at the screen by your court. No QR? Type <strong className="pds-num">{code}</strong> and <strong className="pds-num">{k}</strong>, the last 4 digits of your WhatsApp.</p>
      </div>
    </div>
  );
}
