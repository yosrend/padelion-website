create extension if not exists pgcrypto;

create table public.courts (id uuid primary key default gen_random_uuid(), name text not null, kind text not null, sort int not null default 0, is_active boolean not null default true);
create table public.price_rules (id uuid primary key default gen_random_uuid(), court_id uuid not null references public.courts(id) on delete cascade, off_peak_idr int not null, peak_idr int not null, weekday_peak_start int not null default 17, weekday_peak_end int not null default 23, weekend_all_peak boolean not null default true);
create table public.addons (id uuid primary key default gen_random_uuid(), name text not null, price_idr int not null, sort int not null default 0);
create sequence public.booking_code_seq start 2054;
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('PDL-' || nextval('public.booking_code_seq')),
  court_id uuid not null references public.courts(id),
  starts_at timestamptz not null, ends_at timestamptz not null,
  guest_name text not null, guest_whatsapp text not null, guest_email text,
  status text not null default 'hold' check (status in ('hold','deposit_paid','paid','expired','cancelled','no_show','played')),
  subtotal_idr int not null default 0, addons_idr int not null default 0, total_idr int not null default 0, paid_idr int not null default 0,
  balance_due_at timestamptz, hold_expires_at timestamptz, created_at timestamptz not null default now());
create table public.booking_addons (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, addon_id uuid not null references public.addons(id), qty int not null default 1, unit_price_idr int not null);
create table public.payments (id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id), amount_idr int not null, method text not null check (method in ('qris','va','cash')), status text not null default 'received', flag text check (flag in ('overpaid','no_code','late')), payer text, note text, created_at timestamptz not null default now());
create table public.waitlist_entries (id uuid primary key default gen_random_uuid(), court_id uuid not null references public.courts(id), starts_at timestamptz not null, guest text not null, whatsapp text, position int not null, status text not null default 'waiting' check (status in ('waiting','offered','taken','passed','expired')), offer_expires_at timestamptz, created_at timestamptz not null default now());
create table public.court_blocks (id uuid primary key default gen_random_uuid(), court_id uuid not null references public.courts(id), starts_at timestamptz not null, ends_at timestamptz not null, reason text);
create table public.rain_events (id uuid primary key default gen_random_uuid(), court_id uuid references public.courts(id), starts_at timestamptz not null, ends_at timestamptz, note text, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id) on delete cascade, channel text not null default 'whatsapp', kind text not null, body text not null, send_at timestamptz not null default now(), sent_at timestamptz);
create type public.staff_role as enum ('front_desk','owner');
create table public.staff (id uuid primary key default gen_random_uuid(), user_id uuid not null unique, name text not null, role public.staff_role not null);
create table public.system_log (id uuid primary key default gen_random_uuid(), kind text not null, message text not null, booking_id uuid references public.bookings(id) on delete set null, created_at timestamptz not null default now());

create or replace function public.is_staff(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.staff where user_id = _uid) $$;
create or replace function public.is_owner(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.staff where user_id = _uid and role = 'owner') $$;

do $$ declare t text; begin
  foreach t in array array['courts','price_rules','addons','bookings','booking_addons','payments','waitlist_entries','court_blocks','rain_events','notifications','staff','system_log'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['courts','addons','bookings','booking_addons','payments','waitlist_entries','court_blocks','rain_events','notifications','system_log'] loop
    execute format('create policy "Staff manage %1$s" on public.%1$I for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()))', t);
  end loop;
end $$;
grant select on public.courts, public.price_rules, public.addons to anon;
create policy "Anyone reads courts" on public.courts for select to anon, authenticated using (true);
create policy "Anyone reads prices" on public.price_rules for select to anon, authenticated using (true);
create policy "Anyone reads addons" on public.addons for select to anon, authenticated using (true);
create policy "Owners manage prices" on public.price_rules for all to authenticated using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));
create policy "Staff read staff" on public.staff for select to authenticated using (public.is_staff(auth.uid()));
create policy "Owners manage staff" on public.staff for all to authenticated using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));
grant usage on sequence public.booking_code_seq to authenticated, service_role;

-- pricing
create or replace function public.price_for(_court uuid, _starts timestamptz, _minutes int) returns int language sql stable security definer set search_path = public as $$
  select (case when extract(isodow from (_starts at time zone 'Asia/Jakarta')) >= 6 and pr.weekend_all_peak then pr.peak_idr
               when extract(hour from (_starts at time zone 'Asia/Jakarta')) >= pr.weekday_peak_start and extract(hour from (_starts at time zone 'Asia/Jakarta')) < pr.weekday_peak_end then pr.peak_idr
               else pr.off_peak_idr end) * _minutes / 60
  from public.price_rules pr where pr.court_id = _court limit 1 $$;

create or replace function public.booking_is_active(b public.bookings) returns boolean language sql stable as $$
  select b.status in ('deposit_paid','paid','played') or (b.status = 'hold' and b.hold_expires_at > now()) $$;

-- availability: never exposes names
create or replace function public.get_availability(_date date) returns table(court_id uuid, starts_at timestamptz, ends_at timestamptz) language sql stable security definer set search_path = public as $$
  select b.court_id, b.starts_at, b.ends_at from public.bookings b
   where public.booking_is_active(b) and (b.starts_at at time zone 'Asia/Jakarta')::date = _date
  union all
  select c.court_id, c.starts_at, c.ends_at from public.court_blocks c
   where (c.starts_at at time zone 'Asia/Jakarta')::date = _date $$;

create or replace function public.norm_wa(_wa text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(_wa,''), '\D', '', 'g'), '^(62|0)', '') $$;

create or replace function public.create_hold(_court uuid, _starts timestamptz, _minutes int, _name text, _wa text, _email text, _addons jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare _ends timestamptz := _starts + make_interval(mins => _minutes); _local timestamp := _starts at time zone 'Asia/Jakarta';
  _sub int; _add int := 0; _b public.bookings; a jsonb; _price int;
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
    select price_idr into _price from public.addons where id = (a->>'addon_id')::uuid;
    if _price is null or (a->>'qty')::int < 1 or (a->>'qty')::int > 8 then raise exception 'Invalid add-on'; end if;
    _add := _add + _price * (a->>'qty')::int;
  end loop;
  insert into public.bookings (court_id, starts_at, ends_at, guest_name, guest_whatsapp, guest_email, status, subtotal_idr, addons_idr, total_idr, hold_expires_at)
  values (_court, _starts, _ends, trim(_name), trim(_wa), nullif(trim(coalesce(_email,'')),''), 'hold', _sub, _add, _sub + _add, now() + interval '15 minutes') returning * into _b;
  for a in select * from jsonb_array_elements(coalesce(_addons,'[]'::jsonb)) loop
    insert into public.booking_addons (booking_id, addon_id, qty, unit_price_idr)
    select _b.id, id, (a->>'qty')::int, price_idr from public.addons where id = (a->>'addon_id')::uuid;
  end loop;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'hold_created', 'Your court is held for 15 minutes. Code ' || _b.code);
  insert into public.system_log (kind, message, booking_id) values ('hold', 'Guest hold created', _b.id);
  return _b.code;
end $$;

create or replace function public.get_booking(_code text, _wa text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', b.code, 'court', c.name, 'court_kind', c.kind, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'guest_name', b.guest_name, 'status', case when b.status = 'hold' and b.hold_expires_at <= now() then 'expired' else b.status end,
    'subtotal_idr', b.subtotal_idr, 'addons_idr', b.addons_idr, 'total_idr', b.total_idr, 'paid_idr', b.paid_idr,
    'balance_due_at', b.balance_due_at, 'hold_expires_at', b.hold_expires_at,
    'addons', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'qty', ba.qty, 'unit_price_idr', ba.unit_price_idr)) from public.booking_addons ba join public.addons a on a.id = ba.addon_id where ba.booking_id = b.id), '[]'::jsonb))
  from public.bookings b join public.courts c on c.id = b.court_id
  where upper(b.code) = upper(trim(_code)) and public.norm_wa(b.guest_whatsapp) = public.norm_wa(_wa) and length(public.norm_wa(_wa)) >= 8 $$;

create or replace function public.pay_booking(_code text, _wa text, _mode text) returns jsonb language plpgsql security definer set search_path = public as $$
declare _b public.bookings; _amt int;
begin
  select * into _b from public.bookings where upper(code) = upper(trim(_code)) and public.norm_wa(guest_whatsapp) = public.norm_wa(_wa) for update;
  if _b.id is null then raise exception 'Booking not found'; end if;
  if _b.status <> 'hold' or _b.hold_expires_at <= now() then raise exception 'This hold has ended. Book again.'; end if;
  _amt := case when _mode = 'full' then _b.total_idr else _b.total_idr / 2 end;
  insert into public.payments (booking_id, amount_idr, method, payer, note) values (_b.id, _amt, 'qris', _b.guest_name, 'Sandbox QRIS');
  update public.bookings set paid_idr = _amt, status = case when _amt >= total_idr then 'paid' else 'deposit_paid' end,
    balance_due_at = case when _amt >= total_idr then null else starts_at - interval '2 hours' end, hold_expires_at = null where id = _b.id;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'payment_received', 'Payment received for ' || _b.code || '. See you on court.');
  if _amt < _b.total_idr then
    insert into public.notifications (booking_id, kind, body, send_at) values (_b.id, 'balance_reminder', 'Your balance for ' || _b.code || ' is due in 2 hours.', _b.starts_at - interval '4 hours');
  end if;
  insert into public.system_log (kind, message, booking_id) values ('payment', 'Sandbox QRIS payment', _b.id);
  return public.get_booking(_code, _wa);
end $$;

revoke all on function public.create_hold, public.get_booking, public.pay_booking, public.get_availability, public.price_for from public;
grant execute on function public.create_hold, public.get_booking, public.pay_booking, public.get_availability, public.price_for to anon, authenticated;

-- seed
insert into public.courts (name, kind, sort) values ('Court 1','Indoor',1),('Court 2','Indoor',2),('Court 3','Panoramic, outdoor',3);
insert into public.price_rules (court_id, off_peak_idr, peak_idr) select id, case when sort=3 then 400000 else 350000 end, case when sort=3 then 600000 else 550000 end from public.courts;
insert into public.addons (name, price_idr, sort) values ('Racket, Control',35000,1),('Racket, Balanced',35000,2),('Racket, Power',35000,3),('Can of 3 balls',60000,4),('Towel',15000,5);

insert into public.bookings (code, court_id, starts_at, ends_at, guest_name, guest_whatsapp, status, subtotal_idr, addons_idr, total_idr, paid_idr, balance_due_at, hold_expires_at)
select v.code, c.id, v.s::timestamptz, v.e::timestamptz, v.n, v.wa, v.st, v.sub, v.ad, v.sub+v.ad, v.paid,
  case when v.paid < v.sub+v.ad and v.st <> 'hold' then v.s::timestamptz - interval '2 hours' end,
  case when v.st = 'hold' then '2026-10-03 18:52+07'::timestamptz end
from (values
 ('PDL-2041',1,'2026-10-03 20:00+07','2026-10-03 21:30+07','Kevin','0812 1100 2041','deposit_paid',825000,140000,482500),
 ('PDL-2044',1,'2026-10-03 22:00+07','2026-10-03 23:00+07','Raka','0812 1100 2044','deposit_paid',550000,0,275000),
 ('PDL-2045',2,'2026-10-03 18:00+07','2026-10-03 19:30+07','Arif','0812 1100 2045','paid',825000,0,825000),
 ('PDL-2048',2,'2026-10-03 20:00+07','2026-10-03 21:30+07','Maya','0812 1100 2048','deposit_paid',825000,130000,477500),
 ('PDL-2049',3,'2026-10-03 18:00+07','2026-10-03 19:30+07','Dinda','0812 1100 2049','paid',900000,0,900000),
 ('PDL-2053',3,'2026-10-03 20:00+07','2026-10-03 21:00+07','[GUEST NAME]','0812 1100 2053','hold',600000,0,0),
 ('PDL-2051',3,'2026-10-03 22:00+07','2026-10-03 23:00+07','Bima and Sari','0812 1100 2051','deposit_paid',600000,0,265000)
) v(code, sort, s, e, n, wa, st, sub, ad, paid) join public.courts c on c.sort = v.sort;

insert into public.booking_addons (booking_id, addon_id, qty, unit_price_idr)
select b.id, a.id, 2, 35000 from public.bookings b, public.addons a where b.code = 'PDL-2048' and a.name = 'Racket, Balanced'
union all select b.id, a.id, 1, 60000 from public.bookings b, public.addons a where b.code = 'PDL-2048' and a.name = 'Can of 3 balls';

insert into public.payments (booking_id, amount_idr, method, flag, payer, note) values
 ((select id from public.bookings where code='PDL-2044'), 400000, 'va', 'overpaid', 'Raka', 'Deposit due Rp 275.000'),
 (null, 335000, 'va', 'no_code', 'Sari', 'No booking code in transfer'),
 (null, 300000, 'qris', 'late', null, 'Court 3, Sat 20.00, arrived after the hold ended');

insert into public.waitlist_entries (court_id, starts_at, guest, position, status, offer_expires_at)
select c.id, v.s::timestamptz, v.g, v.p, v.st, case when v.st='offered' then '2026-10-04 20:15+07'::timestamptz end
from (values (1,'2026-10-04 21:00+07','Maya',1,'offered'),(3,'2026-10-03 20:00+07','Arif H.',1,'waiting'),
 (1,'2026-10-09 19:00+07','Bima',1,'waiting'),(1,'2026-10-09 19:00+07','Maya',2,'waiting'),(1,'2026-10-09 19:00+07','Dinda',3,'waiting')) v(sort,s,g,p,st)
join public.courts c on c.sort = v.sort;