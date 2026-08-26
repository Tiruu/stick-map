drop policy if exists "Addressees can respond to pending friendships" on public.friendships;

create policy "Addressees can respond to pending friendships"
on public.friendships
for update
to authenticated
using (
  addressee_id = (select auth.uid())
  and status = 'pending'
)
with check (
  addressee_id = (select auth.uid())
  and status in ('accepted', 'rejected')
  and requester_id is not null
  and requester_id <> addressee_id
);

revoke update on table public.friendships from authenticated;
grant update (status, updated_at) on table public.friendships to authenticated;
