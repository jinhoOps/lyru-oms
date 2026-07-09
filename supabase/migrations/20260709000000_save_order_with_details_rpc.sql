create or replace function public.save_order_with_details(
  target_workspace_id uuid,
  order_payload jsonb,
  change_request_payload jsonb default null
)
returns table (
  id uuid,
  workspace_id uuid,
  source text,
  status text,
  raw_text text,
  customer_name text,
  phone text,
  order_items text,
  quantity text,
  purpose text,
  fulfillment_type text,
  desired_date_time text,
  pickup_time text,
  address text,
  allergy_note text,
  options text,
  customer_request_note text,
  owner_memo text,
  parsed_date jsonb,
  menu_matches jsonb,
  quantity_candidates jsonb,
  manually_edited_fields jsonb,
  reparse_differences jsonb,
  missing_fields jsonb,
  review_reasons jsonb,
  warning_level text,
  created_at timestamptz,
  updated_at timestamptz,
  change_request_id uuid,
  change_request_note text,
  change_request_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_order public.orders%rowtype;
  saved_change_request public.order_change_requests%rowtype;
  trimmed_note text := nullif(trim(coalesce(change_request_payload->>'note', '')), '');
  confirmed_value boolean := coalesce((change_request_payload->>'confirmed')::boolean, false);
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Only workspace members can save orders';
  end if;

  if (order_payload->>'workspace_id')::uuid is distinct from target_workspace_id then
    raise exception 'order workspace_id must match target_workspace_id';
  end if;

  insert into public.orders (
    id,
    workspace_id,
    source,
    status,
    raw_text,
    customer_name,
    phone,
    order_items,
    quantity,
    purpose,
    fulfillment_type,
    desired_date_time,
    pickup_time,
    address,
    allergy_note,
    options,
    customer_request_note,
    owner_memo,
    parsed_date,
    menu_matches,
    quantity_candidates,
    manually_edited_fields,
    reparse_differences,
    missing_fields,
    review_reasons,
    warning_level,
    created_at,
    updated_at
  )
  values (
    (order_payload->>'id')::uuid,
    target_workspace_id,
    order_payload->>'source',
    order_payload->>'status',
    order_payload->>'raw_text',
    coalesce(order_payload->>'customer_name', ''),
    coalesce(order_payload->>'phone', ''),
    coalesce(order_payload->>'order_items', ''),
    coalesce(order_payload->>'quantity', ''),
    coalesce(order_payload->>'purpose', ''),
    coalesce(order_payload->>'fulfillment_type', ''),
    coalesce(order_payload->>'desired_date_time', ''),
    coalesce(order_payload->>'pickup_time', ''),
    coalesce(order_payload->>'address', ''),
    coalesce(order_payload->>'allergy_note', ''),
    coalesce(order_payload->>'options', ''),
    coalesce(order_payload->>'customer_request_note', ''),
    coalesce(order_payload->>'owner_memo', ''),
    order_payload->'parsed_date',
    coalesce(order_payload->'menu_matches', '[]'::jsonb),
    coalesce(order_payload->'quantity_candidates', '[]'::jsonb),
    coalesce(order_payload->'manually_edited_fields', '[]'::jsonb),
    coalesce(order_payload->'reparse_differences', '[]'::jsonb),
    coalesce(order_payload->'missing_fields', '[]'::jsonb),
    coalesce(order_payload->'review_reasons', '[]'::jsonb),
    coalesce(order_payload->>'warning_level', 'none'),
    (order_payload->>'created_at')::timestamptz,
    (order_payload->>'updated_at')::timestamptz
  )
  on conflict (id) do update
  set
    source = excluded.source,
    status = excluded.status,
    raw_text = excluded.raw_text,
    customer_name = excluded.customer_name,
    phone = excluded.phone,
    order_items = excluded.order_items,
    quantity = excluded.quantity,
    purpose = excluded.purpose,
    fulfillment_type = excluded.fulfillment_type,
    desired_date_time = excluded.desired_date_time,
    pickup_time = excluded.pickup_time,
    address = excluded.address,
    allergy_note = excluded.allergy_note,
    options = excluded.options,
    customer_request_note = excluded.customer_request_note,
    owner_memo = excluded.owner_memo,
    parsed_date = excluded.parsed_date,
    menu_matches = excluded.menu_matches,
    quantity_candidates = excluded.quantity_candidates,
    manually_edited_fields = excluded.manually_edited_fields,
    reparse_differences = excluded.reparse_differences,
    missing_fields = excluded.missing_fields,
    review_reasons = excluded.review_reasons,
    warning_level = excluded.warning_level,
    updated_at = excluded.updated_at
  where orders.workspace_id = target_workspace_id
  returning * into saved_order;

  if saved_order.id is null then
    raise exception 'Order not found in target workspace';
  end if;

  if trimmed_note is null then
    delete from public.order_change_requests ocr
    where ocr.workspace_id = target_workspace_id
      and ocr.order_id = saved_order.id;
  else
    insert into public.order_change_requests (
      workspace_id,
      order_id,
      note,
      confirmed
    )
    values (
      target_workspace_id,
      saved_order.id,
      trimmed_note,
      confirmed_value
    )
    on conflict (workspace_id, order_id) do update
    set
      note = excluded.note,
      confirmed = excluded.confirmed
    returning * into saved_change_request;
  end if;

  return query
  select
    saved_order.id,
    saved_order.workspace_id,
    saved_order.source,
    saved_order.status,
    saved_order.raw_text,
    saved_order.customer_name,
    saved_order.phone,
    saved_order.order_items,
    saved_order.quantity,
    saved_order.purpose,
    saved_order.fulfillment_type,
    saved_order.desired_date_time,
    saved_order.pickup_time,
    saved_order.address,
    saved_order.allergy_note,
    saved_order.options,
    saved_order.customer_request_note,
    saved_order.owner_memo,
    saved_order.parsed_date,
    saved_order.menu_matches,
    saved_order.quantity_candidates,
    saved_order.manually_edited_fields,
    saved_order.reparse_differences,
    saved_order.missing_fields,
    saved_order.review_reasons,
    saved_order.warning_level,
    saved_order.created_at,
    saved_order.updated_at,
    saved_change_request.id,
    saved_change_request.note,
    saved_change_request.confirmed;
end;
$$;

revoke all on function public.save_order_with_details(uuid, jsonb, jsonb) from anon;
grant execute on function public.save_order_with_details(uuid, jsonb, jsonb) to authenticated;
