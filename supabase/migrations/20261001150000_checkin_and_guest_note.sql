-- Check-in at the desk or courtside, and a free-text request from the guest.
-- Written to be safe to run more than once.

alter table public.bookings add column if not exists guest_note text;
alter table public.bookings add column if not exists checked_in_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_guest_note_len') then
    alter table public.bookings add constraint bookings_guest_note_len check (guest_note is null or length(guest_note) <= 300);
  end if;
end $$;

-- create_hold gains an optional note. The old seven argument version goes, so calls are never ambiguous.
drop function if exists public.create_hold(uuid, timestamptz, int, text, text, text, jsonb);
create or replace function public.create_hold(_court uuid, _starts timestamptz, _minutes int, _name text, _wa text, _email text, _addons jsonb, _note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _ends timestamptz := _starts + make_interval(mins => _minutes); _local timestamp := _starts at time zone 'Asia/Jakarta';
  _sub int; _add int := 0; _b public.bookings; a jsonb; _price int;
begin
  if _minutes not in (60,90,120) then raise exception 'Choose 60, 90 or 120 minutes'; end if;
  if length(trim(coalesce(_name,''))) < 2 or length(trim(_name)) > 80 then raise exception 'Add your name'; end if;
  if length(public.norm_wa(_wa)) < 8 or length(public.norm_wa(_wa)) > 15 then raise exception 'Add a valid WhatsApp number'; end if;
  if length(coalesce(_note,'')) > 300 then raise exception 'Keep your request under 300 characters'; end if;
  if _starts < now() then raise exception 'That time has passed'; end if;
  if _starts > now() + interval '62 days' then raise exception 'You can book up to two months ahead'; end if;
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
  insert into public.bookings (court_id, starts_at, ends_at, guest_name, guest_whatsapp, guest_email, guest_note, status, subtotal_idr, addons_idr, total_idr, hold_expires_at)
  values (_court, _starts, _ends, trim(_name), trim(_wa), nullif(trim(coalesce(_email,'')),''), nullif(trim(coalesce(_note,'')),''), 'hold', _sub, _add, _sub + _add, now() + interval '15 minutes') returning * into _b;
  for a in select * from jsonb_array_elements(coalesce(_addons,'[]'::jsonb)) loop
    insert into public.booking_addons (booking_id, addon_id, qty, unit_price_idr)
    select _b.id, id, (a->>'qty')::int, price_idr from public.addons where id = (a->>'addon_id')::uuid;
  end loop;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'hold_created', 'Your court is held for 15 minutes. Code ' || _b.code);
  insert into public.system_log (kind, message, booking_id) values ('hold', 'Guest hold created', _b.id);
  return _b.code;
end $$;
revoke all on function public.create_hold(uuid, timestamptz, int, text, text, text, jsonb, text) from public;
grant execute on function public.create_hold(uuid, timestamptz, int, text, text, text, jsonb, text) to anon, authenticated;

create or replace function public.get_booking(_code text, _wa text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', b.code, 'court', c.name, 'court_kind', c.kind, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'guest_name', b.guest_name, 'status', case when b.status = 'hold' and b.hold_expires_at <= now() then 'expired' else b.status end,
    'subtotal_idr', b.subtotal_idr, 'addons_idr', b.addons_idr, 'total_idr', b.total_idr, 'paid_idr', b.paid_idr,
    'balance_due_at', b.balance_due_at, 'hold_expires_at', b.hold_expires_at,
    'note', b.guest_note, 'checked_in_at', b.checked_in_at,
    'addons', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'qty', ba.qty, 'unit_price_idr', ba.unit_price_idr)) from public.booking_addons ba join public.addons a on a.id = ba.addon_id where ba.booking_id = b.id), '[]'::jsonb))
  from public.bookings b join public.courts c on c.id = b.court_id
  where upper(b.code) = upper(trim(_code)) and public.norm_wa(b.guest_whatsapp) = public.norm_wa(_wa) and length(public.norm_wa(_wa)) >= 8 $$;

-- Check in. Guests prove the booking with the last 4 digits of their WhatsApp number (the QR on the ticket carries them).
-- Signed in staff can check in with the code alone.
create or replace function public.check_in(_code text, _wa4 text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare _b public.bookings; _c public.courts; _today date := (now() at time zone 'Asia/Jakarta')::date; _was timestamptz;
begin
  select * into _b from public.bookings where upper(code) = upper(trim(_code));
  if _b.id is null then raise exception 'We could not find that code'; end if;
  if not public.is_staff(auth.uid()) and (coalesce(length(_wa4),0) <> 4 or right(public.norm_wa(_b.guest_whatsapp), 4) <> _wa4) then
    raise exception 'That code and number do not match';
  end if;
  if _b.status not in ('deposit_paid','paid','played') then raise exception 'This booking is not confirmed yet'; end if;
  if (_b.starts_at at time zone 'Asia/Jakarta')::date <> _today then
    raise exception 'This booking is for %', to_char(_b.starts_at at time zone 'Asia/Jakarta', 'Dy DD Mon');
  end if;
  _was := _b.checked_in_at;
  if _was is null then
    update public.bookings set checked_in_at = now() where id = _b.id;
    insert into public.system_log (kind, message, booking_id) values ('checkin', _b.guest_name || ' checked in for ' || _b.code, _b.id);
  end if;
  select * into _c from public.courts where id = _b.court_id;
  return jsonb_build_object('code', _b.code, 'guest_name', _b.guest_name, 'court', _c.name, 'starts_at', _b.starts_at, 'ends_at', _b.ends_at,
    'balance_idr', greatest(_b.total_idr - _b.paid_idr, 0), 'already', _was is not null, 'checked_in_at', coalesce(_was, now()));
end $$;
revoke all on function public.check_in(text, text) from public;
grant execute on function public.check_in(text, text) to anon, authenticated;
