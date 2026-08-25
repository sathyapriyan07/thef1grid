insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update set public = true;

drop policy if exists team_logos_public_read on storage.objects;
create policy team_logos_public_read on storage.objects
for select using (bucket_id = 'team-logos');

drop policy if exists team_logos_admin_insert on storage.objects;
create policy team_logos_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'team-logos' and public.is_admin());

drop policy if exists team_logos_admin_update on storage.objects;
create policy team_logos_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'team-logos' and public.is_admin())
with check (bucket_id = 'team-logos' and public.is_admin());

drop policy if exists team_logos_admin_delete on storage.objects;
create policy team_logos_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'team-logos' and public.is_admin());
