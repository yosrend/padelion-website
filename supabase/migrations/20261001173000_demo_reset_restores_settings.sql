-- Keep the public demo safe for judges and visitors.
-- 1. Everything a guest creates while payments are sandbox counts as demo data, so the nightly reset clears it.
alter table public.bookings alter column is_demo set default true;
alter table public.payments alter column is_demo set default true;
alter table public.waitlist_entries alter column is_demo set default true;
alter table public.court_blocks alter column is_demo set default true;

-- 2. reset_demo also puts back what the shared demo owner account can change: settings, prices, add-ons, courts and staff.
do $do$
declare _def text := pg_get_functiondef('public.reset_demo()'::regprocedure);
begin
  if position('restore venue settings' in _def) > 0 then return; end if;
  _def := replace(_def, '  delete from public.notifications where booking_id in (select id from public.bookings where is_demo);', $r$
  -- restore venue settings, prices, add-ons, courts and staff to the demo baseline
  update public.venue_settings set deposit_pct = 50, hold_minutes = 15, offer_minutes = 15, balance_hours = 2, reschedule_hours = 12, updated_at = now() where id = 1;
  update public.price_rules p set off_peak_idr = case when c.sort = 3 then 400000 else 350000 end, peak_idr = case when c.sort = 3 then 600000 else 550000 end,
    weekday_peak_start = 17, weekday_peak_end = 23, weekend_all_peak = true from public.courts c where c.id = p.court_id;
  update public.addons set is_active = true, price_idr = case name when 'Can of 3 balls' then 60000 when 'Towel' then 15000 else 35000 end
    where name in ('Racket, Control','Racket, Balanced','Racket, Power','Can of 3 balls','Towel');
  update public.courts set is_active = true where sort in (1,2,3);
  delete from public.staff where email is null or email not in ('owner@padelion.demo','desk@padelion.demo','anto@padelion.demo');
  update public.staff set role = 'owner', name = 'Hendra Wijaya' where email = 'owner@padelion.demo';
  update public.staff set role = 'front_desk', name = 'Dewi' where email = 'desk@padelion.demo';
  update public.staff set role = 'front_desk', name = 'Anto' where email = 'anto@padelion.demo';
  delete from public.court_blocks where is_demo;

  delete from public.notifications where booking_id in (select id from public.bookings where is_demo);$r$);
  execute _def;
end $do$;
