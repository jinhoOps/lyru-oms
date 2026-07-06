-- Development seed only. Do not execute this file against production.
-- After creating a local development auth user, insert its auth.users id into
-- public.workspace_members for the development workspace below.

insert into public.workspaces (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Lyru 개발 작업실')
on conflict (id) do nothing;

insert into public.workspace_settings (workspace_id, settings)
values (
  '00000000-0000-4000-8000-000000000001',
  '{
    "requiredFields": ["orderItems", "quantity", "desiredDateTime", "fulfillmentType"],
    "conditionalRequiredFields": {
      "address": { "field": "fulfillmentType", "equals": "택배" }
    },
    "quantityRules": {
      "bulkRealUnitThreshold": 40,
      "minimumOrderRules": [
        { "unitCount": 2, "minimumSets": 5 },
        { "unitCount": 4, "minimumSets": 2 }
      ]
    }
  }'::jsonb
)
on conflict (workspace_id) do nothing;

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
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  '네이버 스마트스토어',
  '신규',
  '성함: 나스닥3배
연락처: 010-3333-7777
상품: 화과자 4구 세트
수량: 2세트
선물 용도: 감사 선물
수령 방식: 픽업
희망일: 2026-07-05
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
  '2026-07-05',
  '14:00',
  '없음',
  '보자기 포장',
  '선물용 쇼핑백 부탁드립니다.',
  '정석 입력 예시',
  '{"isoDate":"2026-07-05","timeText":"","originalText":"2026-07-05","isRelative":false}'::jsonb,
  '[{"menuId":"sample-wagashi-4","label":"화과자 4구 세트","unitCount":4,"confidence":"exact"}]'::jsonb,
  '[{"value":2,"unit":"세트","rawText":"2세트"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'none',
  '2026-07-03T00:05:00.000Z',
  '2026-07-03T00:05:00.000Z'
)
on conflict (id) do nothing;
