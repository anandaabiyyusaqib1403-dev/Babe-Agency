-- Separate workspace administration from the legacy owner/admin database role.
alter table public.agency_team_permissions
  drop constraint agency_team_permissions_permission_check;

alter table public.agency_team_permissions
  add constraint agency_team_permissions_permission_check
  check (permission in ('team.manage', 'workspace.manage'));

create or replace function public.can_manage_agency_members()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1 from public.agency_members m
      where m.id = (select auth.uid())
        and m.is_active
        and m.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.agency_team_memberships t
      join public.agency_members m on m.id = t.member_id
      join public.agency_team_permissions p
        on p.workspace_id = t.workspace_id and p.member_id = t.member_id
      join public.agency_settings w on w.id = t.workspace_id and w.is_singleton
      where t.member_id = (select auth.uid())
        and t.is_active and m.is_active
        and p.permission = 'workspace.manage'
    );
$function$;

-- Grant capability only to the already-provisioned workspace administrator.
insert into public.agency_team_permissions
  (workspace_id, member_id, permission, assignable_roles, approved_by)
select w.id, m.id, 'workspace.manage', array[]::text[], m.id
from public.agency_settings w
join public.agency_members m on m.email = 'anandaabiyyusaqib1403@gmail.com'
join public.agency_team_memberships t
  on t.workspace_id = w.id and t.member_id = m.id
where w.is_singleton and t.is_active and t.application_role = 'AGENCY_MEMBER'
on conflict (workspace_id, member_id, permission) do nothing;
