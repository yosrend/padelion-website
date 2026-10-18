import { isoAt, type Busy } from "./padel";

/**
 * A believable week at the venue for the demo. Real bookings come from the database;
 * these fill the rest so the grid looks like a club people actually play at:
 * morning regulars, a lunch league, coaching blocks, a busy evening peak and a few unpaid holds.
 * The pattern is fixed per date and court, so every visitor sees the same day.
 */
export type DemoKind = "demo" | "demo-hold" | "demo-league" | "demo-coaching";

function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function demoBusy(date: string, courts: { id: string; sort: number }[], real: Busy[]): Busy[] {
  const dow = new Date(`${date}T12:00:00+07:00`).getUTCDay(); // 0 Sun .. 6 Sat
  const weekend = dow === 0 || dow === 6;
  const out: Busy[] = [];
  const add = (court: string, from: number, len: number, kind: DemoKind) => {
    const s = new Date(isoAt(date, from)).getTime();
    const e = s + len * 60000;
    const clash = [...real, ...out].some((b) => b.court_id === court && new Date(b.starts_at).getTime() < e && new Date(b.ends_at).getTime() > s);
    if (!clash) out.push({ court_id: court, starts_at: isoAt(date, from), ends_at: isoAt(date, from + len), kind });
  };

  for (const c of courts) {
    const r = rand(`${date}:${c.sort}`);
    if (!weekend) {
      if (c.sort === 1) add(c.id, 7 * 60, 90, "demo");                 // morning regulars before work
      if (c.sort === 2 && dow % 2 === 1) add(c.id, 12 * 60, 60, "demo-league"); // lunch league
      if (c.sort === 3 && (dow === 2 || dow === 4)) add(c.id, 16 * 60, 90, "demo-coaching");
      // evening peak: most of 18.00 to 22.00 goes
      for (let m = 18 * 60; m < 22 * 60; m += 90) if (r() < 0.72) add(c.id, m, 90, "demo");
    } else {
      if (c.sort !== 3) add(c.id, 8 * 60, 120, "demo");                  // weekend mornings fill first
      if (c.sort === 3) add(c.id, 9 * 60, 120, "demo-coaching");          // kids' clinic on center court
      for (let m = 15 * 60; m < 22 * 60; m += 90) if (r() < 0.62) add(c.id, m, 90, "demo");
    }
    // a scattering through the day, and one or two unpaid holds that may still free up
    for (let m = 10 * 60; m < 17 * 60; m += 60) if (r() < (weekend ? 0.35 : 0.16)) add(c.id, m, 60, "demo");
    if (r() < 0.7) add(c.id, (17 + Math.floor(r() * 4)) * 60 + (r() < 0.5 ? 30 : 0), 60, "demo-hold");
  }
  return out;
}
