import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, TopBar } from "@/components/SiteChrome";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo tour, Padelion" },
      { name: "description", content: "Five steps through Padelion: book as a guest, pay, find your booking, then see the front desk and owner views." },
      { property: "og:title", content: "Demo tour, Padelion" },
      { property: "og:description", content: "Five steps through Padelion: book as a guest, pay, find your booking, then see the front desk and owner views." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoPage,
});

const STEPS = [
  { title: "Book as a guest", body: "Pick a court, a day and a time. No account needed.", cta: "Open booking", to: "/book" as const },
  { title: "Pay in the sandbox", body: "After you hold a court, pick Apple Pay, Google Pay or the sandbox card and tap Pay. Nothing is charged, and your ticket appears.", cta: "Start a booking", to: "/book" as const },
  { title: "Find your booking", body: "Use Maya's number, 0812 1100 2048. The one-time demo code is shown on screen.", cta: "Find my booking", to: "/find" as const },
  { title: "Sign in as the front desk", body: "Dewi's view: tonight's timeline, payments to check and the waitlist.", cta: "Sign in as desk", to: "/staff/login" as const, search: { as: "desk" as const } },
  { title: "Sign in as the owner", body: "Hendra's view: the week, prices, booking rules and staff.", cta: "Sign in as owner", to: "/staff/login" as const, search: { as: "owner" as const } },
];

function DemoPage() {
  return (
    <>
      <TopBar />
      <main className="wrap section page-pad">
        <div className="stack-8 narrow">
          <div className="stack-3">
            <p className="meta">Demo tour</p>
            <h1 className="pds-display">See Padelion in five steps.</h1>
            <p className="body-lg">Payments and WhatsApp messages are simulated in this demo.</p>
          </div>
          <ol className="demo-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="demo-step">
                <span className="demo-step__n pds-num" aria-hidden="true">{i + 1}</span>
                <div className="stack-2">
                  <h2 className="pds-card-title">{s.title}</h2>
                  <p className="t2">{s.body}</p>
                  <div>
                    <Link to={s.to} search={s.search as never} className="pds-btn pds-btn--public pds-btn--secondary">{s.cta}</Link>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
