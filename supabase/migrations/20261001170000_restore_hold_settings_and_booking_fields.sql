-- Fix for 20261001150000: that file rebuilt create_hold and get_booking from an older version.
-- This restores the venue hold length, the active add-on filter, court_id and minutes, and keeps the note and check-in fields.

create or replace function public.create_hold(_court uuid, _starts timestamptz, _minutes int, _name text, _wa text, _email text, _addons jsonb, _note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare _ends timestamptz := _starts + make_interval(mins => _minutes); _local timestamp := _starts at time zone 'Asia/Jakarta';
  _sub int; _add int := 0; _b public.bookings; a jsonb; _price int; _hold int := (public.vs()).hold_minutes;
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
    select price_idr into _price from public.addons where id = (a->>'addon_id')::uuid and is_active;
    if _price is null or (a->>'qty')::int < 1 or (a->>'qty')::int > 8 then raise exception 'Invalid add-on'; end if;
    _add := _add + _price * (a->>'qty')::int;
  end loop;
  insert into public.bookings (court_id, starts_at, ends_at, guest_name, guest_whatsapp, guest_email, guest_note, status, subtotal_idr, addons_idr, total_idr, hold_expires_at)
  values (_court, _starts, _ends, trim(_name), trim(_wa), nullif(trim(coalesce(_email,'')),''), nullif(trim(coalesce(_note,'')),''), 'hold', _sub, _add, _sub + _add, now() + make_interval(mins => _hold)) returning * into _b;
  for a in select * from jsonb_array_elements(coalesce(_addons,'[]'::jsonb)) loop
    insert into public.booking_addons (booking_id, addon_id, qty, unit_price_idr)
    select _b.id, id, (a->>'qty')::int, price_idr from public.addons where id = (a->>'addon_id')::uuid;
  end loop;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'hold_created', 'Your court is held for ' || _hold || ' minutes. Code ' || _b.code);
  insert into public.system_log (kind, message, booking_id) values ('hold', 'Guest hold created', _b.id);
  return _b.code;
end $$;

create or replace function public.get_booking(_code text, _wa text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', b.code, 'court', c.name, 'court_id', b.court_id, 'court_kind', c.kind, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'minutes', (extract(epoch from b.ends_at - b.starts_at)/60)::int,
    'guest_name', b.guest_name, 'status', case when b.status = 'hold' and b.hold_expires_at <= now() then 'expired' else b.status end,
    'subtotal_idr', b.subtotal_idr, 'addons_idr', b.addons_idr, 'total_idr', b.total_idr, 'paid_idr', b.paid_idr,
    'balance_due_at', b.balance_due_at, 'hold_expires_at', b.hold_expires_at,
    'note', b.guest_note, 'checked_in_at', b.checked_in_at,
    'addons', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'qty', ba.qty, 'unit_price_idr', ba.unit_price_idr)) from public.booking_addons ba join public.addons a on a.id = ba.addon_id where ba.booking_id = b.id), '[]'::jsonb))
  from public.bookings b join public.courts c on c.id = b.court_id
  where upper(b.code) = upper(trim(_code)) and public.norm_wa(b.guest_whatsapp) = public.norm_wa(_wa) and length(public.norm_wa(_wa)) >= 8 $$;
