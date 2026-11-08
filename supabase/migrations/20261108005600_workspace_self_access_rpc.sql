-- Return only the authenticated user's own workspace access snapshot.
create or replace function public.workspace_my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'workspace_id', t.workspace_id,
    'member_id', m.id,
    'legacy_role', m.role,
    'application_role', t.application_role,
    'is_active', m.is_active and coalesce(t.is_active, true),
    'permissions', coalesce(
      jsonb_agg(distinct p.permission) filter (where p.permission is not null),
      '[]'::jsonb
    )
  )
  from public.agency_members m
  left join public.agency_team_memberships t
    on t.member_id = m.id and t.is_active
  left join public.agency_team_permissions p
    on p.workspace_id = t.workspace_id and p.member_id = t.member_id
  where m.id = (select auth.uid()) and m.is_active
  group by m.id, m.role, m.is_active, t.workspace_id, t.application_role, t.is_active;
$function$;

revoke all on function public.workspace_my_access() from public, anon;
grant execute on function public.workspace_my_access() to authenticated;
