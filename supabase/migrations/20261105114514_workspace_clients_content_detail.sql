-- Additive fields for the Clients and Content Planner workspace.
-- Existing tables, rows, foreign keys, and RLS policies remain in place.

alter table public.client_briefs
  add column if not exists business_background text not null default '',
  add column if not exists brand_description text not null default '',
  add column if not exists business_objectives text not null default '',
  add column if not exists marketing_objectives text not null default '',
  add column if not exists customer_persona text not null default '',
  add column if not exists customer_needs text not null default '',
  add column if not exists brand_voice text not null default '',
  add column if not exists market_position text not null default '',
  add column if not exists differentiation text not null default '',
  add column if not exists visual_references text not null default '',
  add column if not exists existing_social_media text not null default '',
  add column if not exists website_links text not null default '',
  add column if not exists marketing_notes text not null default '',
  add column if not exists special_requirements text not null default '',
  add column if not exists additional_notes text not null default '';

alter table public.client_packages
  add column if not exists package_description_snapshot text not null default '';

alter table public.content_pillars
  add column if not exists objective text not null default '',
  add column if not exists target_audience text not null default '',
  add column if not exists content_direction text not null default '',
  add column if not exists example_topics jsonb not null default '[]'::jsonb;
alter table public.content_pillars drop constraint if exists content_pillars_example_topics_array;
alter table public.content_pillars add constraint content_pillars_example_topics_array check(jsonb_typeof(example_topics)='array');

alter table public.contents
  add column if not exists campaign text not null default '',
  add column if not exists content_description text not null default '',
  add column if not exists key_message text not null default '',
  add column if not exists production_notes text not null default '',
  add column if not exists assigned_to uuid references public.agency_members(id) on delete set null;
create index if not exists contents_assigned_to_idx on public.contents(assigned_to);

alter table public.content_creative_briefs
  add column if not exists target_audience text not null default '',
  add column if not exists hook text not null default '',
  add column if not exists caption_direction text not null default '',
  add column if not exists call_to_action text not null default '';

create table if not exists public.content_status_history (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  old_status text,
  new_status text not null,
  actor_id uuid references public.agency_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists content_status_history_content_created_idx on public.content_status_history(content_id, created_at desc);
alter table public.content_status_history enable row level security;
drop policy if exists content_status_history_active_read on public.content_status_history;
create policy content_status_history_active_read on public.content_status_history
  for select to authenticated using((select public.is_active_agency_member()));
grant select on public.content_status_history to authenticated;

create or replace function public.log_content_status_history()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='INSERT' then
    insert into public.content_status_history(content_id,old_status,new_status,actor_id)
    values(new.id,null,new.workflow_status,(select auth.uid()));
  elsif new.workflow_status is distinct from old.workflow_status then
    insert into public.content_status_history(content_id,old_status,new_status,actor_id)
    values(new.id,old.workflow_status,new.workflow_status,(select auth.uid()));
  end if;
  return new;
end
$$;
revoke all on function public.log_content_status_history() from public,anon,authenticated;
drop trigger if exists contents_status_history_insert on public.contents;
drop trigger if exists contents_status_history_update on public.contents;
create trigger contents_status_history_insert after insert on public.contents
  for each row execute function public.log_content_status_history();
create trigger contents_status_history_update after update of workflow_status on public.contents
  for each row execute function public.log_content_status_history();
