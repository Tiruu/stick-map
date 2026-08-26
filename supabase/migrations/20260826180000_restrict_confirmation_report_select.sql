drop policy if exists "Anyone can read confirmations" on public.stick_confirmations;
drop policy if exists "Anyone can read reports" on public.stick_reports;

create policy "Authenticated users can read confirmations"
on public.stick_confirmations
for select
to authenticated
using (true);

create policy "Authenticated users can read reports"
on public.stick_reports
for select
to authenticated
using (true);
