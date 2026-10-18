create table public.venue_settings (
  id int primary key default 1 check (id = 1),
  hold_minutes int not null default 15 check (hold_minutes between 5 and 60),
  deposit_pct int not null default 50 check (deposit_pct between 10 and 100),
  balance_hours int not null default 2 check (balance_hours between 0 and 48),
  reschedule_hours int not null default 12 check (reschedule_hours between 0 and 168),
  offer_minutes int not null default 15 check (offer_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);
grant select on public.venue_settings to anon, authenticated;
grant update on public.venue_settings to authenticated;
grant all on public.venue_settings to service_role;
alter table public.venue_settings enable row level security;
create policy "Anyone reads settings" on public.venue_settings for select to anon, authenticated using (true);
create policy "Owners update settings" on public.venue_settings for update to authenticated using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));
insert into public.venue_settings (id) values (1);

create table public.week_baseline (id int primary key default 1 check (id = 1), data jsonb not null);
grant select on public.week_baseline to authenticated;
grant all on public.week_baseline to service_role;
alter table public.week_baseline enable row level security;
create policy "Owners read baseline" on public.week_baseline for select to authenticated using (public.is_owner(auth.uid()));
insert into public.week_baseline (data) values ('{"online":41,"total":46,"revenue":96800000,"no_shows":1,"holds_released":7,"court_hours":{"1":71,"2":78,"3":49},"capacity":119}');

alter table public.addons add column if not exists is_active boolean not null default true;
alter table public.staff add column if not exists email text;
alter table public.staff alter column user_id drop not null;
update public.staff s set email = u.email from auth.users u where u.id = s.user_id and s.email is null;
insert into public.staff (name, role, email) select 'Anto', 'front_desk', 'anto@padelion.demo' where not exists (select 1 from public.staff where email = 'anto@padelion.demo');

create or replace function public.vs() returns public.venue_settings language sql stable security definer set search_path = public as $$ select * from public.venue_settings where id = 1 $$;
revoke all on function public.vs() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_hold(_court uuid, _starts timestamp with time zone, _minutes integer, _name text, _wa text, _email text, _addons jsonb)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _ends timestamptz := _starts + make_interval(mins => _minutes); _local timestamp := _starts at time zone 'Asia/Jakarta';
  _sub int; _add int := 0; _b public.bookings; a jsonb; _price int; _hold int := (public.vs()).hold_minutes;
begin
  if _minutes not in (60,90,120) then raise exception 'Choose 60, 90 or 120 minutes'; end if;
  if length(trim(coalesce(_name,''))) < 2 or length(trim(_name)) > 80 then raise exception 'Add your name'; end if;
  if length(public.norm_wa(_wa)) < 8 or length(public.norm_wa(_wa)) > 14 then raise exception 'Add a valid WhatsApp number'; end if;
  if _starts < now() then raise exception 'That time has passed'; end if;
  if _local::time < '06:00' or (_ends at time zone 'Asia/Jakarta')::time > '23:00' or (_ends at time zone 'Asia/Jakarta')::date <> _local::date then raise exception 'We are open 06.00 to 23.00'; end if;
  if not exists (select 1 from public.courts where id = _court and is_active) then raise exception 'Court not found'; end if;
  if exists (select 1 from public.bookings b where b.court_id = _court and public.booking_is_active(b) and b.starts_at < _ends and b.ends_at > _starts)
     or exists (select 1 from public.court_blocks c where c.court_id = _court and c.starts_at < _ends and c.ends_at > _starts)
  then raise exception 'Someone just took that slot. Pick another time.'; end if;
  _sub := public.price_for(_court, _starts, _minutes);
  for a in select * from jsonb_array_elements(coalesce(_addons,'[]'::jsonb)) loop
    select price_idr into _price from public.addons where id = (a->>'addon_id')::uuid and is_active;
    if _price is null or (a->>'qty')::int < 1 or (a->>'qty')::int > 8 then raise exception 'Invalid add-on'; end if;
    _add := _add + _price * (a->>'qty')::int;
  end loop;
  insert into public.bookings (court_id, starts_at, ends_at, guest_name, guest_whatsapp, guest_email, status, subtotal_idr, addons_idr, total_idr, hold_expires_at)
  values (_court, _starts, _ends, trim(_name), trim(_wa), nullif(trim(coalesce(_email,'')),''), 'hold', _sub, _add, _sub + _add, now() + make_interval(mins => _hold)) returning * into _b;
  for a in select * from jsonb_array_elements(coalesce(_addons,'[]'::jsonb)) loop
    insert into public.booking_addons (booking_id, addon_id, qty, unit_price_idr)
    select _b.id, id, (a->>'qty')::int, price_idr from public.addons where id = (a->>'addon_id')::uuid;
  end loop;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'hold_created', 'Your court is held for ' || _hold || ' minutes. Code ' || _b.code);
  insert into public.system_log (kind, message, booking_id) values ('hold', 'Guest hold created', _b.id);
  return _b.code;
end $function$;

CREATE OR REPLACE FUNCTION public.pay_booking(_code text, _wa text, _mode text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _b public.bookings; _amt int; _s public.venue_settings := public.vs();
begin
  select * into _b from public.bookings where upper(code) = upper(trim(_code)) and public.norm_wa(guest_whatsapp) = public.norm_wa(_wa) for update;
  if _b.id is null then raise exception 'Booking not found'; end if;
  if _b.status <> 'hold' or _b.hold_expires_at <= now() then raise exception 'This hold has ended. Book again.'; end if;
  _amt := case when _mode = 'full' then _b.total_idr else (_b.total_idr * _s.deposit_pct / 100) end;
  insert into public.payments (booking_id, amount_idr, method, payer, note) values (_b.id, _amt, 'qris', _b.guest_name, 'Sandbox QRIS');
  update public.bookings set paid_idr = _amt, status = case when _amt >= total_idr then 'paid' else 'deposit_paid' end,
    balance_due_at = case when _amt >= total_idr then null else starts_at - make_interval(hours => _s.balance_hours) end, hold_expires_at = null where id = _b.id;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'payment_received', 'Payment received for ' || _b.code || '. See you on court.');
  if _amt < _b.total_idr then
    insert into public.notifications (booking_id, kind, body, send_at) values (_b.id, 'balance_reminder', 'Your balance for ' || _b.code || ' is due in 2 hours.', _b.starts_at - make_interval(hours => _s.balance_hours + 2));
  end if;
  insert into public.system_log (kind, message, booking_id) values ('payment', 'Sandbox QRIS payment', _b.id);
  return public.get_booking(_code, _wa);
end $function$;

CREATE OR REPLACE FUNCTION public.offer_next(_court uuid, _starts timestamp with time zone)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare w public.waitlist_entries; _cname text; _m int := (public.vs()).offer_minutes;
begin
  if exists (select 1 from public.waitlist_entries where court_id=_court and starts_at=_starts and status='offered') then return; end if;
  if exists (select 1 from public.bookings b where b.court_id=_court and public.booking_is_active(b) and b.starts_at < _starts + interval '60 minutes' and b.ends_at > _starts) then return; end if;
  select * into w from public.waitlist_entries where court_id=_court and starts_at=_starts and status='waiting' order by position limit 1 for update;
  if w.id is null then return; end if;
  select name into _cname from public.courts where id=_court;
  update public.waitlist_entries set status='offered', offer_expires_at=now()+make_interval(mins => _m) where id=w.id;
  insert into public.notifications (kind, body) values ('waitlist_offer',
    w.guest || ', ' || _cname || ' at ' || to_char(_starts at time zone 'Asia/Jakarta','HH24.MI') || ' is free. It is yours for ' || _m || ' minutes.');
  insert into public.system_log (kind, message) values ('waitlist', 'Offer sent to ' || w.guest || ', ' || _cname || ', ' || to_char(_starts at time zone 'Asia/Jakarta','HH24.MI'));
end $function$;

create or replace function public.waitlist_offer_now(_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w public.waitlist_entries; _c text; _m int := (public.vs()).offer_minutes;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into w from public.waitlist_entries where id=_entry for update;
  if w.id is null then raise exception 'Not found'; end if;
  select name into _c from public.courts where id=w.court_id;
  update public.waitlist_entries set status='passed', offer_expires_at=null where court_id=w.court_id and starts_at=w.starts_at and status='offered' and id<>w.id;
  update public.waitlist_entries set status='offered', offer_expires_at=now()+make_interval(mins => _m) where id=w.id;
  insert into public.notifications (kind, body) values ('waitlist_offer', w.guest || ', ' || _c || ' at ' || public._jt(w.starts_at) || ' is free. It is yours for ' || _m || ' minutes.');
  insert into public.system_log (kind, message) values ('waitlist', 'Offer sent to ' || w.guest || ', ' || _c || ', ' || public._jt(w.starts_at) || ', by the desk');
end $$;

CREATE OR REPLACE FUNCTION public.run_minute_jobs()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r record; _s public.venue_settings := public.vs();
begin
  for r in update public.bookings b set status='expired', hold_expires_at=null
      where b.status='hold' and b.hold_expires_at <= now()
      returning b.id, b.court_id, b.starts_at loop
    insert into public.system_log (kind, message, booking_id)
      select 'hold_released', 'Hold released, ' || c.name || ', ' || to_char(r.starts_at at time zone 'Asia/Jakarta','HH24.MI'), r.id
      from public.courts c where c.id = r.court_id;
    perform public.offer_next(r.court_id, r.starts_at);
  end loop;

  for r in update public.waitlist_entries set status='expired'
      where status='offered' and offer_expires_at <= now()
      returning court_id, starts_at, guest loop
    insert into public.system_log (kind, message) values ('waitlist', 'Offer to ' || r.guest || ' ran out');
    if r.starts_at > now() then perform public.offer_next(r.court_id, r.starts_at); end if;
  end loop;

  insert into public.notifications (booking_id, kind, body, send_at)
  select b.id, 'reminder_day_before', 'See you tomorrow, ' || c.name || ' at ' || to_char(b.starts_at at time zone 'Asia/Jakarta','HH24.MI') || '. Code ' || b.code || '.', b.starts_at - interval '1 day'
  from public.bookings b join public.courts c on c.id=b.court_id
  where b.status in ('deposit_paid','paid') and b.starts_at > now()
    and not exists (select 1 from public.notifications n where n.booking_id=b.id and n.kind='reminder_day_before');

  insert into public.notifications (booking_id, kind, body, send_at)
  select b.id, 'reminder_2h', 'Your game on ' || c.name || ' starts at ' || to_char(b.starts_at at time zone 'Asia/Jakarta','HH24.MI') || '. Code ' || b.code || '.'
    || case when b.paid_idr < b.total_idr then ' Your balance is due ' || _s.balance_hours || ' hours before play.' else '' end,
    b.starts_at - interval '2 hours'
  from public.bookings b join public.courts c on c.id=b.court_id
  where b.status in ('deposit_paid','paid') and b.starts_at > now()
    and not exists (select 1 from public.notifications n where n.booking_id=b.id and n.kind='reminder_2h');
end $function$;

create or replace function public.owner_week() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare _today date := (now() at time zone 'Asia/Jakarta')::date;
  _mon date; _from timestamptz; _to timestamptz; _b jsonb; _real record; _hours jsonb; _grid jsonb; _held int;
begin
  if not public.is_owner(auth.uid()) then raise exception 'Owner only'; end if;
  _mon := _today - (extract(isodow from _today)::int - 1);
  _from := _mon::timestamp at time zone 'Asia/Jakarta';
  _to := (_mon + 7)::timestamp at time zone 'Asia/Jakarta';
  select data into _b from public.week_baseline where id = 1;

  select count(*) filter (where status in ('deposit_paid','paid','played','no_show')) n,
         coalesce(sum(total_idr) filter (where status in ('deposit_paid','paid','played')), 0) rev,
         count(*) filter (where status = 'no_show') ns
    into _real from public.bookings where not is_demo and starts_at >= _from and starts_at < _to;

  select count(*) into _held from public.system_log l
   where l.kind = 'hold_released' and l.created_at >= _from and l.created_at < _to
     and (l.booking_id is null or l.booking_id not in (select id from public.bookings where is_demo));

  select jsonb_object_agg(c.sort::text, coalesce((_b->'court_hours'->>c.sort::text)::numeric, 0) + coalesce(x.h, 0)) into _hours
    from public.courts c left join (
      select court_id, sum(extract(epoch from ends_at - starts_at) / 3600) h from public.bookings
       where not is_demo and status in ('deposit_paid','paid','played') and starts_at >= _from and starts_at < _to group by court_id
    ) x on x.court_id = c.id;

  select jsonb_agg(row_to_json(g)) into _grid from (
    select d, h,
      (case when d >= 6 then case when h between 8 and 20 then 2 + (h % 2) else (case when h >= 21 then 1 else 0 end) end
            else case when h between 17 and 18 then 2 when h between 19 and 21 then 3 when h = 22 then 1 when h between 6 and 7 then 1 else (case when h between 12 and 13 then 1 else 0 end) end end)
      + coalesce((select count(*) from public.bookings b where not b.is_demo and b.status in ('deposit_paid','paid','played')
          and b.starts_at >= _from and b.starts_at < _to
          and extract(isodow from b.starts_at at time zone 'Asia/Jakarta') = d and extract(hour from b.starts_at at time zone 'Asia/Jakarta') = h), 0) as n
    from generate_series(1,7) d, generate_series(6,22) h order by d, h) g;

  return jsonb_build_object(
    'from', _mon, 'to', _mon + 6,
    'online', (_b->>'online')::int + _real.n, 'total', (_b->>'total')::int + _real.n,
    'revenue', (_b->>'revenue')::bigint + _real.rev,
    'no_shows', (_b->>'no_shows')::int + _real.ns,
    'holds_released', (_b->>'holds_released')::int + _held,
    'capacity', (_b->>'capacity')::int, 'court_hours', _hours, 'grid', _grid);
end $$;
revoke all on function public.owner_week() from public, anon;
grant execute on function public.owner_week() to authenticated;

CREATE OR REPLACE FUNCTION public.reset_demo()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _d date := (now() at time zone 'Asia/Jakarta')::date;
  _hold timestamptz := (_d + time '18:52') at time zone 'Asia/Jakarta';
begin
  if auth.uid() is not null and not public.is_owner(auth.uid()) then raise exception 'Only the owner can reset the demo'; end if;
  if _hold <= now() then _hold := now() + interval '12 minutes'; end if;

  delete from public.notifications where booking_id in (select id from public.bookings where is_demo);
  delete from public.system_log where booking_id in (select id from public.bookings where is_demo);
  delete from public.booking_addons where booking_id in (select id from public.bookings where is_demo);
  delete from public.payments where is_demo or booking_id in (select id from public.bookings where is_demo);
  delete from public.waitlist_entries where is_demo;
  delete from public.court_blocks where is_demo;
  delete from public.bookings where is_demo;

  insert into public.bookings (code, court_id, starts_at, ends_at, guest_name, guest_whatsapp, status, subtotal_idr, addons_idr, total_idr, paid_idr, balance_due_at, hold_expires_at, is_demo)
  select v.code, c.id, (_d + v.s) at time zone 'Asia/Jakarta', (_d + v.e) at time zone 'Asia/Jakarta', v.n, v.wa, v.st, v.sub, v.ad, v.sub+v.ad, v.paid,
    case when v.paid < v.sub+v.ad and v.st <> 'hold' then ((_d + v.s) at time zone 'Asia/Jakarta') - interval '2 hours' end,
    case when v.st = 'hold' then _hold end, true
  from (values
   ('PDL-2041',1,time '20:00',time '21:30','Kevin','0812 1100 2041','deposit_paid',825000,140000,482500),
   ('PDL-2044',1,time '22:00',time '23:00','Raka','0812 1100 2044','deposit_paid',550000,0,275000),
   ('PDL-2045',2,time '18:00',time '19:30','Arif','0812 1100 2045','paid',825000,0,825000),
   ('PDL-2048',2,time '20:00',time '21:30','Maya','0812 1100 2048','deposit_paid',825000,130000,477500),
   ('PDL-2049',3,time '18:00',time '19:30','Dinda','0812 1100 2049','paid',900000,0,900000),
   ('PDL-2053',3,time '20:00',time '21:00','[GUEST NAME]','0812 1100 2053','hold',600000,0,0),
   ('PDL-2051',3,time '22:00',time '23:00','Bima and Sari','0812 1100 2051','deposit_paid',600000,0,265000)
  ) v(code, sort, s, e, n, wa, st, sub, ad, paid) join public.courts c on c.sort = v.sort;

  insert into public.booking_addons (booking_id, addon_id, qty, unit_price_idr)
  select b.id, a.id, 2, 35000 from public.bookings b, public.addons a where b.code = 'PDL-2048' and a.name = 'Racket, Balanced'
  union all select b.id, a.id, 1, 60000 from public.bookings b, public.addons a where b.code = 'PDL-2048' and a.name = 'Can of 3 balls';

  insert into public.payments (booking_id, amount_idr, method, flag, payer, note, is_demo) values
   ((select id from public.bookings where code='PDL-2044'), 400000, 'va', 'overpaid', 'Raka', 'Deposit due Rp 275.000', true),
   (null, 335000, 'va', 'no_code', 'Sari', 'No booking code in transfer', true),
   ((select id from public.bookings where code='PDL-2053'), 300000, 'qris', 'late', null, 'Court 3, ' || to_char(_d, 'Dy') || ' 20.00, arrived after the hold ended', true);

  insert into public.waitlist_entries (court_id, starts_at, guest, position, status, offer_expires_at, is_demo)
  select c.id, (_d + v.dd + v.t) at time zone 'Asia/Jakarta', v.g, v.p, v.st,
    case when v.st='offered' then now() + interval '15 minutes' end, true
  from (values (1,1,time '21:00','Maya',1,'offered'),(3,0,time '20:00','Arif H.',1,'waiting'),
   (1,6,time '19:00','Bima',1,'waiting'),(1,6,time '19:00','Maya',2,'waiting'),(1,6,time '19:00','Dinda',3,'waiting')) v(sort,dd,t,g,p,st)
  join public.courts c on c.sort = v.sort;

  insert into public.system_log (kind, message) values ('demo', 'Demo data reset for ' || to_char(_d, 'Dy DD Mon'));
end $function$;