drop function if exists public.get_availability(date);
create function public.get_availability(_date date)
returns table(court_id uuid, starts_at timestamptz, ends_at timestamptz, kind text)
language sql stable security definer set search_path = public as $$
  select b.court_id, b.starts_at, b.ends_at, 'booked'::text from public.bookings b
   where public.booking_is_active(b) and (b.starts_at at time zone 'Asia/Jakarta')::date = _date
  union all
  select c.court_id, c.starts_at, c.ends_at, 'blocked'::text from public.court_blocks c
   where (c.starts_at at time zone 'Asia/Jakarta')::date <= _date and (c.ends_at at time zone 'Asia/Jakarta')::date >= _date $$;
revoke all on function public.get_availability(date) from public;
grant execute on function public.get_availability(date) to anon, authenticated;

alter table public.payments add column if not exists resolution text;
alter table public.court_blocks add column if not exists is_demo boolean not null default false;
alter table public.court_blocks add column if not exists created_at timestamptz not null default now();

update public.payments set booking_id = (select id from public.bookings where code = 'PDL-2053') where flag = 'late' and is_demo;

-- keep the late payment linked to PDL-2053 on every reset
create or replace function public.reset_demo_link_late() returns void language sql security definer set search_path = public as $$
  update public.payments set booking_id = (select id from public.bookings where code = 'PDL-2053') where flag = 'late' and is_demo and booking_id is null $$;
revoke all on function public.reset_demo_link_late() from public, anon, authenticated;

create or replace function public._jt(_t timestamptz) returns text language sql immutable set search_path = public as $$ select to_char(_t at time zone 'Asia/Jakarta', 'HH24.MI') $$;

create or replace function public.slot_free(_court uuid, _s timestamptz, _e timestamptz, _except uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.bookings b where b.court_id=_court and b.id is distinct from _except and public.booking_is_active(b) and b.starts_at < _e and b.ends_at > _s)
     and not exists (select 1 from public.court_blocks c where c.court_id=_court and c.starts_at < _e and c.ends_at > _s) $$;
revoke all on function public.slot_free(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.slot_free(uuid, timestamptz, timestamptz, uuid) to authenticated;

create or replace function public.resolve_payment(_payment uuid, _action text, _booking uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments; b public.bookings; _court text; _who text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into p from public.payments where id=_payment for update;
  if p.id is null or p.flag is null then raise exception 'This payment is already sorted'; end if;
  _who := coalesce(p.payer, 'Guest');
  if _action = 'refund' then
    update public.payments set status='refunded', resolution='refunded', flag=null where id=p.id;
    insert into public.system_log (kind, message, booking_id) values ('payment', 'Refund of ' || p.amount_idr || ' to ' || _who, p.booking_id);
  elsif _action = 'credit' then
    update public.payments set status='credit', resolution='credit', flag=null where id=p.id;
    insert into public.system_log (kind, message, booking_id) values ('payment', 'Overpayment kept as credit for ' || _who, p.booking_id);
  elsif _action = 'match' then
    select * into b from public.bookings where id=_booking for update;
    if b.id is null then raise exception 'Pick a booking'; end if;
    select name into _court from public.courts where id=b.court_id;
    update public.payments set booking_id=b.id, resolution='matched', flag=null where id=p.id;
    update public.bookings set paid_idr = least(total_idr, paid_idr + p.amount_idr),
      status = case when paid_idr + p.amount_idr >= total_idr then 'paid' else status end,
      balance_due_at = case when paid_idr + p.amount_idr >= total_idr then null else balance_due_at end where id=b.id;
    insert into public.system_log (kind, message, booking_id) values ('payment', 'Transfer from ' || _who || ' matched to ' || b.code || ', ' || _court || ', ' || public._jt(b.starts_at), b.id);
  elsif _action = 'honor' then
    select * into b from public.bookings where id=p.booking_id for update;
    if b.id is null then raise exception 'No booking linked to this payment'; end if;
    if not public.slot_free(b.court_id, b.starts_at, b.ends_at, b.id) then raise exception 'That slot is taken now. Refund instead.'; end if;
    select name into _court from public.courts where id=b.court_id;
    update public.bookings set status = case when p.amount_idr >= total_idr then 'paid' else 'deposit_paid' end,
      paid_idr = least(total_idr, p.amount_idr), hold_expires_at = null,
      balance_due_at = case when p.amount_idr >= total_idr then null else starts_at - interval '2 hours' end where id=b.id;
    update public.payments set resolution='honored', flag=null where id=p.id;
    insert into public.system_log (kind, message, booking_id) values ('payment', 'Late QRIS honoured, ' || b.code || ', ' || _court || ', ' || public._jt(b.starts_at), b.id);
  else raise exception 'Unknown action'; end if;
end $$;

create or replace function public.move_booking(_booking uuid, _court uuid, _starts timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; _e timestamptz; _from text; _to text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into b from public.bookings where id=_booking for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  _e := _starts + (b.ends_at - b.starts_at);
  if not public.slot_free(_court, _starts, _e, b.id) then raise exception 'That slot is taken. Pick another.'; end if;
  select name into _from from public.courts where id=b.court_id;
  select name into _to from public.courts where id=_court;
  update public.bookings set court_id=_court, starts_at=_starts, ends_at=_e,
    balance_due_at = case when balance_due_at is not null then _starts - interval '2 hours' end where id=b.id;
  insert into public.notifications (booking_id, kind, body) values (b.id, 'moved', 'Your game ' || b.code || ' is now ' || _to || ', ' || to_char(_starts at time zone 'Asia/Jakarta','Dy DD Mon') || ', ' || public._jt(_starts) || '.');
  insert into public.system_log (kind, message, booking_id) values ('booking', 'Moved ' || b.code || ' from ' || _from || ', ' || public._jt(b.starts_at) || ' to ' || _to || ', ' || public._jt(_starts), b.id);
end $$;

create or replace function public.cancel_booking(_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; _c text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into b from public.bookings where id=_booking for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  select name into _c from public.courts where id=b.court_id;
  update public.bookings set status='cancelled', hold_expires_at=null where id=b.id;
  insert into public.system_log (kind, message, booking_id) values ('booking', 'Cancelled ' || b.code || ', ' || _c || ', ' || public._jt(b.starts_at), b.id);
  perform public.offer_next(b.court_id, b.starts_at);
end $$;

create or replace function public.create_block(_court uuid, _starts timestamptz, _ends timestamptz, _reason text) returns int
language plpgsql security definer set search_path = public as $$
declare _n int := 0; r record; _c text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  if _ends <= _starts then raise exception 'The end time must be after the start'; end if;
  select name into _c from public.courts where id=_court;
  insert into public.court_blocks (court_id, starts_at, ends_at, reason) values (_court, _starts, _ends, left(coalesce(_reason,''), 80));
  for r in select b.id, b.code, b.starts_at from public.bookings b where b.court_id=_court and public.booking_is_active(b) and b.starts_at < _ends and b.ends_at > _starts loop
    _n := _n + 1;
    insert into public.notifications (booking_id, kind, body) values (r.id, 'court_blocked',
      _c || ' is closed at ' || public._jt(r.starts_at) || ' for ' || coalesce(nullif(_reason,''),'maintenance') || '. Reply to move your game ' || r.code || '.');
  end loop;
  insert into public.system_log (kind, message) values ('block', 'Blocked ' || _c || ', ' || public._jt(_starts) || ' to ' || public._jt(_ends) || ', ' || coalesce(nullif(_reason,''),'maintenance') || ', ' || _n || ' bookings told');
  return _n;
end $$;

create or replace function public.waitlist_offer_now(_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w public.waitlist_entries; _c text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into w from public.waitlist_entries where id=_entry for update;
  if w.id is null then raise exception 'Not found'; end if;
  select name into _c from public.courts where id=w.court_id;
  update public.waitlist_entries set status='passed', offer_expires_at=null where court_id=w.court_id and starts_at=w.starts_at and status='offered' and id<>w.id;
  update public.waitlist_entries set status='offered', offer_expires_at=now()+interval '15 minutes' where id=w.id;
  insert into public.notifications (kind, body) values ('waitlist_offer', w.guest || ', ' || _c || ' at ' || public._jt(w.starts_at) || ' is free. It is yours for 15 minutes.');
  insert into public.system_log (kind, message) values ('waitlist', 'Offer sent to ' || w.guest || ', ' || _c || ', ' || public._jt(w.starts_at) || ', by the desk');
end $$;

create or replace function public.waitlist_remove(_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w public.waitlist_entries; _c text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into w from public.waitlist_entries where id=_entry for update;
  if w.id is null then raise exception 'Not found'; end if;
  select name into _c from public.courts where id=w.court_id;
  update public.waitlist_entries set status='passed', offer_expires_at=null where id=w.id;
  insert into public.system_log (kind, message) values ('waitlist', 'Removed ' || w.guest || ' from ' || _c || ', ' || public._jt(w.starts_at));
  if w.status = 'offered' then perform public.offer_next(w.court_id, w.starts_at); end if;
end $$;

create or replace function public.end_hold_and_offer(_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; _c text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Staff only'; end if;
  select * into b from public.bookings where id=_booking and status='hold' for update;
  if b.id is null then raise exception 'That hold has already ended'; end if;
  select name into _c from public.courts where id=b.court_id;
  update public.bookings set status='expired', hold_expires_at=null where id=b.id;
  insert into public.system_log (kind, message, booking_id) values ('hold_released', 'Hold released by the desk, ' || _c || ', ' || public._jt(b.starts_at), b.id);
  perform public.offer_next(b.court_id, b.starts_at);
end $$;

revoke all on function public.resolve_payment(uuid, text, uuid), public.move_booking(uuid, uuid, timestamptz), public.cancel_booking(uuid),
  public.create_block(uuid, timestamptz, timestamptz, text), public.waitlist_offer_now(uuid), public.waitlist_remove(uuid), public.end_hold_and_offer(uuid) from public, anon;
grant execute on function public.resolve_payment(uuid, text, uuid), public.move_booking(uuid, uuid, timestamptz), public.cancel_booking(uuid),
  public.create_block(uuid, timestamptz, timestamptz, text), public.waitlist_offer_now(uuid), public.waitlist_remove(uuid), public.end_hold_and_offer(uuid) to authenticated;

alter publication supabase_realtime add table public.waitlist_entries;
alter publication supabase_realtime add table public.court_blocks;