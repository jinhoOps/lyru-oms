create index if not exists order_change_requests_workspace_latest_idx
on public.order_change_requests (workspace_id, order_id, updated_at desc, created_at desc, id desc);

create or replace function public.list_latest_order_change_requests(target_workspace_id uuid)
returns table (
  order_id uuid,
  id uuid,
  note text,
  confirmed boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Only workspace members can list latest order change requests';
  end if;

  return query
  select
    latest.order_id,
    latest.id,
    latest.note,
    latest.confirmed,
    latest.created_at,
    latest.updated_at
  from (
    select distinct on (ocr.order_id)
      ocr.order_id,
      ocr.id,
      ocr.note,
      ocr.confirmed,
      ocr.created_at,
      ocr.updated_at
    from public.order_change_requests ocr
    where ocr.workspace_id = target_workspace_id
    order by
      ocr.order_id,
      ocr.updated_at desc,
      ocr.created_at desc,
      ocr.id desc
  ) latest
  order by
    latest.updated_at desc,
    latest.created_at desc,
    latest.id desc;
end;
$$;

revoke all on function public.list_latest_order_change_requests(uuid) from anon;
revoke execute on function public.list_latest_order_change_requests(uuid) from public;
grant execute on function public.list_latest_order_change_requests(uuid) to authenticated;
