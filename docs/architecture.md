# Architecture

```
Browser (React 19, TanStack Router)
   |  public pages: server rendered, guest calls go through RPCs
   |  staff pages: client rendered, signed-in Supabase session
   v
TanStack Start server (Cloudflare Worker)
   |  server functions: demo staff accounts (service role, server only)
   v
Supabase
   Postgres: tables with row level security
   RPCs: every booking state change, SECURITY DEFINER with checks inside
   Auth: staff email and password, roles in the staff table
   Realtime: desk and owner screens update live
   pg_cron: run_minute_jobs every minute, reset_demo every night
```

## Rules the code follows

- **Guests never touch tables directly.** Guest access goes through SECURITY DEFINER RPCs (`get_availability`, `create_hold`, `get_booking`, `pay_booking`, `pay_balance`, `join_waitlist`, `reschedule_booking`, `check_in`). Tables stay closed to the anon role, so a guest can never read another player's name or number.
- **A booking is found by code plus WhatsApp number.** The number is kept in sessionStorage per code and never put in a URL.
- **Holds expire in the database.** `run_minute_jobs()` runs every minute. It releases expired holds, ends waitlist offers and hands the slot to the next player, and queues reminders. Guest reads also treat a past hold as expired, so nothing depends on the job firing on the second.
- **Staff roles.** Staff pages live under the pathless `_staff` layout with SSR off. The role comes from the `my_staff()` RPC. Front desk and owner are the two roles (`staff_role` enum).
- **Cross-table staff actions are RPCs** with a role check inside: `mark_paid`, `resolve_payment`, `move_booking`, `cancel_booking`, `create_block`, `waitlist_offer_now`, `waitlist_remove`, `end_hold_and_offer`, `reset_demo`. Simple single-table staff writes go through RLS from the browser client.
- **Settings in one row.** Hold length, deposit percentage, balance hours, reschedule hours and offer minutes live in `venue_settings` and are read through `public.vs()` by every RPC and job.
- **Time.** Everything is stored as `timestamptz` and shown in Asia/Jakarta through helpers in `src/lib/padel.ts`.
- **Demo data is marked.** Demo rows carry `is_demo = true`. `reset_demo()` deletes and rebuilds only those rows for today's Jakarta date and puts settings, prices, add-ons and staff back to the baseline. Owner week figures come from `owner_week()`, which adds live non-demo bookings to the `week_baseline` numbers.
- **Styling is plain CSS.** Tokens and components live in `src/design-system/padelion`, page styles in `src/styles.css`. The staff area has a scoped theme under `.staff-shell`.

## Folder map

```
src/
  routes/                 file-based routes (see docs/routes.md)
    _staff/               desk and owner pages behind sign-in
  components/
    landing/              hero, walkthrough, 3D court and racket, sections
    player/               ticket, check-in pass, date picker, pay methods, waitlist sheet
    staff/                shared staff UI (timeline, KPI cards) and owner charts
  design-system/padelion/ tokens, base components, styles
  integrations/supabase/  browser client, server client, auth middleware, types
  lib/                    booking helpers, queries, currency, validation, site URL
  styles.css              page and staff theme styles
supabase/
  migrations/             schema, RPCs, policies, jobs, seed
public/                   images, video, icons, share image
```

## Performance and access

- The 3D court and racket load only when their section enters the viewport, with a static fallback.
- The QR reader library loads only when the camera starts. The check-in page falls back to a clear message if the network is slow.
- `prefers-reduced-motion` stops scroll motion and the hero video. `prefers-reduced-transparency` replaces glass with solid fills.
- Every control is reachable by keyboard with a visible focus ring.
