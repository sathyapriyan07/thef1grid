insert into storage.buckets (id, name, public)
values ('driver-images', 'driver-images', true)
on conflict (id) do update set public = true;

drop policy if exists driver_images_public_read on storage.objects;
create policy driver_images_public_read on storage.objects
for select using (bucket_id = 'driver-images');

drop policy if exists driver_images_admin_insert on storage.objects;
create policy driver_images_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'driver-images' and public.is_admin());

drop policy if exists driver_images_admin_update on storage.objects;
create policy driver_images_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'driver-images' and public.is_admin())
with check (bucket_id = 'driver-images' and public.is_admin());

drop policy if exists driver_images_admin_delete on storage.objects;
create policy driver_images_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'driver-images' and public.is_admin());
