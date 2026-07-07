# Supabase Auth DB Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace saved operational localStorage data with Supabase Auth, workspace-scoped Postgres persistence, RLS, development seed data, and local draft/recent-order cache.

**Architecture:** Keep the React UI mostly intact while moving persistence behind focused client modules. Supabase owns saved orders/settings and workspace access; local storage keeps only UI preferences, drafts, and a read-only recent-order cache cleared on logout. PWA install/offline shell work is intentionally left for the follow-up plan after this foundation is merged.

**Tech Stack:** React 19, Vite 6, TypeScript, Vitest, Testing Library, Supabase JS v2, Supabase SQL migrations, localStorage for UI preferences/drafts/cache.

---

## Scope Boundary

This plan implements the first five roadmap items from `docs/superpowers/specs/2026-07-06-supabase-pwa-roadmap-design.md`:

1. Supabase database foundation.
2. Supabase Auth login.
3. Workspace membership and RLS authorization.
4. Development-only seed data.
5. Draft storage and recent-order read cache.

Do not implement PWA manifest, service worker, offline shell, or installability in this plan. Create a separate PWA plan after this branch lands.

## File Structure

Create:

- `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`: tables, indexes, triggers, and RLS policies.
- `supabase/seed.dev.sql`: explicit development seed, including `나스닥3배`.
- `src/lib/supabaseClient.ts`: reads Vite env, creates the browser Supabase client, exports a typed factory.
- `src/lib/supabaseClient.test.ts`: verifies env validation and client factory behavior without network calls.
- `src/auth/authTypes.ts`: session, user, workspace membership, and auth repository types.
- `src/auth/authRepository.ts`: Supabase Auth/session/workspace functions.
- `src/auth/authRepository.test.ts`: mock Supabase tests for login/logout/workspace states.
- `src/components/AuthGate.tsx`: email/password login shell and workspace blocked state.
- `src/components/AuthGate.test.tsx`: UI tests replacing passcode gate tests.
- `src/domain/orderRepository.ts`: repository interface plus Supabase row mapping for orders/settings/change requests/checklist tables.
- `src/domain/orderRepository.test.ts`: mapping, CRUD, and settings persistence tests using mocked Supabase query builders.
- `src/domain/localDraftCache.ts`: local draft and recent-order cache helpers.
- `src/domain/localDraftCache.test.ts`: cache TTL, mixed cache policy, and logout clearing tests.
- `src/domain/devSeedOrders.ts`: development-only order objects currently embedded in `App.tsx`.

Modify:

- `package.json`: add `@supabase/supabase-js`.
- `src/App.tsx`: load session/workspace through `AuthGate`, load data asynchronously from repository, save mutations through repository, remove automatic sample orders.
- `src/App.test.tsx`: replace passcode setup with authenticated repository mock setup; update empty workspace expectation.
- `src/components/AccessGate.tsx`: remove after `AuthGate` is in place.
- `src/components/AccessGate.test.tsx`: remove after `AuthGate.test.tsx` covers the new behavior.
- `src/domain/storage.ts`: stop using it for saved orders/settings; keep only if specific legacy hydration helpers are reused by repository tests.
- `src/domain/storage.test.ts`: reduce to retained hydration helpers or delete when no exports remain.
- `src/App.css`: rename/reuse access gate styles for auth login, workspace blocked, loading, and offline/cache status.
- `.env.example`: add public Supabase variables.
- `README.md`: add local Supabase setup, seed instructions, and GitHub Pages env notes.

## Data Model

Use these table responsibilities:

- `profiles`: one row per `auth.users.id`.
- `workspaces`: one shop/operator workspace.
- `workspace_members`: user-to-workspace membership with `owner` or `staff`.
- `orders`: current `CapturedOrder` data, workspace scoped. Store frequently filtered fields as columns and complex evaluation arrays as `jsonb`.
- `order_change_requests`: normalized change request history. Current UI may read/write the latest row while still projecting `changeRequestNote` and `changeRequestConfirmed` onto `CapturedOrder`.
- `order_checklist_items`: foundation table for request/task items even if current UI has no full checklist view yet.
- `workspace_settings`: one row per workspace with `OrderSettings` JSON.

Use UUID primary keys in DB. Preserve current sample ids only in development seed rows where useful for tests.

## Task 1: Install Supabase Dependency and Environment Client

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabaseClient.ts`
- Create: `src/lib/supabaseClient.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add the Supabase dependency**

Run:

```bash
npm install @supabase/supabase-js
```

Expected: `package.json` and lockfile include `@supabase/supabase-js`.

- [ ] **Step 2: Write the failing env/client tests**

Create `src/lib/supabaseClient.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ marker: 'client' }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('supabaseClient', () => {
  it('creates a browser client from public Vite env values', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    const { createBrowserSupabaseClient } = await import('./supabaseClient');

    expect(createBrowserSupabaseClient()).toEqual({ marker: 'client' });
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'sb_publishable_test', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  });

  it('fails clearly when Supabase public env values are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const { getSupabaseConfig } = await import('./supabaseClient');

    expect(() => getSupabaseConfig()).toThrow('Supabase public configuration is missing.');
  });
});
```

- [ ] **Step 3: Run the failing test**

Run:

```bash
npm test -- --run src/lib/supabaseClient.test.ts
```

Expected: FAIL because `src/lib/supabaseClient.ts` does not exist.

- [ ] **Step 4: Implement the client factory**

Create `src/lib/supabaseClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseConfig(): SupabasePublicConfig {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error('Supabase public configuration is missing.');
  }

  return { url, publishableKey };
}

export function createBrowserSupabaseClient() {
  const config = getSupabaseConfig();

  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
```

- [ ] **Step 5: Add env documentation**

Create or update `.env.example`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
```

- [ ] **Step 6: Run the test**

Run:

```bash
npm test -- --run src/lib/supabaseClient.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/supabaseClient.ts src/lib/supabaseClient.test.ts
git commit -m "feat: add supabase browser client"
```

## Task 2: Add Supabase Schema, RLS, and Development Seed

**Files:**
- Create: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`
- Create: `supabase/seed.dev.sql`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`:

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'staff');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  status text not null,
  raw_text text not null,
  customer_name text not null default '',
  phone text not null default '',
  order_items text not null default '',
  quantity text not null default '',
  purpose text not null default '',
  fulfillment_type text not null default '',
  desired_date_time text not null default '',
  pickup_time text not null default '',
  address text not null default '',
  allergy_note text not null default '',
  options text not null default '',
  customer_request_note text not null default '',
  owner_memo text not null default '',
  parsed_date jsonb,
  menu_matches jsonb not null default '[]'::jsonb,
  quantity_candidates jsonb not null default '[]'::jsonb,
  manually_edited_fields jsonb not null default '[]'::jsonb,
  reparse_differences jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  review_reasons jsonb not null default '[]'::jsonb,
  warning_level text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  note text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  label text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_workspace_updated_idx on public.orders (workspace_id, updated_at desc);
create index orders_workspace_desired_idx on public.orders (workspace_id, desired_date_time);
create index order_change_requests_order_idx on public.order_change_requests (order_id, updated_at desc);
create index order_checklist_items_order_idx on public.order_checklist_items (order_id, created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger workspace_settings_set_updated_at before update on public.workspace_settings
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create trigger order_change_requests_set_updated_at before update on public.order_change_requests
for each row execute function public.set_updated_at();

create trigger order_checklist_items_set_updated_at before update on public.order_checklist_items
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_change_requests enable row level security;
alter table public.order_checklist_items enable row level security;

create policy "Users can read their profile" on public.profiles
for select using (id = auth.uid());

create policy "Users can update their profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read workspaces" on public.workspaces
for select using (public.is_workspace_member(id));

create policy "Owners can update workspaces" on public.workspaces
for update using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

create policy "Members can read workspace members" on public.workspace_members
for select using (public.is_workspace_member(workspace_id));

create policy "Owners can manage workspace members" on public.workspace_members
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

create policy "Members can read workspace settings" on public.workspace_settings
for select using (public.is_workspace_member(workspace_id));

create policy "Owners can manage workspace settings" on public.workspace_settings
for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

create policy "Members can read orders" on public.orders
for select using (public.is_workspace_member(workspace_id));

create policy "Members can insert orders" on public.orders
for insert with check (public.is_workspace_member(workspace_id));

create policy "Members can update orders" on public.orders
for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "Owners can delete orders" on public.orders
for delete using (public.is_workspace_owner(workspace_id));

create policy "Members can read change requests" on public.order_change_requests
for select using (public.is_workspace_member(workspace_id));

create policy "Members can insert change requests" on public.order_change_requests
for insert with check (public.is_workspace_member(workspace_id));

create policy "Members can update change requests" on public.order_change_requests
for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "Owners can delete change requests" on public.order_change_requests
for delete using (public.is_workspace_owner(workspace_id));

create policy "Members can read checklist items" on public.order_checklist_items
for select using (public.is_workspace_member(workspace_id));

create policy "Members can insert checklist items" on public.order_checklist_items
for insert with check (public.is_workspace_member(workspace_id));

create policy "Members can update checklist items" on public.order_checklist_items
for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy "Owners can delete checklist items" on public.order_checklist_items
for delete using (public.is_workspace_owner(workspace_id));
```

- [ ] **Step 2: Create explicit development seed**

Create `supabase/seed.dev.sql`:

```sql
-- Development seed only. Replace the UUIDs with local auth.users ids after creating dev users.
-- This file must not be executed against production.

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
on conflict (workspace_id) do update set settings = excluded.settings;

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
```

- [ ] **Step 3: Validate SQL parse locally when Supabase CLI is available**

Run:

```bash
supabase db lint
```

Expected: PASS. If the Supabase CLI is not installed, record that in the final task notes and rely on SQL review plus later dashboard application.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260706000000_initial_auth_workspace_schema.sql supabase/seed.dev.sql
git commit -m "feat: add workspace supabase schema"
```

## Task 3: Add Auth Repository and Auth Gate

**Files:**
- Create: `src/auth/authTypes.ts`
- Create: `src/auth/authRepository.ts`
- Create: `src/auth/authRepository.test.ts`
- Create: `src/components/AuthGate.tsx`
- Create: `src/components/AuthGate.test.tsx`
- Modify: `src/App.css`
- Modify: `src/App.tsx`
- Delete: `src/components/AccessGate.tsx`
- Delete: `src/components/AccessGate.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write repository tests for session, login, logout, and workspace membership**

Create `src/auth/authRepository.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createAuthRepository } from './authRepository';

function createSupabaseMock(overrides: Partial<Record<string, unknown>> = {}) {
  const maybeSingle = vi.fn();
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  const from = vi.fn(() => ({ select }));
  const auth = {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  };

  return {
    supabase: { auth, from, ...overrides },
    auth,
    maybeSingle,
    from,
  };
}

describe('authRepository', () => {
  it('returns the current session', async () => {
    const { supabase, auth } = createSupabaseMock();
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1', email: 'owner@example.com' } } }, error: null });

    const repo = createAuthRepository(supabase as never);

    await expect(repo.getSession()).resolves.toEqual({ userId: 'user-1', email: 'owner@example.com' });
  });

  it('signs in with email and password', async () => {
    const { supabase, auth } = createSupabaseMock();
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'owner@example.com' } } },
      error: null,
    });

    const repo = createAuthRepository(supabase as never);

    await expect(repo.signIn('owner@example.com', 'secret-pass')).resolves.toEqual({
      userId: 'user-1',
      email: 'owner@example.com',
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'secret-pass' });
  });

  it('returns null workspace membership when the user is not configured', async () => {
    const { supabase, maybeSingle } = createSupabaseMock();
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const repo = createAuthRepository(supabase as never);

    await expect(repo.getWorkspaceMembership()).resolves.toBeNull();
  });

  it('returns workspace membership when configured', async () => {
    const { supabase, maybeSingle } = createSupabaseMock();
    maybeSingle.mockResolvedValue({
      data: {
        workspace_id: 'workspace-1',
        role: 'owner',
        workspaces: { name: 'Lyru 개발 작업실' },
      },
      error: null,
    });

    const repo = createAuthRepository(supabase as never);

    await expect(repo.getWorkspaceMembership()).resolves.toEqual({
      workspaceId: 'workspace-1',
      workspaceName: 'Lyru 개발 작업실',
      role: 'owner',
    });
  });
});
```

- [ ] **Step 2: Run the failing repository test**

Run:

```bash
npm test -- --run src/auth/authRepository.test.ts
```

Expected: FAIL because auth files do not exist.

- [ ] **Step 3: Implement auth types and repository**

Create `src/auth/authTypes.ts`:

```ts
export interface AuthSession {
  userId: string;
  email: string;
}

export type WorkspaceRole = 'owner' | 'staff';

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export interface AuthRepository {
  getSession: () => Promise<AuthSession | null>;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  getWorkspaceMembership: () => Promise<WorkspaceMembership | null>;
  onSessionChange: (callback: (session: AuthSession | null) => void) => () => void;
}
```

Create `src/auth/authRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthRepository, AuthSession, WorkspaceMembership } from './authTypes';

function toAuthSession(session: { user?: { id?: string; email?: string } } | null): AuthSession | null {
  const userId = session?.user?.id;
  const email = session?.user?.email;

  return userId && email ? { userId, email } : null;
}

export function createAuthRepository(supabase: SupabaseClient): AuthRepository {
  return {
    async getSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      return toAuthSession(data.session);
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      const session = toAuthSession(data.session);

      if (!session) {
        throw new Error('로그인 세션을 확인할 수 없습니다.');
      }

      return session;
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },

    async getWorkspaceMembership(): Promise<WorkspaceMembership | null> {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(name)')
        .eq('user_id', (await supabase.auth.getSession()).data.session?.user.id ?? '')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      const workspace = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;

      return {
        workspaceId: data.workspace_id,
        workspaceName: workspace?.name ?? '작업실',
        role: data.role,
      };
    },

    onSessionChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(toAuthSession(session));
      });

      return () => data.subscription.unsubscribe();
    },
  };
}
```

- [ ] **Step 4: Write AuthGate UI tests**

Create `src/components/AuthGate.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthRepository } from '../auth/authTypes';
import { AuthGate } from './AuthGate';

function createAuthRepo(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue({ userId: 'user-1', email: 'owner@example.com' }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getWorkspaceMembership: vi.fn().mockResolvedValue({ workspaceId: 'workspace-1', workspaceName: 'Lyru', role: 'owner' }),
    onSessionChange: vi.fn(() => () => undefined),
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('AuthGate', () => {
  it('shows email password login before a session exists', async () => {
    render(
      <AuthGate authRepository={createAuthRepo()}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    expect(await screen.findByRole('heading', { name: 'Lyru OMS 로그인' })).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
  });

  it('signs in and renders children when membership exists', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepo();

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    await user.type(await screen.findByLabelText('이메일'), 'owner@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('주문 표준화 작업실')).toBeInTheDocument();
    expect(authRepository.signIn).toHaveBeenCalledWith('owner@example.com', 'secret-pass');
  });

  it('blocks authenticated users without workspace membership', async () => {
    render(
      <AuthGate
        authRepository={createAuthRepo({
          getSession: vi.fn().mockResolvedValue({ userId: 'user-1', email: 'owner@example.com' }),
          getWorkspaceMembership: vi.fn().mockResolvedValue(null),
        })}
      >
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    expect(await screen.findByRole('heading', { name: '작업실 접근 권한이 없습니다' })).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement AuthGate**

Create `src/components/AuthGate.tsx`:

```tsx
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import type { AuthRepository, AuthSession, WorkspaceMembership } from '../auth/authTypes';

interface AuthGateProps {
  authRepository: AuthRepository;
  children: ReactNode;
}

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'blocked'; session: AuthSession }
  | { status: 'ready'; session: AuthSession; membership: WorkspaceMembership };

export function AuthGate({ authRepository, children }: AuthGateProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMembership = useMemo(
    () => async (session: AuthSession | null) => {
      if (!session) {
        setState({ status: 'signed-out' });
        return;
      }

      const membership = await authRepository.getWorkspaceMembership();
      setState(membership ? { status: 'ready', session, membership } : { status: 'blocked', session });
    },
    [authRepository],
  );

  useEffect(() => {
    let alive = true;

    authRepository
      .getSession()
      .then((session) => (alive ? loadMembership(session) : undefined))
      .catch(() => {
        if (alive) {
          setState({ status: 'signed-out' });
        }
      });

    const unsubscribe = authRepository.onSessionChange((session) => {
      void loadMembership(session);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [authRepository, loadMembership]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const session = await authRepository.signIn(email.trim(), password);
      await loadMembership(session);
    } catch {
      setError('로그인 정보를 확인해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <main className="accessGateShell">
        <section className="accessGateCard accessGateLoading" aria-label="작업실 준비">
          <p className="accessGateEyebrow">Lyru OMS</p>
          <h1>작업실 준비 중</h1>
          <p className="accessGateCopy">로그인 상태와 작업실 권한을 확인하고 있어요.</p>
        </section>
      </main>
    );
  }

  if (state.status === 'ready') {
    return <div className="appReveal">{children}</div>;
  }

  if (state.status === 'blocked') {
    return (
      <main className="accessGateShell">
        <section className="accessGateCard" aria-label="작업실 접근 권한 없음">
          <p className="accessGateEyebrow">{state.session.email}</p>
          <h1>작업실 접근 권한이 없습니다</h1>
          <p className="accessGateCopy">Supabase workspace_members에 이 계정을 먼저 연결해야 합니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="accessGateShell">
      <section className="accessGateCard" aria-label="로그인">
        <p className="accessGateEyebrow">Private workspace</p>
        <h1>Lyru OMS 로그인</h1>
        <p className="accessGateCopy">관리자 계정으로 로그인하세요.</p>
        <form className="accessGateForm" onSubmit={handleSubmit}>
          <label>
            이메일
            <input value={email} type="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            비밀번호
            <input
              value={password}
              type="password"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={submitting || email.trim() === '' || password === ''}>
            {submitting ? '로그인 중' : '로그인'}
          </button>
          <p className="accessGateError" role="status" aria-live="polite">
            {error}
          </p>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Wire AuthGate into App**

In `src/App.tsx`, replace the `AccessGate` import with:

```ts
import { useMemo } from 'react';
import { createAuthRepository } from './auth/authRepository';
import { AuthGate } from './components/AuthGate';
import { createBrowserSupabaseClient } from './lib/supabaseClient';
```

Inside `App`, create the client/repository:

```ts
const supabase = useMemo(() => createBrowserSupabaseClient(), []);
const authRepository = useMemo(() => createAuthRepository(supabase), [supabase]);
```

Wrap the existing app shell with `AuthGate`. Keep the current `<main className="appShell">` body exactly where it is and only change the outer authentication wrapper:

```tsx
<AuthGate authRepository={authRepository}>
  <main className="appShell">
    {/*
      Existing app header, workspace layout, order list, detail modal,
      and settings modal remain here.
    */}
  </main>
</AuthGate>
```

Remove `AccessGate` usage and delete `src/components/AccessGate.tsx` plus `src/components/AccessGate.test.tsx`.

- [ ] **Step 7: Update App tests for AuthGate mock**

In `src/App.test.tsx`, remove `ACCESS_GRANTED_KEY`. Mock `createBrowserSupabaseClient`, `createAuthRepository`, and later repository modules with stable authenticated defaults:

```ts
vi.mock('./lib/supabaseClient', () => ({
  createBrowserSupabaseClient: vi.fn(() => ({ marker: 'supabase' })),
}));

vi.mock('./auth/authRepository', () => ({
  createAuthRepository: vi.fn(() => ({
    getSession: vi.fn().mockResolvedValue({ userId: 'user-1', email: 'owner@example.com' }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getWorkspaceMembership: vi.fn().mockResolvedValue({ workspaceId: 'workspace-1', workspaceName: 'Lyru', role: 'owner' }),
    onSessionChange: vi.fn(() => () => undefined),
  })),
}));
```

Update `beforeEach` to only clear localStorage and set repository mocks that are introduced in Task 4.

- [ ] **Step 8: Run AuthGate tests**

Run:

```bash
npm test -- --run src/auth/authRepository.test.ts src/components/AuthGate.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/auth src/components/AuthGate.tsx src/components/AuthGate.test.tsx src/App.tsx src/App.test.tsx src/App.css
git rm src/components/AccessGate.tsx src/components/AccessGate.test.tsx
git commit -m "feat: replace passcode gate with supabase auth"
```

## Task 4: Add Order Repository and Supabase Row Mapping

**Files:**
- Create: `src/domain/orderRepository.ts`
- Create: `src/domain/orderRepository.test.ts`
- Modify: `src/domain/devSeedOrders.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Move development sample orders out of App**

Create `src/domain/devSeedOrders.ts` by moving `createNasdaqSampleOrder` and `createYuriruSampleOrder` from `src/App.tsx`:

```ts
import { EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';

export const createNasdaqSampleOrder = (): CapturedOrder => ({
  ...EMPTY_ORDER_FIELDS,
  id: '00000000-0000-4000-8000-000000000101',
  source: '네이버 스마트스토어',
  rawText:
    '성함: 나스닥3배\n연락처: 010-3333-7777\n상품: 화과자 4구 세트\n수량: 2세트\n선물 용도: 감사 선물\n수령 방식: 픽업\n희망일: 2026-07-05\n픽업 시간: 14:00\n알레르기: 없음\n추가 옵션: 보자기 포장\n요청사항: 선물용 쇼핑백 부탁드립니다.',
  customerName: '나스닥3배',
  phone: '010-3333-7777',
  orderItems: '화과자 4구 세트',
  quantity: '2세트',
  purpose: '감사 선물',
  fulfillmentType: '픽업',
  desiredDateTime: '2026-07-05',
  pickupTime: '14:00',
  allergyNote: '없음',
  options: '보자기 포장',
  customerRequestNote: '선물용 쇼핑백 부탁드립니다.',
  ownerMemo: '정석 입력 예시',
  menuMatches: [{ menuId: 'sample-wagashi-4', label: '화과자 4구 세트', unitCount: 4, confidence: 'exact' }],
  quantityCandidates: [{ value: 2, unit: '세트', rawText: '2세트' }],
  parsedDate: { isoDate: '2026-07-05', timeText: '', originalText: '2026-07-05', isRelative: false },
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: [],
  warningLevel: 'none',
  status: '신규',
  createdAt: '2026-07-03T00:05:00.000Z',
  updatedAt: '2026-07-03T00:05:00.000Z',
});

export const createYuriruSampleOrder = (): CapturedOrder => ({
  ...EMPTY_ORDER_FIELDS,
  id: '00000000-0000-4000-8000-000000000102',
  source: '인스타그램',
  rawText: '성함: 유리루\n상품: 곶감말이 4구 세트\n수량: 2세트\n희망일: 2026-07-04\n수령 방식: 픽업',
  customerName: '유리루',
  orderItems: '곶감말이 4구 세트',
  quantity: '2세트',
  fulfillmentType: '픽업',
  desiredDateTime: '2026-07-04',
  pickupTime: '15:00',
  menuMatches: [],
  quantityCandidates: [{ value: 2, unit: '세트', rawText: '2세트' }],
  parsedDate: { isoDate: '2026-07-04', timeText: '', originalText: '2026-07-04', isRelative: false },
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: [],
  warningLevel: 'none',
  status: '신규',
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
});
```

- [ ] **Step 2: Write repository mapping tests**

Create `src/domain/orderRepository.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './orderTypes';
import { createNasdaqSampleOrder } from './devSeedOrders';
import { createOrderRepository, mapOrderFromRow, mapOrderToRow } from './orderRepository';

describe('orderRepository mapping', () => {
  it('maps CapturedOrder to a Supabase orders row', () => {
    const order = createNasdaqSampleOrder();

    expect(mapOrderToRow(order, 'workspace-1')).toMatchObject({
      id: '00000000-0000-4000-8000-000000000101',
      workspace_id: 'workspace-1',
      source: '네이버 스마트스토어',
      status: '신규',
      raw_text: order.rawText,
      customer_name: '나스닥3배',
      desired_date_time: '2026-07-05',
      warning_level: 'none',
    });
  });

  it('maps Supabase row and latest change request into CapturedOrder', () => {
    const order = createNasdaqSampleOrder();
    const row = mapOrderToRow(order, 'workspace-1');

    expect(
      mapOrderFromRow(row, {
        id: 'change-1',
        note: '픽업 시간 15시로 변경',
        confirmed: false,
      }),
    ).toMatchObject({
      id: order.id,
      customerName: '나스닥3배',
      changeRequestNote: '픽업 시간 15시로 변경',
      changeRequestConfirmed: false,
    });
  });
});

describe('orderRepository', () => {
  it('loads orders and settings for a workspace', async () => {
    const order = createNasdaqSampleOrder();
    const orderRow = mapOrderToRow(order, 'workspace-1');
    const settingsRow = { settings: DEFAULT_SETTINGS };
    const from = vi.fn((table: string) => {
      if (table === 'orders') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [orderRow], error: null }) })) })) };
      }

      if (table === 'workspace_settings') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: settingsRow, error: null }) })) })) };
      }

      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })) })) };
    });

    const repo = createOrderRepository({ from } as never);

    await expect(repo.loadWorkspaceData('workspace-1')).resolves.toMatchObject({
      orders: [{ customerName: '나스닥3배' }],
      settings: DEFAULT_SETTINGS,
    });
  });
});
```

- [ ] **Step 3: Run failing repository tests**

Run:

```bash
npm test -- --run src/domain/orderRepository.test.ts
```

Expected: FAIL because repository does not exist.

- [ ] **Step 4: Implement order repository**

Create `src/domain/orderRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_SETTINGS,
  EMPTY_ORDER_FIELDS,
  type CapturedOrder,
  type OrderSettings,
  type ParsedDateValue,
} from './orderTypes';

interface OrderRow {
  id: string;
  workspace_id: string;
  source: string;
  status: string;
  raw_text: string;
  customer_name: string;
  phone: string;
  order_items: string;
  quantity: string;
  purpose: string;
  fulfillment_type: string;
  desired_date_time: string;
  pickup_time: string;
  address: string;
  allergy_note: string;
  options: string;
  customer_request_note: string;
  owner_memo: string;
  parsed_date: ParsedDateValue | null;
  menu_matches: CapturedOrder['menuMatches'];
  quantity_candidates: CapturedOrder['quantityCandidates'];
  manually_edited_fields: CapturedOrder['manuallyEditedFields'];
  reparse_differences: CapturedOrder['reparseDifferences'];
  missing_fields: CapturedOrder['missingFields'];
  review_reasons: CapturedOrder['reviewReasons'];
  warning_level: CapturedOrder['warningLevel'];
  created_at: string;
  updated_at: string;
}

interface ChangeRequestRow {
  id: string;
  note: string;
  confirmed: boolean;
}

export interface WorkspaceData {
  orders: CapturedOrder[];
  settings: OrderSettings;
}

export interface OrderRepository {
  loadWorkspaceData: (workspaceId: string) => Promise<WorkspaceData>;
  saveOrder: (workspaceId: string, order: CapturedOrder) => Promise<CapturedOrder>;
  deleteAllOrders: (workspaceId: string) => Promise<void>;
  saveSettings: (workspaceId: string, settings: OrderSettings) => Promise<OrderSettings>;
}

const cloneDefaultSettings = (): OrderSettings => ({
  requiredFields: [...DEFAULT_SETTINGS.requiredFields],
  conditionalRequiredFields: { address: { ...DEFAULT_SETTINGS.conditionalRequiredFields.address } },
  quantityRules: {
    bulkRealUnitThreshold: DEFAULT_SETTINGS.quantityRules.bulkRealUnitThreshold,
    minimumOrderRules: DEFAULT_SETTINGS.quantityRules.minimumOrderRules.map((rule) => ({ ...rule })),
  },
});

export function mapOrderToRow(order: CapturedOrder, workspaceId: string): OrderRow {
  return {
    id: order.id,
    workspace_id: workspaceId,
    source: order.source,
    status: order.status,
    raw_text: order.rawText,
    customer_name: order.customerName,
    phone: order.phone,
    order_items: order.orderItems,
    quantity: order.quantity,
    purpose: order.purpose,
    fulfillment_type: order.fulfillmentType,
    desired_date_time: order.desiredDateTime,
    pickup_time: order.pickupTime,
    address: order.address,
    allergy_note: order.allergyNote,
    options: order.options,
    customer_request_note: order.customerRequestNote,
    owner_memo: order.ownerMemo,
    parsed_date: order.parsedDate,
    menu_matches: order.menuMatches,
    quantity_candidates: order.quantityCandidates,
    manually_edited_fields: order.manuallyEditedFields,
    reparse_differences: order.reparseDifferences,
    missing_fields: order.missingFields,
    review_reasons: order.reviewReasons,
    warning_level: order.warningLevel,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

export function mapOrderFromRow(row: OrderRow, latestChangeRequest?: ChangeRequestRow | null): CapturedOrder {
  return {
    ...EMPTY_ORDER_FIELDS,
    id: row.id,
    source: row.source as CapturedOrder['source'],
    status: row.status as CapturedOrder['status'],
    rawText: row.raw_text,
    customerName: row.customer_name,
    phone: row.phone,
    orderItems: row.order_items,
    quantity: row.quantity,
    purpose: row.purpose,
    fulfillmentType: row.fulfillment_type as CapturedOrder['fulfillmentType'],
    desiredDateTime: row.desired_date_time,
    pickupTime: row.pickup_time,
    address: row.address,
    allergyNote: row.allergy_note,
    options: row.options,
    customerRequestNote: row.customer_request_note,
    ownerMemo: row.owner_memo,
    changeRequestNote: latestChangeRequest?.note ?? '',
    changeRequestConfirmed: latestChangeRequest?.confirmed ?? false,
    parsedDate: row.parsed_date,
    menuMatches: row.menu_matches ?? [],
    quantityCandidates: row.quantity_candidates ?? [],
    manuallyEditedFields: row.manually_edited_fields ?? [],
    reparseDifferences: row.reparse_differences ?? [],
    missingFields: row.missing_fields ?? [],
    reviewReasons: row.review_reasons ?? [],
    warningLevel: row.warning_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrderRepository(supabase: SupabaseClient): OrderRepository {
  return {
    async loadWorkspaceData(workspaceId) {
      const [ordersResult, settingsResult, changeRequestsResult] = await Promise.all([
        supabase.from('orders').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
        supabase.from('workspace_settings').select('settings').eq('workspace_id', workspaceId).maybeSingle(),
        supabase.from('order_change_requests').select('id, order_id, note, confirmed').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (changeRequestsResult.error) throw changeRequestsResult.error;

      const latestChangeByOrder = new Map<string, ChangeRequestRow>();
      for (const request of changeRequestsResult.data ?? []) {
        if (!latestChangeByOrder.has(request.order_id)) {
          latestChangeByOrder.set(request.order_id, request);
        }
      }

      return {
        orders: (ordersResult.data ?? []).map((row) => mapOrderFromRow(row, latestChangeByOrder.get(row.id))),
        settings: settingsResult.data?.settings ?? cloneDefaultSettings(),
      };
    },

    async saveOrder(workspaceId, order) {
      const row = mapOrderToRow(order, workspaceId);
      const { data, error } = await supabase.from('orders').upsert(row).select('*').single();

      if (error) throw error;

      if (order.changeRequestNote.trim()) {
        await supabase.from('order_change_requests').upsert({
          workspace_id: workspaceId,
          order_id: order.id,
          note: order.changeRequestNote,
          confirmed: order.changeRequestConfirmed,
        });
      }

      return mapOrderFromRow(data, {
        id: 'latest',
        note: order.changeRequestNote,
        confirmed: order.changeRequestConfirmed,
      });
    },

    async deleteAllOrders(workspaceId) {
      const { error } = await supabase.from('orders').delete().eq('workspace_id', workspaceId);

      if (error) throw error;
    },

    async saveSettings(workspaceId, settings) {
      const { error } = await supabase.from('workspace_settings').upsert({ workspace_id: workspaceId, settings });

      if (error) throw error;

      return settings;
    },
  };
}
```

- [ ] **Step 5: Run repository tests**

Run:

```bash
npm test -- --run src/domain/orderRepository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/devSeedOrders.ts src/domain/orderRepository.ts src/domain/orderRepository.test.ts
git commit -m "feat: add supabase order repository"
```

## Task 5: Convert App Data Flow to Async Supabase Repository

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`
- Modify: `src/domain/storage.ts`
- Modify or delete: `src/domain/storage.test.ts`

- [ ] **Step 1: Write App tests for empty DB, loading, save, settings, and failed save draft**

Update `src/App.test.tsx` with repository mocks:

```ts
const loadWorkspaceData = vi.fn();
const saveOrder = vi.fn();
const deleteAllOrders = vi.fn();
const saveSettings = vi.fn();

vi.mock('./domain/orderRepository', () => ({
  createOrderRepository: vi.fn(() => ({ loadWorkspaceData, saveOrder, deleteAllOrders, saveSettings })),
}));
```

Update `beforeEach`:

```ts
beforeEach(() => {
  localStorage.clear();
  loadWorkspaceData.mockResolvedValue({ orders: [], settings: DEFAULT_SETTINGS });
  saveOrder.mockImplementation((_workspaceId, order) => Promise.resolve(order));
  deleteAllOrders.mockResolvedValue(undefined);
  saveSettings.mockImplementation((_workspaceId, settings) => Promise.resolve(settings));
});
```

Replace the sample-order expectation test with:

```ts
it('starts an empty authenticated workspace without local sample orders', async () => {
  await renderUnlockedApp();

  expect(screen.getByText('아직 저장된 주문이 없습니다.')).toBeInTheDocument();
  expect(screen.queryByText(/유리루/)).not.toBeInTheDocument();
  expect(screen.queryByText(/나스닥3배/)).not.toBeInTheDocument();
});
```

Add a save failure test:

```ts
it('keeps a local draft when saving an order fails', async () => {
  const user = userEvent.setup();
  saveOrder.mockRejectedValueOnce(new Error('network failed'));

  await renderUnlockedApp();

  await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 임시고객\n곶감 1세트\n2026-07-06\n픽업');
  await user.click(screen.getByRole('button', { name: '저장' }));

  expect(await screen.findByText('저장하지 못했습니다. 입력 내용은 임시 저장했어요.')).toBeInTheDocument();
  expect(localStorage.getItem('lyru-oms.orderDraft.v1')).toContain('임시고객');
});
```

- [ ] **Step 2: Run failing App tests**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: FAIL because `App` still loads local sample orders and synchronous storage.

- [ ] **Step 3: Refactor App state**

In `src/App.tsx`, replace synchronous initialization:

```ts
const [orders, setOrders] = useState<CapturedOrder[]>([]);
const [settings, setSettings] = useState<OrderSettings>(() => cloneDefaultSettings());
const [workspaceId, setWorkspaceId] = useState<string | null>(null);
const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
const [saveError, setSaveError] = useState('');
```

Pass an `onReady` callback from `AuthGate` or expose membership through render props. Use this API:

```tsx
<AuthGate authRepository={authRepository}>
  {(membership) => <WorkspaceApp membership={membership} orderRepository={orderRepository} />}
</AuthGate>
```

Adjust `AuthGateProps`:

```ts
children: ReactNode | ((membership: WorkspaceMembership) => ReactNode);
```

Render ready children:

```tsx
return <div className="appReveal">{typeof children === 'function' ? children(state.membership) : children}</div>;
```

Create `WorkspaceApp` inside `src/App.tsx` or a new `src/WorkspaceApp.tsx` if `App.tsx` becomes hard to read. Its first effect loads DB data:

```ts
useEffect(() => {
  let alive = true;
  setLoadState('loading');

  orderRepository
    .loadWorkspaceData(membership.workspaceId)
    .then((data) => {
      if (!alive) return;
      setOrders(data.orders);
      setSettings(data.settings);
      setLoadState('ready');
    })
    .catch(() => {
      if (!alive) return;
      setLoadState('error');
    });

  return () => {
    alive = false;
  };
}, [membership.workspaceId, orderRepository]);
```

Update handlers to await repository calls before committing local state:

```ts
async function handleSaveOrder(order: CapturedOrder) {
  setSaveError('');

  try {
    const savedOrder = await orderRepository.saveOrder(membership.workspaceId, order);
    setOrders((current) => [savedOrder, ...current.filter((item) => item.id !== savedOrder.id)]);
    setSourceFilter(savedOrder.source);
    setSelectedId(savedOrder.id);
  } catch {
    saveOrderDraft(order);
    setSaveError('저장하지 못했습니다. 입력 내용은 임시 저장했어요.');
  }
}
```

Update `handleChangeOrder`, `handleClearOrders`, and `handleSaveSettings` with the same pattern:

```ts
async function handleChangeOrder(nextOrder: CapturedOrder) {
  setSaveError('');
  try {
    const savedOrder = await orderRepository.saveOrder(membership.workspaceId, nextOrder);
    setOrders((current) => current.map((order) => (order.id === savedOrder.id ? savedOrder : order)));
  } catch {
    saveOrderDraft(nextOrder);
    setSaveError('변경 내용을 저장하지 못했습니다. 임시 저장했어요.');
  }
}

async function handleClearOrders() {
  if (!window.confirm('저장된 주문을 모두 삭제할까요?')) return;
  await orderRepository.deleteAllOrders(membership.workspaceId);
  setOrders([]);
  setSelectedId(null);
  setSourceFilter('전체');
}

async function handleSaveSettings(nextSettings: OrderSettings) {
  const savedSettings = await orderRepository.saveSettings(membership.workspaceId, nextSettings);
  setSettings(savedSettings);
  setOrders((current) => current.map((order) => evaluateOrder(order, savedSettings)));
}
```

- [ ] **Step 4: Remove saved operational localStorage calls**

Remove `loadOrders`, `saveOrders`, `loadSettings`, and `saveSettings` imports from `src/App.tsx`.

Keep localStorage only for:

- `CAPTURE_PANEL_COLLAPSED_KEY`
- Order list view/calendar preferences in `OrderList.tsx`
- Draft/cache helpers from Task 6

If `src/domain/storage.ts` no longer has app consumers, rename retained hydration helpers into `src/domain/orderHydration.ts` or delete `storage.ts` and `storage.test.ts`.

- [ ] **Step 5: Add loading/error UI**

In `WorkspaceApp`, render:

```tsx
if (loadState === 'loading') {
  return <main className="appShell"><p role="status">주문 데이터를 불러오고 있어요.</p></main>;
}

if (loadState === 'error') {
  return <main className="appShell"><p role="alert">주문 데이터를 불러오지 못했습니다.</p></main>;
}
```

Render save error near the capture/list area:

```tsx
{saveError ? <p className="inlineError" role="status">{saveError}</p> : null}
```

- [ ] **Step 6: Run App tests**

Run:

```bash
npm test -- --run src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run full tests**

Run:

```bash
npm test -- --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/App.css src/domain/storage.ts src/domain/storage.test.ts
git commit -m "feat: load workspace data from supabase"
```

## Task 6: Add Local Draft and Recent-Order Cache

**Files:**
- Create: `src/domain/localDraftCache.ts`
- Create: `src/domain/localDraftCache.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write local draft/cache tests**

Create `src/domain/localDraftCache.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNasdaqSampleOrder, createYuriruSampleOrder } from './devSeedOrders';
import {
  clearLocalOrderData,
  loadRecentOrderCache,
  loadSavedOrderDraft,
  saveOrderDraft,
  saveRecentOrderCache,
} from './localDraftCache';

beforeEach(() => {
  localStorage.clear();
  vi.setSystemTime(new Date('2026-07-06T09:00:00.000Z'));
});

describe('localDraftCache', () => {
  it('saves and loads an order draft', () => {
    const order = createNasdaqSampleOrder();

    saveOrderDraft(order);

    expect(loadSavedOrderDraft()?.customerName).toBe('나스닥3배');
  });

  it('keeps desired-date range orders and recent updated orders in cache', () => {
    const inRange = createNasdaqSampleOrder();
    const undatedRecent = { ...createYuriruSampleOrder(), id: 'recent-undated', desiredDateTime: '', updatedAt: '2026-07-06T08:00:00.000Z' };
    const tooOld = { ...createYuriruSampleOrder(), id: 'old-order', desiredDateTime: '2026-01-01', updatedAt: '2026-01-01T00:00:00.000Z' };

    saveRecentOrderCache([inRange, undatedRecent, tooOld], new Date('2026-07-06T09:00:00.000Z'));

    expect(loadRecentOrderCache(new Date('2026-07-06T09:00:00.000Z')).map((order) => order.id)).toEqual([
      'recent-undated',
      inRange.id,
    ]);
  });

  it('expires cache after 24 hours', () => {
    saveRecentOrderCache([createNasdaqSampleOrder()], new Date('2026-07-06T09:00:00.000Z'));

    expect(loadRecentOrderCache(new Date('2026-07-07T09:00:01.000Z'))).toEqual([]);
  });

  it('clears drafts and cached order data on logout', () => {
    saveOrderDraft(createNasdaqSampleOrder());
    saveRecentOrderCache([createNasdaqSampleOrder()], new Date('2026-07-06T09:00:00.000Z'));

    clearLocalOrderData();

    expect(loadSavedOrderDraft()).toBeNull();
    expect(loadRecentOrderCache(new Date('2026-07-06T09:00:00.000Z'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run failing local cache tests**

Run:

```bash
npm test -- --run src/domain/localDraftCache.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement draft/cache helper**

Create `src/domain/localDraftCache.ts`:

```ts
import { parseExplicitDate } from './dateDisplay';
import type { CapturedOrder } from './orderTypes';

const ORDER_DRAFT_KEY = 'lyru-oms.orderDraft.v1';
const RECENT_ORDER_CACHE_KEY = 'lyru-oms.recentOrderCache.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachePayload {
  cachedAt: string;
  orders: CapturedOrder[];
}

const safeParse = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export function saveOrderDraft(order: CapturedOrder) {
  localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(order));
}

export function loadSavedOrderDraft(): CapturedOrder | null {
  const parsed = safeParse(localStorage.getItem(ORDER_DRAFT_KEY));

  return parsed && typeof parsed === 'object' && 'id' in parsed ? (parsed as CapturedOrder) : null;
}

function isDesiredDateInCacheWindow(order: CapturedOrder, now: Date) {
  const parsed = order.parsedDate ?? parseExplicitDate(order.desiredDateTime);
  if (!parsed?.isoDate) return false;

  const desired = new Date(`${parsed.isoDate}T00:00:00.000Z`).getTime();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 45, 23, 59, 59, 999);

  return desired >= start && desired <= end;
}

export function selectRecentOrdersForCache(orders: CapturedOrder[], now = new Date()) {
  const byId = new Map<string, CapturedOrder>();

  for (const order of orders.filter((item) => isDesiredDateInCacheWindow(item, now))) {
    byId.set(order.id, order);
  }

  const recent = [...orders]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  for (const order of recent) {
    byId.set(order.id, order);
  }

  return [...byId.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function saveRecentOrderCache(orders: CapturedOrder[], now = new Date()) {
  const payload: CachePayload = {
    cachedAt: now.toISOString(),
    orders: selectRecentOrdersForCache(orders, now),
  };

  localStorage.setItem(RECENT_ORDER_CACHE_KEY, JSON.stringify(payload));
}

export function loadRecentOrderCache(now = new Date()): CapturedOrder[] {
  const parsed = safeParse(localStorage.getItem(RECENT_ORDER_CACHE_KEY));

  if (!parsed || typeof parsed !== 'object' || !('cachedAt' in parsed) || !('orders' in parsed)) {
    return [];
  }

  const payload = parsed as CachePayload;
  if (now.getTime() - new Date(payload.cachedAt).getTime() > CACHE_TTL_MS) {
    return [];
  }

  return Array.isArray(payload.orders) ? payload.orders : [];
}

export function clearLocalOrderData() {
  localStorage.removeItem(ORDER_DRAFT_KEY);
  localStorage.removeItem(RECENT_ORDER_CACHE_KEY);
}
```

- [ ] **Step 4: Wire cache into App**

In `src/App.tsx`:

```ts
import { clearLocalOrderData, loadRecentOrderCache, saveOrderDraft, saveRecentOrderCache } from './domain/localDraftCache';
```

When workspace load succeeds:

```ts
setOrders(data.orders);
saveRecentOrderCache(data.orders);
```

When workspace load fails and `navigator.onLine === false`:

```ts
const cachedOrders = loadRecentOrderCache();
if (cachedOrders.length > 0) {
  setOrders(cachedOrders);
  setLoadState('ready');
  setSaveError('오프라인 상태입니다. 최근 주문을 읽기 전용으로 보여드려요.');
  return;
}
```

When logout is added to the header:

```tsx
<button
  type="button"
  className="secondaryButton"
  onClick={async () => {
    clearLocalOrderData();
    await authRepository.signOut();
  }}
>
  로그아웃
</button>
```

Disable saved-order edits when showing offline cache by checking an `offlineReadOnly` state:

```ts
if (offlineReadOnly) {
  setSaveError('오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.');
  return;
}
```

- [ ] **Step 5: Run cache and App tests**

Run:

```bash
npm test -- --run src/domain/localDraftCache.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/localDraftCache.ts src/domain/localDraftCache.test.ts src/App.tsx src/App.test.tsx
git commit -m "feat: add local draft and recent order cache"
```

## Task 7: Documentation and Local Setup Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-06-supabase-pwa-roadmap-design.md`

- [ ] **Step 1: Add setup notes**

Add this section to `README.md`:

````md
## Supabase Setup

Lyru OMS uses GitHub Pages for the static frontend and Supabase for Auth, Postgres, and RLS-protected operational data.

Required public frontend env:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
```

Do not commit Supabase service role keys, secret keys, database passwords, or any credential that bypasses RLS.

Local development flow:

1. Create a Supabase project.
2. Apply `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`.
3. Create a development auth user in Supabase.
4. Insert that user into `workspace_members` for the development workspace.
5. Run `supabase/seed.dev.sql` only against development.
6. Start the app with `npm run dev`.
````

- [ ] **Step 2: Mark PWA as follow-up**

Append to the spec:

```md
## Implementation Split

The first implementation branch covers Supabase Auth, database persistence, RLS schema, development seed data, drafts, and recent-order cache. PWA installability and service-worker behavior remain a separate follow-up plan after this foundation is verified.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-06-supabase-pwa-roadmap-design.md
git commit -m "docs: add supabase setup notes"
```

## Task 8: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test -- --run
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Verify no secret keys are committed**

Run:

```bash
git grep -n "service_role\|sb_secret\|SUPABASE_SERVICE\|DATABASE_URL\|postgres://" -- .
```

Expected: no matches containing real credentials. Matches in documentation warnings are acceptable if they do not include values.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
```

Expected: only Supabase/Auth/database/cache/docs files are changed.

- [ ] **Step 5: Resolve verification failures before handoff**

If tests, build, or the secret scan fail, return to the task that introduced the failing file, make the smallest correction, rerun the failing command, and commit the corrected files with that task's commit message pattern. If every command passed, do not create an extra commit.

## Manual Verification Checklist

- [ ] Login screen appears when no Supabase session exists.
- [ ] Invalid credentials show `로그인 정보를 확인해 주세요.`
- [ ] Authenticated user without `workspace_members` row sees `작업실 접근 권한이 없습니다`.
- [ ] Authenticated workspace member sees the order workspace.
- [ ] Empty production workspace shows `아직 저장된 주문이 없습니다.`
- [ ] Creating an order writes to Supabase and appears in the list.
- [ ] Updating order detail writes to Supabase and stays visible after refresh.
- [ ] Settings changes write to `workspace_settings`.
- [ ] Owner can clear all orders.
- [ ] Staff cannot delete all orders if RLS rejects delete; UI shows a failure message.
- [ ] Failed save leaves a local draft and visible Korean status message.
- [ ] Logout clears recent cached orders and drafts.

## Follow-Up Plan

After this plan is implemented and merged, write a separate PWA implementation plan covering:

- Web manifest.
- App icons.
- Service worker/static caching.
- Offline shell.
- Network status banner.
- Offline draft creation and reconnect retry.
- Mobile installability verification.
