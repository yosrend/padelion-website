alter function public.booking_is_active(public.bookings) set search_path = public;
alter function public.norm_wa(text) set search_path = public;
revoke execute on function public.is_staff(uuid), public.is_owner(uuid) from public, anon;
revoke execute on function public.price_for(uuid, timestamptz, int) from anon, authenticated;