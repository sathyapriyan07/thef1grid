create extension if not exists "pgcrypto";

do $$ begin
  create type public.data_source as enum ('jolpica', 'manual');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.session_type as enum ('practice1', 'practice2', 'practice3', 'qualifying', 'sprint', 'race');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'public' check (role in ('public', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table if not exists public.seasons (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, year integer not null unique, url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.circuits (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, name text not null, location text, country text, lat numeric, lng numeric, url text, image_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.teams (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, name text not null, nationality text, url text, logo_url text, color_hex text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.drivers (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, driver_ref text, code text, permanent_number text, given_name text not null, family_name text not null, dob date, nationality text, url text, headshot_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.races (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, season_id uuid not null references public.seasons(id), round integer not null, circuit_id uuid references public.circuits(id), name text not null, date date, time time, url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(season_id, round));
create table if not exists public.sessions (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, race_id uuid not null references public.races(id) on delete cascade, type session_type not null, date date, time time, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.status (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, status_text text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.results (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, race_id uuid not null references public.races(id) on delete cascade, driver_id uuid not null references public.drivers(id), team_id uuid references public.teams(id), grid integer, position integer, position_text text, points numeric, laps integer, status_id uuid references public.status(id), fastest_lap_rank integer, fastest_lap_time text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(race_id, driver_id));
create table if not exists public.qualifying_results (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, race_id uuid not null references public.races(id) on delete cascade, driver_id uuid not null references public.drivers(id), team_id uuid references public.teams(id), position integer, q1 text, q2 text, q3 text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(race_id, driver_id));
create table if not exists public.sprint_results (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, race_id uuid not null references public.races(id) on delete cascade, driver_id uuid not null references public.drivers(id), team_id uuid references public.teams(id), grid integer, position integer, points numeric, laps integer, status_id uuid references public.status(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(race_id, driver_id));
create table if not exists public.laps (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, race_id uuid not null references public.races(id) on delete cascade, driver_id uuid not null references public.drivers(id), lap_number integer not null, position integer, time_ms integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(race_id, driver_id, lap_number));
create table if not exists public.pitstops (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, race_id uuid not null references public.races(id) on delete cascade, driver_id uuid not null references public.drivers(id), stop_number integer not null, lap integer, time text, duration_ms integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(race_id, driver_id, stop_number));
create table if not exists public.session_entries (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, session_id uuid not null references public.sessions(id) on delete cascade, driver_id uuid not null references public.drivers(id), team_id uuid references public.teams(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(session_id, driver_id));
create table if not exists public.driver_standings (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, season_id uuid not null references public.seasons(id) on delete cascade, race_id uuid references public.races(id) on delete cascade, driver_id uuid not null references public.drivers(id), team_id uuid references public.teams(id), points numeric, position integer, wins integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(season_id, race_id, driver_id));
create table if not exists public.constructor_standings (id uuid primary key default gen_random_uuid(), source data_source not null default 'manual', external_ref text unique, is_overridden boolean not null default false, overrides jsonb not null default '{}'::jsonb, season_id uuid not null references public.seasons(id) on delete cascade, race_id uuid references public.races(id) on delete cascade, team_id uuid not null references public.teams(id), points numeric, position integer, wins integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(season_id, race_id, team_id));
create table if not exists public.import_logs (id uuid primary key default gen_random_uuid(), timestamp timestamptz not null default now(), endpoint text not null, mode text not null check (mode in ('single', 'bulk')), entity_type text not null, records_processed integer not null default 0, records_created integer not null default 0, records_updated integer not null default 0, errors jsonb not null default '[]'::jsonb, triggered_by uuid references auth.users(id));
create table if not exists public.media (id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, url text not null, type text not null check (type in ('logo', 'headshot', 'circuit_image')), uploaded_by uuid references auth.users(id), created_at timestamptz not null default now());

DO $$ declare table_name text; begin
  foreach table_name in array array['seasons','circuits','teams','drivers','races','sessions','status','results','qualifying_results','sprint_results','laps','pitstops','session_entries','driver_standings','constructor_standings'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists public_read on public.%I', table_name);
    execute format('create policy public_read on public.%I for select using (true)', table_name);
    execute format('drop policy if exists admin_write on public.%I', table_name);
    execute format('create policy admin_write on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists profile_self_read on public.profiles;
create policy profile_self_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profile_admin_write on public.profiles;
create policy profile_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());

alter table public.import_logs enable row level security;
drop policy if exists import_logs_admin_read on public.import_logs;
create policy import_logs_admin_read on public.import_logs for select using (public.is_admin());
drop policy if exists import_logs_admin_write on public.import_logs;
create policy import_logs_admin_write on public.import_logs for all using (public.is_admin()) with check (public.is_admin());
alter table public.media enable row level security;
drop policy if exists media_public_read on public.media;
create policy media_public_read on public.media for select using (true);
drop policy if exists media_admin_write on public.media;
create policy media_admin_write on public.media for all using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.seasons, public.circuits, public.teams, public.drivers, public.races, public.sessions, public.status, public.results, public.qualifying_results, public.sprint_results, public.laps, public.pitstops, public.session_entries, public.driver_standings, public.constructor_standings, public.media to anon, authenticated;
grant insert, update, delete on public.seasons, public.circuits, public.teams, public.drivers, public.races, public.sessions, public.status, public.results, public.qualifying_results, public.sprint_results, public.laps, public.pitstops, public.session_entries, public.driver_standings, public.constructor_standings, public.profiles, public.media to authenticated;
grant select, insert on public.import_logs to authenticated;
