create or replace function public.list_workspace_members(target_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
  role public.workspace_role,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only workspace owners can list workspace members';
  end if;

  return query
  select
    wm.user_id,
    au.email::text,
    wm.role,
    wm.created_at
  from public.workspace_members wm
  join auth.users au on au.id = wm.user_id
  where wm.workspace_id = target_workspace_id
  order by
    case when wm.role = 'owner' then 0 else 1 end,
    au.email asc;
end;
$$;

create or replace function public.upsert_workspace_member_by_email(
  target_workspace_id uuid,
  target_email text,
  target_role public.workspace_role
)
returns table (
  user_id uuid,
  email text,
  role public.workspace_role,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Only workspace owners can manage workspace members';
  end if;

  select au.id
  into target_user_id
  from auth.users au
  where lower(au.email) = lower(trim(target_email))
  limit 1;

  if target_user_id is null then
    raise exception 'Auth user not found for email %', target_email;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace_id, target_user_id, target_role)
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  return query
  select
    wm.user_id,
    au.email::text,
    wm.role,
    wm.created_at
  from public.workspace_members wm
  join auth.users au on au.id = wm.user_id
  where wm.workspace_id = target_workspace_id
    and wm.user_id = target_user_id;
end;
$$;

revoke all on function public.list_workspace_members(uuid) from anon;
revoke all on function public.upsert_workspace_member_by_email(uuid, text, public.workspace_role) from anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.upsert_workspace_member_by_email(uuid, text, public.workspace_role) to authenticated;
