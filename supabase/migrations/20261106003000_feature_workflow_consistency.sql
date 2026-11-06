create or replace function public.publish_content_schedule(
  p_schedule_id uuid,
  p_post_url text
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  schedule_content_id uuid;
begin
  if not public.is_active_agency_member() then
    raise exception 'active_member_required';
  end if;

  select content_id into schedule_content_id
  from public.content_schedules
  where id = p_schedule_id
  for update;

  if schedule_content_id is null then
    raise exception 'schedule_not_found';
  end if;

  update public.content_schedules
  set publication_status = 'published',
      published_at = now(),
      post_url = nullif(trim(p_post_url), '')
  where id = p_schedule_id;

  update public.contents
  set workflow_status = 'published'
  where id = schedule_content_id
    and deleted_at is null;
end
$$;

grant execute on function public.publish_content_schedule(uuid, text) to authenticated;

create or replace function public.review_content_approval(
  p_approval_id uuid,
  p_decision text,
  p_feedback text
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  approval_content_id uuid;
  next_revision integer;
begin
  if not public.is_active_agency_member() then
    raise exception 'active_member_required';
  end if;

  if p_decision not in ('approved', 'revision_requested', 'rejected') then
    raise exception 'invalid_approval_transition';
  end if;

  select content_id into approval_content_id
  from public.content_approvals
  where id = p_approval_id
    and reviewer_id = (select auth.uid())
    and approval_status = 'pending'
  for update;

  if approval_content_id is null then
    raise exception 'approval_not_found_or_not_reviewer';
  end if;

  update public.content_approvals
  set approval_status = p_decision,
      feedback = coalesce(p_feedback, '')
  where id = p_approval_id;

  if p_decision = 'revision_requested' then
    select coalesce(max(revision_number), 0) + 1 into next_revision
    from public.content_revisions
    where content_id = approval_content_id;

    insert into public.content_revisions(
      content_id, approval_id, revision_number, revision_notes, revised_by
    )
    values(
      approval_content_id, p_approval_id, next_revision, coalesce(p_feedback, ''), (select auth.uid())
    );

    update public.contents
    set workflow_status = 'revision'
    where id = approval_content_id;
  elsif p_decision = 'approved' then
    update public.contents
    set workflow_status = 'approved'
    where id = approval_content_id;
  end if;
end
$$;

grant execute on function public.review_content_approval(uuid, text, text) to authenticated;
