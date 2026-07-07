-- Optional sample orders for a real Supabase project.
-- Use this only when you want development/demo data in the workspace that
-- belongs to an existing auth user.
--
-- Before running:
-- 1. supabase/migrations/20260706000000_initial_auth_workspace_schema.sql has been applied.
-- 2. supabase/bootstrap.owner.sql has connected the auth user to a workspace.
-- 3. Change owner_email below to the login email you use for development.
--
-- This file is idempotent for the sample order IDs below:
-- running it again updates the same sample orders instead of duplicating them.
--
-- To remove these samples later, run:
-- delete from public.orders
-- where id in (
--   '00000000-0000-4000-8000-000000000201',
--   '00000000-0000-4000-8000-000000000202',
--   '00000000-0000-4000-8000-000000000203',
--   '00000000-0000-4000-8000-000000000204'
-- );

with config as (
  select 'okho04@gmail.com'::text as owner_email
),
target_workspace as (
  select public.workspace_members.workspace_id
  from public.workspace_members
  join auth.users on auth.users.id = public.workspace_members.user_id
  join config on config.owner_email = auth.users.email
  order by public.workspace_members.created_at asc
  limit 1
),
sample_orders (
  id,
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
  missing_fields,
  review_reasons,
  warning_level,
  created_at,
  updated_at
) as (
  values
    (
      '00000000-0000-4000-8000-000000000201'::uuid,
      '네이버 스마트스토어',
      '신규',
      '성함: 나스닥3배
연락처: 010-3333-7777
상품: 화과자 4구 세트
수량: 2세트
선물 용도: 감사 선물
수령 방식: 픽업
희망일: 2026-07-15
픽업 시간: 14:00
알레르기: 없음
추가 옵션: 보자기 포장
요청사항: 선물용 쇼핑백 부탁드립니다.',
      '나스닥3배',
      '010-3333-7777',
      '화과자 4구 세트',
      '2세트',
      '감사 선물',
      '픽업',
      '2026-07-15',
      '14:00',
      '',
      '없음',
      '보자기 포장',
      '선물용 쇼핑백 부탁드립니다.',
      '정석 입력 예시',
      '{"isoDate":"2026-07-15","timeText":"","originalText":"2026-07-15","isRelative":false}'::jsonb,
      '[{"menuId":"sample-wagashi-4","label":"화과자 4구 세트","unitCount":4,"confidence":"exact"}]'::jsonb,
      '[{"value":2,"unit":"세트","rawText":"2세트"}]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'none',
      '2026-07-07T01:00:00.000Z'::timestamptz,
      '2026-07-07T01:00:00.000Z'::timestamptz
    ),
    (
      '00000000-0000-4000-8000-000000000202'::uuid,
      '카카오톡 채널',
      '확인 필요',
      '성함: 김답례
연락처: 010-2222-4444
상품: 곶감말이 2구 세트
수량: 3세트
선물 용도: 답례품
수령 방식: 택배
희망일: 2026-07-18
주소: 서울시 강남구 테헤란로 10
요청사항: 받는 분 이름 스티커 가능할까요?',
      '김답례',
      '010-2222-4444',
      '곶감말이 2구 세트',
      '3세트',
      '답례품',
      '택배',
      '2026-07-18',
      '',
      '서울시 강남구 테헤란로 10',
      '',
      '',
      '받는 분 이름 스티커 가능할까요?',
      '답례품 문구 확인 필요',
      '{"isoDate":"2026-07-18","timeText":"","originalText":"2026-07-18","isRelative":false}'::jsonb,
      '[{"menuId":"sample-dried-persimmon-2","label":"곶감말이 2구 세트","unitCount":2,"confidence":"exact"}]'::jsonb,
      '[{"value":3,"unit":"세트","rawText":"3세트"}]'::jsonb,
      '[]'::jsonb,
      '[{"kind":"확인필요","group":"check","code":"event-purpose","field":"purpose","label":"행사/답례품 주문","message":"행사나 답례품 용도라 요청사항 확인이 필요합니다."},{"kind":"확인필요","group":"check","code":"minimum-order","field":"quantity","label":"최소 주문 조건 확인","message":"최소 주문 조건을 확인해야 합니다.","detail":"2구 상품은 최소 5세트 기준입니다. 현재 3세트입니다."}]'::jsonb,
      'attention',
      '2026-07-07T02:00:00.000Z'::timestamptz,
      '2026-07-07T02:00:00.000Z'::timestamptz
    ),
    (
      '00000000-0000-4000-8000-000000000203'::uuid,
      '인스타그램',
      '제작 준비',
      '성함: 박픽업
상품: 화과자 4구 세트
수량: 12세트
수령 방식: 픽업
희망일: 2026-07-20
픽업 시간: 11:30
요청사항: 회사 선물이라 개별 포장 부탁드려요.',
      '박픽업',
      '',
      '화과자 4구 세트',
      '12세트',
      '단체/기업',
      '픽업',
      '2026-07-20',
      '11:30',
      '',
      '',
      '개별 포장',
      '회사 선물이라 개별 포장 부탁드려요.',
      '대량 주문 생산량 확인',
      '{"isoDate":"2026-07-20","timeText":"","originalText":"2026-07-20","isRelative":false}'::jsonb,
      '[{"menuId":"sample-wagashi-4","label":"화과자 4구 세트","unitCount":4,"confidence":"exact"}]'::jsonb,
      '[{"value":12,"unit":"세트","rawText":"12세트"}]'::jsonb,
      '[]'::jsonb,
      '[{"kind":"확인필요","group":"check","code":"bulk-real-unit","field":"quantity","label":"대량 기준 가능성","message":"대량 기준에 해당할 수 있어 확인이 필요합니다.","detail":"4구 x 12세트 = 48구"}]'::jsonb,
      'attention',
      '2026-07-08T01:30:00.000Z'::timestamptz,
      '2026-07-08T01:30:00.000Z'::timestamptz
    ),
    (
      '00000000-0000-4000-8000-000000000204'::uuid,
      '네이버 톡톡',
      '확인 필요',
      '성함: 이확인
연락처: 010-9999-1212
상품: 프리미엄 세트
수량: 1세트
희망일: 다음주 금요일
요청사항: 택배 가능한지 궁금합니다.',
      '이확인',
      '010-9999-1212',
      '프리미엄 세트',
      '1세트',
      '',
      '',
      '다음주 금요일',
      '',
      '',
      '',
      '',
      '택배 가능한지 궁금합니다.',
      '상대 날짜와 수령 방식 확인',
      '{"isoDate":"2026-07-17","timeText":"","originalText":"다음주 금요일","isRelative":true}'::jsonb,
      '[]'::jsonb,
      '[{"value":1,"unit":"세트","rawText":"1세트"}]'::jsonb,
      '["fulfillmentType"]'::jsonb,
      '[{"kind":"정보 부족","group":"info","code":"missing-field","field":"fulfillmentType","label":"수령 방식","message":"수령 방식"},{"kind":"확인필요","group":"check","code":"relative-date","field":"desiredDateTime","label":"날짜 확인 필요","message":"날짜 표현을 확인해야 합니다.","detail":"원문 표현: 다음주 금요일"}]'::jsonb,
      'attention',
      '2026-07-09T03:10:00.000Z'::timestamptz,
      '2026-07-09T03:10:00.000Z'::timestamptz
    )
)
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
select
  sample_orders.id,
  target_workspace.workspace_id,
  sample_orders.source,
  sample_orders.status,
  sample_orders.raw_text,
  sample_orders.customer_name,
  sample_orders.phone,
  sample_orders.order_items,
  sample_orders.quantity,
  sample_orders.purpose,
  sample_orders.fulfillment_type,
  sample_orders.desired_date_time,
  sample_orders.pickup_time,
  sample_orders.address,
  sample_orders.allergy_note,
  sample_orders.options,
  sample_orders.customer_request_note,
  sample_orders.owner_memo,
  sample_orders.parsed_date,
  sample_orders.menu_matches,
  sample_orders.quantity_candidates,
  '[]'::jsonb,
  '[]'::jsonb,
  sample_orders.missing_fields,
  sample_orders.review_reasons,
  sample_orders.warning_level,
  sample_orders.created_at,
  sample_orders.updated_at
from sample_orders
cross join target_workspace
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
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
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
