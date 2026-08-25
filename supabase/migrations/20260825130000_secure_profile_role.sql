-- ============================================================
-- Secure profile updates
-- ============================================================

-- Les utilisateurs ne doivent pas pouvoir modifier librement
-- leur profil : notamment leur rôle.
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- Seul le pseudo est modifiable directement.
grant update (username) on public.profiles to authenticated;

drop policy if exists
  "Users can update own profile"
on public.profiles;

create policy
  "Users can update own username"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);