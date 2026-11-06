create extension if not exists pgcrypto with schema extensions;

create table if not exists public.agency_members (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  is_active boolean not null default true,
  can_manage_members boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_members_full_name_not_blank check (length(trim(full_name)) > 0)
);

create table if not exists public.agency_settings (
  id uuid primary key default gen_random_uuid(),
  is_singleton boolean not null default true unique check (is_singleton),
  agency_name text not null default 'BABE AGENCY',
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_settings_name_not_blank check (length(trim(agency_name)) > 0)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger agency_members_set_updated_at
  before update on public.agency_members
  for each row execute function public.set_updated_at();
create trigger agency_settings_set_updated_at
  before update on public.agency_settings
  for each row execute function public.set_updated_at();

create or replace function public.is_active_agency_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.agency_members m where m.id = (select auth.uid()) and m.is_active);
$$;

create or replace function public.can_manage_agency_members()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.agency_members m where m.id = (select auth.uid()) and m.is_active and m.can_manage_members);
$$;

revoke all on function public.is_active_agency_member() from public, anon;
revoke all on function public.can_manage_agency_members() from public, anon;
grant execute on function public.is_active_agency_member() to authenticated;
grant execute on function public.can_manage_agency_members() to authenticated;

alter table public.agency_members enable row level security;
alter table public.agency_settings enable row level security;

revoke all on public.agency_members from anon, authenticated;
revoke all on public.agency_settings from anon, authenticated;
grant select, insert, update, delete on public.agency_members to authenticated;
grant select, insert, update, delete on public.agency_settings to authenticated;

create policy "Members can view their own membership" on public.agency_members
  for select to authenticated using (id = (select auth.uid()));
create policy "Membership managers can view agency members" on public.agency_members
  for select to authenticated using ((select public.can_manage_agency_members()));
create policy "Membership managers can add members" on public.agency_members
  for insert to authenticated with check ((select public.can_manage_agency_members()));
create policy "Membership managers can update members" on public.agency_members
  for update to authenticated using ((select public.can_manage_agency_members()))
  with check ((select public.can_manage_agency_members()));
create policy "Membership managers can remove members" on public.agency_members
  for delete to authenticated using ((select public.can_manage_agency_members()));

create policy "Active members can read agency settings" on public.agency_settings
  for select to authenticated using ((select public.is_active_agency_member()));
create policy "Membership managers can create agency settings" on public.agency_settings
  for insert to authenticated with check ((select public.can_manage_agency_members()));
create policy "Membership managers can update agency settings" on public.agency_settings
  for update to authenticated using ((select public.can_manage_agency_members()))
  with check ((select public.can_manage_agency_members()));
create policy "Membership managers can delete agency settings" on public.agency_settings
  for delete to authenticated using ((select public.can_manage_agency_members()));
