create table if not exists public.driver_podiums (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(driver_id, season_id)
);

alter table public.driver_podiums enable row level security;
drop policy if exists driver_podiums_public_read on public.driver_podiums;
create policy driver_podiums_public_read on public.driver_podiums for select using (true);
drop policy if exists driver_podiums_admin_write on public.driver_podiums;
create policy driver_podiums_admin_write on public.driver_podiums for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('podium-images', 'podium-images', true)
on conflict (id) do update set public = true;

drop policy if exists podium_images_public_read on storage.objects;
create policy podium_images_public_read on storage.objects for select using (bucket_id = 'podium-images');
drop policy if exists podium_images_admin_insert on storage.objects;
create policy podium_images_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'podium-images' and public.is_admin());
drop policy if exists podium_images_admin_update on storage.objects;
create policy podium_images_admin_update on storage.objects for update to authenticated using (bucket_id = 'podium-images' and public.is_admin()) with check (bucket_id = 'podium-images' and public.is_admin());
drop policy if exists podium_images_admin_delete on storage.objects;
create policy podium_images_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'podium-images' and public.is_admin());

drop trigger if exists set_updated_at on public.driver_podiums;
create trigger set_updated_at before update on public.driver_podiums for each row execute function public.touch_updated_at();
grant select on public.driver_podiums to anon, authenticated;
grant insert, update, delete on public.driver_podiums to authenticated;
