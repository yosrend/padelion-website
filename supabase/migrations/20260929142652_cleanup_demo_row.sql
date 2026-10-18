delete from public.payments where booking_id in (select id from public.bookings where code = 'PDL-2054' and guest_name = 'Nadia');
delete from public.system_log where booking_id in (select id from public.bookings where code = 'PDL-2054' and guest_name = 'Nadia');
delete from public.bookings where code = 'PDL-2054' and guest_name = 'Nadia';