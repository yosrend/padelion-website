CREATE OR REPLACE FUNCTION public.reset_demo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  insert into public.waitlist_entries (court_id, starts_at, guest, whatsapp, position, status, offer_expires_at, is_demo)
  select c.id, (_d + v.dd + v.t) at time zone 'Asia/Jakarta', v.g,
    case v.g when 'Maya' then '0812 1100 2048' when 'Arif H.' then '0812 1100 2045' when 'Bima' then '0812 1100 2051' when 'Dinda' then '0812 1100 2049' end, v.p, v.st,
    case when v.st='offered' then now() + interval '15 minutes' end, true
  from (values (1,1,time '21:00','Maya',1,'offered'),(3,0,time '20:00','Arif H.',1,'waiting'),
   (1,6,time '19:00','Bima',1,'waiting'),(1,6,time '19:00','Maya',2,'waiting'),(1,6,time '19:00','Dinda',3,'waiting')) v(sort,dd,t,g,p,st)
  join public.courts c on c.sort = v.sort;

  insert into public.system_log (kind, message) values ('demo', 'Demo data reset for ' || to_char(_d, 'Dy DD Mon'));
end $function$;