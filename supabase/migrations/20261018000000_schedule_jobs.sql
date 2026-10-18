-- Scheduled jobs. Safe to run more than once.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('padelion-minute-jobs', 'padelion-demo-reset');
end $$;

-- Every minute: release expired holds, hand freed slots to the waitlist, queue reminders.
select cron.schedule('padelion-minute-jobs', '* * * * *', $$select public.run_minute_jobs()$$);

-- Every day at 05.00 Asia/Jakarta (22.00 UTC): rebuild the demo rows. Real bookings are never touched.
select cron.schedule('padelion-demo-reset', '0 22 * * *', $$select public.reset_demo()$$);
