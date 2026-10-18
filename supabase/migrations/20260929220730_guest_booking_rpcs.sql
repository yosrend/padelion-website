CREATE OR REPLACE FUNCTION public.get_booking(_code text, _wa text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'code', b.code, 'court', c.name, 'court_id', b.court_id, 'court_kind', c.kind, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
    'minutes', (extract(epoch from b.ends_at - b.starts_at)/60)::int,
    'guest_name', b.guest_name, 'status', case when b.status = 'hold' and b.hold_expires_at <= now() then 'expired' else b.status end,
    'subtotal_idr', b.subtotal_idr, 'addons_idr', b.addons_idr, 'total_idr', b.total_idr, 'paid_idr', b.paid_idr,
    'balance_due_at', b.balance_due_at, 'hold_expires_at', b.hold_expires_at,
    'addons', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'qty', ba.qty, 'unit_price_idr', ba.unit_price_idr)) from public.booking_addons ba join public.addons a on a.id = ba.addon_id where ba.booking_id = b.id), '[]'::jsonb))
  from public.bookings b join public.courts c on c.id = b.court_id
  where upper(b.code) = upper(trim(_code)) and public.norm_wa(b.guest_whatsapp) = public.norm_wa(_wa) and length(public.norm_wa(_wa)) >= 8 $function$;

CREATE OR REPLACE FUNCTION public.pay_balance(_code text, _wa text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _b public.bookings; _amt int;
begin
  select * into _b from public.bookings where upper(code)=upper(trim(_code)) and public.norm_wa(guest_whatsapp)=public.norm_wa(_wa) and length(public.norm_wa(_wa))>=8 for update;
  if _b.id is null then raise exception 'Booking not found'; end if;
  if _b.status <> 'deposit_paid' then raise exception 'Nothing left to pay'; end if;
  _amt := _b.total_idr - _b.paid_idr;
  if _amt <= 0 then raise exception 'Nothing left to pay'; end if;
  insert into public.payments (booking_id, amount_idr, method, payer, note) values (_b.id, _amt, 'qris', _b.guest_name, 'Sandbox QRIS, balance');
  update public.bookings set paid_idr = total_idr, status='paid', balance_due_at=null where id=_b.id;
  delete from public.notifications where booking_id=_b.id and kind='balance_reminder' and sent_at is null;
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'payment_received', 'Balance received for ' || _b.code || '. Paid in full.');
  insert into public.system_log (kind, message, booking_id) values ('payment', 'Balance paid by QRIS, ' || _b.code, _b.id);
  return public.get_booking(_code, _wa);
end $function$;

CREATE OR REPLACE FUNCTION public.join_waitlist(_court uuid, _starts timestamptz, _name text, _wa text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _pos int; _cname text;
begin
  if length(trim(coalesce(_name,''))) < 2 or length(trim(_name)) > 80 then raise exception 'Add your name'; end if;
  if length(public.norm_wa(_wa)) < 8 or length(public.norm_wa(_wa)) > 14 then raise exception 'Add a valid WhatsApp number'; end if;
  if _starts < now() then raise exception 'That time has passed'; end if;
  select name into _cname from public.courts where id=_court and is_active;
  if _cname is null then raise exception 'Court not found'; end if;
  select position into _pos from public.waitlist_entries where court_id=_court and starts_at=_starts and status in ('waiting','offered') and public.norm_wa(whatsapp)=public.norm_wa(_wa);
  if _pos is not null then return _pos; end if;
  select coalesce(max(position),0)+1 into _pos from public.waitlist_entries where court_id=_court and starts_at=_starts;
  insert into public.waitlist_entries (court_id, starts_at, guest, whatsapp, position) values (_court, _starts, trim(_name), trim(_wa), _pos);
  insert into public.system_log (kind, message) values ('waitlist', trim(_name) || ' joined the waitlist, ' || _cname || ', ' || to_char(_starts at time zone 'Asia/Jakarta','HH24.MI'));
  select count(*) into _pos from public.waitlist_entries where court_id=_court and starts_at=_starts and status in ('waiting','offered');
  return _pos;
end $function$;

CREATE OR REPLACE FUNCTION public.get_offer(_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', w.id, 'court', c.name, 'court_id', w.court_id, 'starts_at', w.starts_at,
    'status', case when w.status='offered' and w.offer_expires_at <= now() then 'expired' else w.status end,
    'offer_expires_at', w.offer_expires_at, 'guest', w.guest,
    'total_idr', public.price_for(w.court_id, w.starts_at, 60),
    'deposit_idr', public.price_for(w.court_id, w.starts_at, 60) * (public.vs()).deposit_pct / 100)
  from public.waitlist_entries w join public.courts c on c.id=w.court_id where w.id=_id $function$;

CREATE OR REPLACE FUNCTION public.take_offer(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare w public.waitlist_entries; _code text;
begin
  select * into w from public.waitlist_entries where id=_id for update;
  if w.id is null or w.status <> 'offered' or w.offer_expires_at <= now() then raise exception 'This offer ended and went to the next player'; end if;
  if w.whatsapp is null then raise exception 'No WhatsApp number on this offer. Message the desk.'; end if;
  _code := public.create_hold(w.court_id, w.starts_at, 60, w.guest, w.whatsapp, null, '[]'::jsonb);
  update public.waitlist_entries set status='taken' where id=_id;
  insert into public.system_log (kind, message) values ('waitlist', w.guest || ' took the waitlist offer, ' || _code);
  return jsonb_build_object('code', _code, 'wa', w.whatsapp);
end $function$;

CREATE OR REPLACE FUNCTION public.pass_offer(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare w public.waitlist_entries; _cname text;
begin
  select * into w from public.waitlist_entries where id=_id for update;
  if w.id is null or w.status <> 'offered' then raise exception 'This offer has already ended'; end if;
  select name into _cname from public.courts where id=w.court_id;
  update public.waitlist_entries set status='passed' where id=_id;
  insert into public.system_log (kind, message) values ('waitlist', w.guest || ' passed on ' || _cname || ', ' || to_char(w.starts_at at time zone 'Asia/Jakarta','HH24.MI'));
  perform public.offer_next(w.court_id, w.starts_at);
end $function$;

CREATE OR REPLACE FUNCTION public.find_bookings(_wa text, _otp text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _n text := public.norm_wa(_wa);
begin
  if length(_n) < 8 then raise exception 'Add a valid WhatsApp number'; end if;
  -- Demo sandbox: the one-time code is the last 4 digits of the number.
  if coalesce(trim(_otp),'') <> right(_n, 4) then raise exception 'That code does not match'; end if;
  return jsonb_build_object(
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'court', c.name, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'status', case when b.status='hold' and b.hold_expires_at <= now() then 'expired' else b.status end,
        'total_idr', b.total_idr, 'paid_idr', b.paid_idr, 'balance_due_at', b.balance_due_at) order by b.starts_at desc)
      from public.bookings b join public.courts c on c.id=b.court_id where public.norm_wa(b.guest_whatsapp)=_n), '[]'::jsonb),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'court', c.name, 'starts_at', w.starts_at, 'offer_expires_at', w.offer_expires_at))
      from public.waitlist_entries w join public.courts c on c.id=w.court_id
      where public.norm_wa(w.whatsapp)=_n and w.status='offered' and w.offer_expires_at > now()), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.reschedule_booking(_code text, _wa text, _court uuid, _starts timestamptz, _minutes integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _b public.bookings; _ends timestamptz := _starts + make_interval(mins => _minutes); _local timestamp := _starts at time zone 'Asia/Jakarta';
  _s public.venue_settings := public.vs(); _sub int; _total int; _cname text; _old text;
begin
  select * into _b from public.bookings where upper(code)=upper(trim(_code)) and public.norm_wa(guest_whatsapp)=public.norm_wa(_wa) and length(public.norm_wa(_wa))>=8 for update;
  if _b.id is null then raise exception 'Booking not found'; end if;
  if _b.status not in ('deposit_paid','paid') then raise exception 'Only paid bookings can be moved'; end if;
  if now() > _b.starts_at - make_interval(hours => _s.reschedule_hours) then raise exception 'Moves close % hours before play. Message the desk if you need help.', _s.reschedule_hours; end if;
  if _minutes not in (60,90,120) then raise exception 'Choose 60, 90 or 120 minutes'; end if;
  if _starts < now() then raise exception 'That time has passed'; end if;
  if _local::time < '06:00' or (_ends at time zone 'Asia/Jakarta')::time > '23:00' or (_ends at time zone 'Asia/Jakarta')::date <> _local::date then raise exception 'We are open 06.00 to 23.00'; end if;
  select name into _cname from public.courts where id=_court and is_active;
  if _cname is null then raise exception 'Court not found'; end if;
  if not public.slot_free(_court, _starts, _ends, _b.id) then raise exception 'Someone just took that slot. Pick another time.'; end if;
  select c.name || ', ' || to_char(_b.starts_at at time zone 'Asia/Jakarta','HH24.MI') into _old from public.courts c where c.id=_b.court_id;
  _sub := public.price_for(_court, _starts, _minutes);
  _total := _sub + _b.addons_idr;
  update public.bookings set court_id=_court, starts_at=_starts, ends_at=_ends, subtotal_idr=_sub, total_idr=_total,
    status = case when paid_idr >= _total then 'paid' else 'deposit_paid' end,
    balance_due_at = case when paid_idr >= _total then null else _starts - make_interval(hours => _s.balance_hours) end
  where id=_b.id;
  update public.notifications set send_at = send_at + (_starts - _b.starts_at) where booking_id=_b.id and sent_at is null and kind in ('reminder_day','reminder_2h','balance_reminder');
  insert into public.notifications (booking_id, kind, body) values (_b.id, 'moved', 'Your game ' || _b.code || ' moved to ' || _cname || ', ' || to_char(_local,'HH24.MI') || '.');
  insert into public.system_log (kind, message, booking_id) values ('booking', 'Player moved ' || _b.code || ' from ' || _old || ' to ' || _cname || ', ' || to_char(_local,'HH24.MI'), _b.id);
  return public.get_booking(_code, _wa) || jsonb_build_object('diff_idr', _total - _b.total_idr);
end $function$;

GRANT EXECUTE ON FUNCTION public.pay_balance(text,text), public.join_waitlist(uuid,timestamptz,text,text), public.get_offer(uuid), public.take_offer(uuid), public.pass_offer(uuid), public.find_bookings(text,text), public.reschedule_booking(text,text,uuid,timestamptz,integer) TO anon, authenticated;