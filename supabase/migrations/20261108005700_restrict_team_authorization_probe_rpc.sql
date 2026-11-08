-- Callers must not be able to probe arbitrary user/workspace authorization pairs.
-- Internal SECURITY DEFINER routines owned by the migration owner can still invoke this helper.
revoke all on function public.team_authorized(uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_authorized(uuid, uuid) to service_role;
