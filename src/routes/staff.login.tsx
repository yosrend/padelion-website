import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button, Glass, Input } from "@/design-system/padelion";
import { ArrowRightIcon, BuildingStorefrontIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { Logo } from "@/components/Logo";
import { photos } from "@/lib/landing-photos";
import { supabase } from "@/integrations/supabase/client";
import { getStaffMe, homeFor } from "@/lib/staff";
import { DEMO_PASSWORD, DEMO_STAFF, ensureDemoStaff } from "@/lib/staff.functions";

import { rules, useFieldErrors } from "@/lib/validate";
export const Route = createFileRoute("/staff/login")({
  head: () => ({
    meta: [
      { title: "Staff sign in, Padelion" },
      { name: "description", content: "Sign in for the Padelion venue team." },
      { property: "og:title", content: "Staff sign in, Padelion" },
      { property: "og:description", content: "Sign in for the Padelion venue team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { as?: "desk" | "owner" } => ({
    as: s.as === "desk" || s.as === "owner" ? s.as : undefined,
  }),
  component: StaffLogin,
});

function StaffLogin() {
  const navigate = useNavigate();
  const ensure = useServerFn(ensureDemoStaff);
  const { as } = Route.useSearch();
  const preset = as ? DEMO_STAFF.find((d) => d.email.startsWith(as)) : undefined;
  const [email, setEmail] = useState(preset?.email ?? "");
  const [password, setPassword] = useState(preset ? DEMO_PASSWORD : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensure().catch(() => {});
    getStaffMe().then((me) => {
      if (me) navigate({ to: homeFor(me.role), replace: true });
    });
  }, []);

  const form = useFieldErrors({ email: () => rules.email(email), password: () => rules.password(password) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.check({ email: "staff-email", password: "staff-password" })) return;
    await signIn(email.trim(), password);
  }

  // Demo buttons sign straight in, so a visitor can open the desk or the owner view in one tap.
  async function signIn(mail: string, pass: string) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
    if (err) {
      setBusy(false);
      setError("That email and password don't match.");
      return;
    }
    const me = await getStaffMe();
    if (!me) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("This account is not on the venue team.");
      return;
    }
    navigate({ to: homeFor(me.role), replace: true });
  }

  return (
    <main className="slogin">
      <aside className="slogin__art">
        <img src={photos.cta.src} alt="" aria-hidden="true" />
        <div className="slogin__shade" aria-hidden="true" />
        <a href="/" className="slogin__logo" aria-label="Padelion, open the public site"><Logo className="brand__logo" /></a>
        <Glass className="slogin__copy">
          <p className="slogin__eyebrow">Venue team</p>
          <p className="slogin__line">Run tonight's courts from one screen.</p>
          <p className="slogin__sub">Who is playing, who still owes, and what needs you before play.</p>
        </Glass>
      </aside>
      <section className="slogin__panel">
        <div className="slogin__box">
          <div className="stack-2">
            <h1 className="slogin__title">Staff sign in</h1>
            <p className="t2">Accounts are made by the owner. There is no public sign up.</p>
          </div>

          <div className="slogin__demo" aria-label="Demo access">
            <p className="slogin__label">Try the demo, one tap</p>
            {DEMO_STAFF.map((s) => (
              <button key={s.email} type="button" className="demo-card" disabled={busy} onClick={() => signIn(s.email, DEMO_PASSWORD)}>
                <span className="demo-card__icon" aria-hidden="true">{s.role === "owner" ? <ChartBarIcon /> : <BuildingStorefrontIcon />}</span>
                <span className="demo-card__text">
                  <span className="demo-card__title">{s.role === "owner" ? "Owner view" : "Front desk"}</span>
                  <span className="demo-card__sub">{s.role === "owner" ? `${s.name}, prices, staff and the week` : `${s.name}, today's courts and payments`}</span>
                </span>
                <ArrowRightIcon className="demo-card__go" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="slogin__or"><span>or sign in with your account</span></div>

          <form className="stack-4" onSubmit={submit}>
            <Input id="staff-email" label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={form.error("email")} {...form.blur("email")} />
            <Input id="staff-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={form.error("password")} {...form.blur("password")} />
            {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
            <Button type="submit" surface="desk" disabled={busy}>{busy ? "Signing in" : "Sign in"}</Button>
          </form>
        </div>
      </section>
    </main>
  );
}
