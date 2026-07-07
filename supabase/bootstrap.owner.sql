-- Production/bootstrap helper.
-- Use this after the schema migration has been applied.
--
-- What this does:
-- 1. Finds an existing Supabase Auth user by email.
-- 2. Creates the first Lyru workspace.
-- 3. Creates default workspace settings.
-- 4. Connects the auth user as the workspace owner.
--
-- Before running:
-- 1. Supabase Dashboard > Authentication > Users에서 로그인 계정을 먼저 만든다.
-- 2. supabase/migrations/20260706000000_initial_auth_workspace_schema.sql 전체를 먼저 실행한다.
-- 3. 아래 owner_email 값을 실제 로그인 이메일로 바꾼다.
--
-- Do not put database passwords, service_role keys, or secret keys here.

with config as (
  select
    'owner@example.com'::text as owner_email,
    '리루 작업실'::text as workspace_name
),
selected_user as (
  select auth.users.id as user_id
  from auth.users
  join config on config.owner_email = auth.users.email
),
new_workspace as (
  insert into public.workspaces (name)
  select workspace_name
  from config
  where exists (select 1 from selected_user)
  returning id
),
new_settings as (
  insert into public.workspace_settings (workspace_id, settings)
  select
    id,
    '{
      "requiredFields": ["orderItems", "quantity", "desiredDateTime", "fulfillmentType"],
      "conditionalRequiredFields": {
        "address": {
          "field": "fulfillmentType",
          "equals": "택배"
        }
      },
      "quantityRules": {
        "bulkRealUnitThreshold": 40,
        "minimumOrderRules": [
          { "unitCount": 2, "minimumSets": 5 },
          { "unitCount": 4, "minimumSets": 2 }
        ]
      }
    }'::jsonb
  from new_workspace
  returning workspace_id
)
insert into public.workspace_members (workspace_id, user_id, role)
select
  new_settings.workspace_id,
  selected_user.user_id,
  'owner'::public.workspace_role
from new_settings
cross join selected_user;

-- Verification query:
-- select
--   auth.users.email,
--   public.workspaces.name,
--   public.workspace_members.role
-- from public.workspace_members
-- join auth.users on auth.users.id = public.workspace_members.user_id
-- join public.workspaces on public.workspaces.id = public.workspace_members.workspace_id;
