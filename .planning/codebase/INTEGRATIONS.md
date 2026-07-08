# External Integrations

**Analysis Date:** 2026-07-08

## APIs & External Services

**Supabase Backend-as-a-Service:**
- Supabase Auth - email/password sign-in, session persistence, password updates, sign-out, and auth state subscription.
  - SDK/Client: `@supabase/supabase-js` via `src/lib/supabaseClient.ts` and `src/auth/authRepository.ts`
  - Auth: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Supabase Postgres REST client - workspace order data, settings, members, and change requests.
  - SDK/Client: `@supabase/supabase-js` via `src/domain/orderRepository.ts` and `src/auth/authRepository.ts`
  - Auth: browser Supabase session from `src/lib/supabaseClient.ts`
- Supabase RPC - owner-only workspace member administration.
  - SDK/Client: `supabase.rpc(...)` in `src/auth/authRepository.ts`
  - RPC functions: `public.list_workspace_members` and `public.upsert_workspace_member_by_email` in `supabase/migrations/20260707000000_workspace_admin_rpc.sql`

**GitHub Pages:**
- GitHub Pages hosts the static Vite build.
  - Workflow: `.github/workflows/deploy-pages.yml`
  - Build artifact: `dist`
  - Base path: `/lyru-oms/` in `vite.config.ts`

**GitHub Actions:**
- `Deploy GitHub Pages` workflow installs with `npm ci`, runs `npm run build`, uploads `dist`, and deploys to Pages.
  - Workflow: `.github/workflows/deploy-pages.yml`
  - Auth: GitHub OIDC Pages deployment permissions (`pages: write`, `id-token: write`)

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: `VITE_SUPABASE_URL`
  - Client: `@supabase/supabase-js`
  - Schema: `public.profiles`, `public.workspaces`, `public.workspace_members`, `public.workspace_settings`, `public.orders`, `public.order_change_requests`, and `public.order_checklist_items` in `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`
  - Row-level security: enabled on all app tables in `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`
  - Workspace authorization helpers: `public.is_workspace_member` and `public.is_workspace_owner` in `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`

**File Storage:**
- Not detected. No Supabase Storage, S3, local upload persistence, or file storage SDK usage detected in `src`, `supabase`, or package manifests.

**Browser Local Storage:**
- `src/domain/localDraftCache.ts` stores unsaved order drafts and recent read-only order cache under `lyru-oms.orderDraft.v1` and `lyru-oms.recentOrderCache.v1`.
- `src/App.tsx` stores capture panel collapsed state under `lyru-oms.capturePanel.collapsed.v1`.
- `src/domain/storage.ts` contains legacy/local order and settings storage under `lyru-oms.orders.v1` and `lyru-oms.settings.v1`.

**Caching:**
- Browser `localStorage` recent order cache for offline read-only fallback in `src/domain/localDraftCache.ts` and `src/App.tsx`.
- Recent order cache keeps matching shipping-window orders and the 30 most recently updated orders for 24 hours in `src/domain/localDraftCache.ts`.
- No server-side cache, Redis, CDN cache config, or service worker cache detected.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: `createBrowserSupabaseClient()` creates a browser client with `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: true` in `src/lib/supabaseClient.ts`.
  - Login/session handling: `createAuthRepository()` wraps `supabase.auth.getSession`, `signInWithPassword`, `signOut`, `updateUser`, and `onAuthStateChange` in `src/auth/authRepository.ts`.
  - UI gate: `src/components/AuthGate.tsx` requires both an Auth session and a `workspace_members` row before rendering `src/App.tsx`.
  - Workspace roles: `owner` and `staff` enum/type in `src/auth/authTypes.ts` and `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`.
  - Initial account/workspace wiring: `supabase/bootstrap.owner.sql` and `supabase/grant.initial-admins.sql`.

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, LogRocket, Datadog, OpenTelemetry, or equivalent dependency/config was detected in `package.json`, `src`, or config files.

**Logs:**
- No structured logging framework detected.
- User-facing failure states are handled with UI messages in `src/App.tsx`, `src/components/AuthGate.tsx`, `src/components/AccountModal.tsx`, and `src/components/SettingsModal.tsx`.
- `debug.log`, `vite-5175.err.log`, `vite-5175.out.log`, `vite-5176.err.log`, and `vite-5176.out.log` exist at repo root as local log artifacts.

## CI/CD & Deployment

**Hosting:**
- GitHub Pages
  - Workflow: `.github/workflows/deploy-pages.yml`
  - Public app URL documented in `README.md`
  - Vite base path configured in `vite.config.ts`

**CI Pipeline:**
- GitHub Actions deployment workflow exists in `.github/workflows/deploy-pages.yml`.
- The deployment workflow builds the app but does not run `npm test`.
- No separate pull-request CI, lint workflow, or scheduled workflow detected.

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project URL consumed by `src/lib/supabaseClient.ts` and injected in `.github/workflows/deploy-pages.yml`.
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase browser publishable key consumed by `src/lib/supabaseClient.ts` and injected in `.github/workflows/deploy-pages.yml`.

**Secrets location:**
- Local development: `.env` exists and was not read; `README.md` instructs use of `.env.local` for public Supabase config.
- Production build: GitHub Actions Repository Variables provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.github/workflows/deploy-pages.yml`.
- Supabase service-role keys, secret keys, database passwords, and RLS-bypassing credentials are explicitly excluded from browser bundles by `README.md`.

## Webhooks & Callbacks

**Incoming:**
- None detected. This is a static Vite SPA with no server route handlers or webhook endpoints in `src`, `.github`, or `supabase`.

**Outgoing:**
- Supabase Auth HTTPS calls through `@supabase/supabase-js` from `src/auth/authRepository.ts`.
- Supabase Postgres table operations on `workspace_members`, `orders`, `workspace_settings`, and `order_change_requests` from `src/auth/authRepository.ts` and `src/domain/orderRepository.ts`.
- Supabase RPC calls to `list_workspace_members` and `upsert_workspace_member_by_email` from `src/auth/authRepository.ts`.
- No third-party business API integrations for Naver Smart Store, Naver TalkTalk, KakaoTalk Channel, Instagram, payment processors, email, SMS, or shipping carriers detected.

---

*Integration audit: 2026-07-08*
