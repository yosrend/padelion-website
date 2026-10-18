create extension if not exists pg_cron;

drop policy if exists "Staff manage addons" on public.addons;
create policy "Owners manage addons" on public.addons for all to authenticated using (public.is_owner(auth.uid())) with check (public.is_owner(auth.uid()));

create unique index if not exists staff_user_id_key on public.staff(user_id);

create or replace function public.my_staff() returns table(name text, role public.staff_role)
language sql stable security definer set search_path = public as $$
  select s.name, s.role from public.staff s where s.user_id = auth.uid() $$;
revoke all on function public.my_staff() from public, anon;
grant execute on function public.my_staff() to authenticated;

create or replace function public.offer_next(_court uuid, _starts timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare w public.waitlist_entries; _cname text;
begin
  if exists (select 1 from public.waitlist_entries where court_id=_court and starts_at=_starts and status='offered') then return; end if;
  if exists (select 1 from public.bookings b where b.court_id=_court and public.booking_is_active(b) and b.starts_at < _starts + interval '60 minutes' and b.ends_at > _starts) then return; end if;
  select * into w from public.waitlist_entries where court_id=_court and starts_at=_starts and status='waiting' order by position limit 1 for update;
  if w.id is null then return; end if;
  select name into _cname from public.courts where id=_court;
  update public.waitlist_entries set status='offered', offer_expires_at=now()+interval '15 minutes' where id=w.id;
  insert into public.notifications (kind, body) values ('waitlist_offer',
    w.guest || ', ' || _cname || ' at ' || to_char(_starts at time zone 'Asia/Jakarta','HH24.MI') || ' is free. It is yours for 15 minutes.');
  insert into public.system_log (kind, message) values ('waitlist', 'Offer sent to ' || w.guest || ', ' || _cname || ', ' || to_char(_starts at time zone 'Asia/Jakarta','HH24.MI'));
end $$;

create or replace function public.run_minute_jobs() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
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
  select b.id, 'reminder_2h', 'Your game on ' || c.name || ' starts at ' || to_char(b.starts_at at time zone 'Asia/Jakarta','HH24.MI') || '. Code ' || b.code || '.', b.starts_at - interval '2 hours'
  from public.bookings b join public.courts c on c.id=b.court_id
  where b.status in ('deposit_paid','paid') and b.starts_at > now()
    and not exists (select 1 from public.notifications n where n.booking_id=b.id and n.kind='reminder_2h');
end $$;
revoke all on function public.run_minute_jobs(), public.offer_next(uuid, timestamptz) from public, anon, authenticated;