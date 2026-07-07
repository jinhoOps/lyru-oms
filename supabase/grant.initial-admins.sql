-- One-time helper for the current production project.
-- Run after:
-- 1. Authentication > Users has both accounts below.
-- 2. supabase/migrations/20260706000000_initial_auth_workspace_schema.sql has been applied.
-- 3. supabase/bootstrap.owner.sql has created the first workspace for okho04@gmail.com.
--
-- This grants owner role to both development/admin accounts for the first
-- workspace currently owned by okho04@gmail.com.

with config as (
  select
    'okho04@gmail.com'::text as primary_owner_email,
    array['okho04@gmail.com', 'jsss2536@naver.com']::text[] as admin_emails
),
target_workspace as (
  select wm.workspace_id
  from public.workspace_members wm
  join auth.users au on au.id = wm.user_id
  join config on lower(au.email) = lower(config.primary_owner_email)
  where wm.role = 'owner'
  order by wm.created_at asc
  limit 1
),
target_users as (
  select au.id as user_id
  from auth.users au
  join config on true
  join lateral unnest(config.admin_emails) as admin_email(email)
    on lower(au.email) = lower(admin_email.email)
)
insert into public.workspace_members (workspace_id, user_id, role)
select
  target_workspace.workspace_id,
  target_users.user_id,
  'owner'::public.workspace_role
from target_workspace
cross join target_users
on conflict (workspace_id, user_id) do update
set role = excluded.role;

-- Verification:
-- select au.email, w.name, wm.role
-- from public.workspace_members wm
-- join auth.users au on au.id = wm.user_id
-- join public.workspaces w on w.id = wm.workspace_id
-- where au.email in ('okho04@gmail.com', 'jsss2536@naver.com')
-- order by au.email;
