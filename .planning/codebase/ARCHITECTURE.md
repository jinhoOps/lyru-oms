<!-- refreshed: 2026-07-08 -->
# Architecture

**Analysis Date:** 2026-07-08

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Vite React Browser App                   │
│                    `src/main.tsx`                           │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Auth + Workspace Boundary                  │
│ `src/components/AuthGate.tsx` + `src/auth/authRepository.ts` │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Workspace Orchestrator                   │
│                       `src/App.tsx`                         │
├──────────────────┬──────────────────┬───────────────────────┤
│   Capture Form   │    Order List    │     Order Detail      │
│ `OrderCapture...`│  `OrderList.tsx` │   `OrderDetail.tsx`   │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Domain Functions                       │
│ `src/domain/parser.ts`, `reviewRules.ts`, `orderSorting.ts` │
│ `dateDisplay.ts`, `menuCatalog.ts`, `orderQuantity.ts`      │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Repository + Local Recovery                 │
│ `src/domain/orderRepository.ts`, `localDraftCache.ts`        │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Supabase Auth, Postgres, RLS, RPC               │
│ `src/lib/supabaseClient.ts`, `supabase/migrations/*.sql`    │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| React entry | Mounts the app under React `StrictMode` and imports global CSS. | `src/main.tsx` |
| App shell | Creates Supabase, auth repository, and order repository; wraps the workspace in auth. | `src/App.tsx` |
| WorkspaceApp | Loads workspace data, owns order/settings UI state, coordinates saves, handles offline-cache status. | `src/App.tsx` |
| AuthGate | Resolves session and workspace membership before rendering workspace UI. | `src/components/AuthGate.tsx` |
| Auth repository | Adapts Supabase Auth, membership queries, and workspace member RPCs. | `src/auth/authRepository.ts` |
| Order repository | Maps `CapturedOrder` and settings to Supabase rows and back. | `src/domain/orderRepository.ts` |
| Order capture | Converts pasted raw text into a `CapturedOrder` using parser and review rules. | `src/components/OrderCaptureForm.tsx` |
| Order list | Renders card/list/calendar views, source filter, sort controls, and production quantity labels. | `src/components/OrderList.tsx` |
| Order detail | Edits structured order fields, status, desired date/time, raw text copy, and change request confirmation. | `src/components/OrderDetail.tsx` |
| Settings modal | Edits required fields and quantity review rules. | `src/components/SettingsModal.tsx` |
| Account modal | Lists and updates workspace members for owners. | `src/components/AccountModal.tsx` |
| Domain model | Defines order sources, statuses, fields, review reasons, settings, and defaults. | `src/domain/orderTypes.ts` |
| Parser | Extracts labeled fields, dates, menus, quantities, fulfillment type, purpose, and duplicate raw text signals. | `src/domain/parser.ts` |
| Review rules | Computes missing fields, attention reasons, warning level, and automatic `확인 필요` status. | `src/domain/reviewRules.ts` |
| Local draft/cache | Stores failed-save drafts and recent read-only workspace cache in `localStorage`. | `src/domain/localDraftCache.ts` |
| Supabase schema | Defines workspace, membership, order, change request, checklist, RLS, trigger, and RPC database contracts. | `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`, `supabase/migrations/20260707000000_workspace_admin_rpc.sql` |

## Pattern Overview

**Overall:** Client-side React application with repository adapters and pure domain services.

**Key Characteristics:**
- `src/App.tsx` is the orchestration layer. It owns workspace-scoped state and passes data and callbacks down to components.
- `src/components/*` are UI components. Components may call pure domain functions, but persistence is routed through callbacks or repository props.
- `src/domain/*` contains the shared domain contract and pure business rules. `src/domain/orderRepository.ts` is the persistence adapter exception inside the domain directory.
- Supabase is the durable source for orders and settings. `src/domain/localDraftCache.ts` only supports draft recovery and offline read-only cache.
- Workspace membership is the authorization boundary for UI access and database row-level security.

## Layers

**Bootstrap Layer:**
- Purpose: Start the browser app and attach React to `#root`.
- Location: `src/main.tsx`, `index.html`
- Contains: React root creation, `App` import, global CSS import.
- Depends on: `react`, `react-dom/client`, `src/App.tsx`, `src/App.css`.
- Used by: Vite build and dev server.

**Authentication Layer:**
- Purpose: Ensure a signed-in user has workspace membership before loading OMS data.
- Location: `src/components/AuthGate.tsx`, `src/auth/authRepository.ts`, `src/auth/authTypes.ts`
- Contains: Login form, session lifecycle, sign-out flow, workspace membership lookup, member management RPC adapter.
- Depends on: Supabase Auth and `workspace_members` data.
- Used by: `src/App.tsx`.

**Application Orchestration Layer:**
- Purpose: Coordinate workspace loading, selection, filtering, saving, optimistic updates, settings changes, and modal visibility.
- Location: `src/App.tsx`
- Contains: `WorkspaceApp`, save queues, stale-workspace guards, offline-cache fallback, main layout.
- Depends on: `src/components/*`, `src/domain/orderRepository.ts`, `src/domain/reviewRules.ts`, `src/domain/orderSorting.ts`, `src/domain/localDraftCache.ts`.
- Used by: `src/main.tsx`.

**Presentation Layer:**
- Purpose: Render and edit the operational workflows.
- Location: `src/components`
- Contains: Order capture, list, detail, settings, account, auth, confirmation, date picker, notes, reparse hint UI.
- Depends on: React, component props, selected domain helpers.
- Used by: `src/App.tsx` and component tests.

**Domain Layer:**
- Purpose: Hold order data shape, parsing, review rules, sorting, date display, menu matching, and quantity calculations.
- Location: `src/domain`
- Contains: `CapturedOrder`, settings defaults, parser, review rule evaluation, sort helpers, local persistence utilities, repository adapter.
- Depends on: TypeScript, `es-toolkit` in `reviewRules.ts`, Supabase-like port in `orderRepository.ts`.
- Used by: `src/App.tsx`, `src/components/*`, and tests.

**Infrastructure Layer:**
- Purpose: Configure Supabase client and database schema.
- Location: `src/lib/supabaseClient.ts`, `supabase`
- Contains: public Supabase env config, client creation, SQL migrations, seed/bootstrap SQL.
- Depends on: `@supabase/supabase-js`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Used by: `src/App.tsx`, repositories, Supabase deployment process.

## Data Flow

### Primary Order Capture Path

1. The app mounts `App` from `src/main.tsx:6`.
2. `App` creates Supabase and repositories, then renders `AuthGate` in `src/App.tsx:578`.
3. `AuthGate` loads the session and workspace membership before rendering children in `src/components/AuthGate.tsx:99`.
4. `WorkspaceApp` loads orders, settings, and change requests through `orderRepository.loadWorkspaceData` in `src/App.tsx:145`.
5. The capture panel renders `OrderCaptureForm` with existing raw texts, settings, source, and `handleSaveOrder` in `src/App.tsx:522`.
6. `OrderCaptureForm` parses pasted text with `parseRawText`, checks duplicates with `hasSimilarRawText`, builds a `CapturedOrder`, and runs `evaluateOrder` in `src/components/OrderCaptureForm.tsx:52` and `src/components/OrderCaptureForm.tsx:55`.
7. `WorkspaceApp.handleSaveOrder` persists the evaluated order through `orderRepository.saveOrder` and inserts the saved row into state in `src/App.tsx:219`.
8. `createOrderRepository.saveOrder` upserts `orders`, then upserts or deletes the latest `order_change_requests` row in `src/domain/orderRepository.ts:240`.
9. The selected order appears in `OrderList` and `OrderDetail` through props in `src/App.tsx:533` and `src/App.tsx:545`.

### Order Edit And Re-Evaluation Path

1. `OrderDetail` receives the selected `CapturedOrder` and `settings` in `src/components/OrderDetail.tsx:62`.
2. Field edits mark the edited field in `manuallyEditedFields` and call `publish` in `src/components/OrderDetail.tsx:77`.
3. `publish` updates `updatedAt` and runs `evaluateOrder` before calling `onChange` in `src/components/OrderDetail.tsx:77`.
4. `WorkspaceApp.handleChangeOrder` optimistically updates state, then serializes saves per order id with `enqueueOrderSave` in `src/App.tsx:299`.
5. A stale workspace generation or older save sequence is ignored by guards in `src/App.tsx:94` and `src/App.tsx:104`.
6. Failed saves restore the previous order and show a persistence message in `src/App.tsx:325`.

### Settings Path

1. Owners open `SettingsModal` from the workspace menu in `src/App.tsx:388`.
2. `WorkspaceApp.handleSaveSettings` saves settings through `orderRepository.saveSettings` in `src/App.tsx:339`.
3. Saved settings are cloned back from Supabase and all current orders are re-evaluated in `src/App.tsx:355`.
4. `reviewRules.evaluateOrder` keeps manually advanced `제작 준비` and `발송 완료` statuses while recomputing missing fields and reasons in `src/domain/reviewRules.ts:191`.

### Offline Recovery Path

1. If workspace load fails, `WorkspaceApp` attempts `loadRecentOrderCacheSnapshot` in `src/App.tsx:172`.
2. A valid cache switches the app to `offline-cache` and uses default settings in `src/App.tsx:177`.
3. Mutations are blocked by `blockOfflineCacheMutation` in `src/App.tsx:136`.
4. When online and ready, recent orders are saved to cache after a debounce in `src/App.tsx:197`.
5. Failed new-order saves store a draft with `saveOrderDraft` in `src/App.tsx:241`; sign-out clears draft and recent cache through `clearLocalOrderData` in `src/App.tsx:584`.

**State Management:**
- React local state is used throughout; there is no external client state store.
- Workspace-level state lives in `WorkspaceApp`: `orders`, `settings`, `loadStatus`, selection, sort/filter values, modal flags, and save status messages.
- Component-local UI state lives inside each component, such as `AuthGate` auth status, `OrderCaptureForm` raw text and saving flag, and `OrderDetail` change request panel state.
- Persistence state is split between Supabase durable rows and `localStorage` recovery/cache keys in `src/domain/localDraftCache.ts`.

## Key Abstractions

**CapturedOrder:**
- Purpose: Canonical client-side order record used by UI, parser, review rules, sorting, and repository mapping.
- Examples: `src/domain/orderTypes.ts`, `src/domain/orderRepository.ts`, `src/components/OrderDetail.tsx`
- Pattern: Single rich data object with raw text, structured fields, parser metadata, review metadata, status, and timestamps.

**OrderSettings:**
- Purpose: Runtime rules for required fields, conditional required fields, and quantity thresholds.
- Examples: `src/domain/orderTypes.ts`, `src/components/SettingsModal.tsx`, `src/domain/reviewRules.ts`
- Pattern: Settings object is loaded per workspace and passed to evaluators/components; updates trigger order re-evaluation.

**ReviewReason:**
- Purpose: Explains why an order needs information or attention.
- Examples: `src/domain/orderTypes.ts`, `src/domain/reviewRules.ts`, `src/components/OrderDetail.tsx`
- Pattern: Reason objects carry `group`, `code`, `field`, `label`, `message`, and optional `detail`.

**OrderRepository:**
- Purpose: Persistence port for workspace data, order saves, order deletion, and settings saves.
- Examples: `src/domain/orderRepository.ts`, `src/App.tsx`
- Pattern: Interface plus Supabase-backed factory; UI receives the interface for testability.

**AuthRepository:**
- Purpose: Authentication and workspace membership port.
- Examples: `src/auth/authTypes.ts`, `src/auth/authRepository.ts`, `src/components/AuthGate.tsx`
- Pattern: Interface plus Supabase-backed factory; `AuthGate` depends on the interface.

**SupabaseLike:**
- Purpose: Narrow typed shape for repository tests without importing full Supabase client types.
- Examples: `src/domain/orderRepository.ts`
- Pattern: Minimal structural typing around `.from().select/upsert/insert/update/delete`.

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Vite serves `index.html` and loads the application module.
- Responsibilities: Render `<App />` into the DOM and load `src/App.css`.

**Application Entry:**
- Location: `src/App.tsx`
- Triggers: `src/main.tsx`.
- Responsibilities: Create Supabase client and repositories, route through `AuthGate`, and render workspace UI.

**Authentication Entry:**
- Location: `src/components/AuthGate.tsx`
- Triggers: `App` renders it with an `AuthRepository`.
- Responsibilities: Load session, resolve workspace membership, render login/blocked/loading/ready states, manage sign-out.

**Order Capture Entry:**
- Location: `src/components/OrderCaptureForm.tsx`
- Triggers: Capture form submit.
- Responsibilities: Parse raw text, create `CapturedOrder`, evaluate review state, call `onSave`.

**Database Entry:**
- Location: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`
- Triggers: Supabase migration execution.
- Responsibilities: Create tables, triggers, indexes, RLS policies, and workspace guard functions.

**Workspace Admin RPC Entry:**
- Location: `supabase/migrations/20260707000000_workspace_admin_rpc.sql`
- Triggers: Supabase RPC calls from `src/auth/authRepository.ts`.
- Responsibilities: List workspace members and upsert workspace members by email for owners.

## Architectural Constraints

- **Threading:** Browser single-threaded React event loop. Async Supabase calls are guarded by request ids, workspace generations, and per-order promise queues in `src/App.tsx`.
- **Global state:** No global app store. Browser `localStorage` keys are module constants in `src/App.tsx`, `src/domain/localDraftCache.ts`, `src/domain/storage.ts`, and `src/components/OrderList.tsx`.
- **Workspace boundary:** Every durable order/settings query must include `workspace_id`; Supabase RLS policies enforce workspace membership in `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`.
- **Owner-only actions:** UI hides destructive order clearing and settings/member management unless `membership.role === 'owner'` in `src/App.tsx` and RPC/database policies enforce owner checks in SQL.
- **Manual edits:** Reparse and review logic must preserve `manuallyEditedFields`; `mergeParsedFields` records differences instead of overwriting edited fields in `src/domain/reviewRules.ts`.
- **Offline cache:** `offline-cache` is read-only; do not write mutations while `loadStatus === 'offline-cache'` in `src/App.tsx`.
- **Circular imports:** No circular dependency chain detected from inspected imports. Keep `src/domain/*` independent from `src/components/*` except repository infrastructure.

## Anti-Patterns

### Persisting Directly From Components

**What happens:** A component imports Supabase or writes database rows directly.
**Why it's wrong:** It bypasses the workspace generation guards, save queues, and repository interfaces used by `src/App.tsx`.
**Do this instead:** Add or extend a repository method in `src/domain/orderRepository.ts` or `src/auth/authRepository.ts`, then pass an app-level callback to the component from `src/App.tsx`.

### Recomputing Review State In UI Markup

**What happens:** A component independently decides missing fields, warning levels, or automatic status.
**Why it's wrong:** `src/domain/reviewRules.ts` is the shared source for attention reasons and status transitions.
**Do this instead:** Call `evaluateOrder` in a state transition path and render `order.reviewReasons`, `order.missingFields`, and `order.warningLevel`.

### Adding Order Fields In Only One Layer

**What happens:** A new order field is added to the UI but not to type definitions, parser, repository mapping, SQL schema, and storage hydration.
**Why it's wrong:** `CapturedOrder` is mapped across UI, Supabase rows, local cache, parser output, and tests.
**Do this instead:** Update `src/domain/orderTypes.ts`, `src/domain/orderRepository.ts`, `supabase/migrations/*.sql`, relevant parser/review files, components, and tests together.

### Treating `src/domain/storage.ts` As The Durable Store

**What happens:** New features use `loadOrders` or `saveOrders` for app data persistence.
**Why it's wrong:** `WorkspaceApp` uses Supabase through `src/domain/orderRepository.ts`; `src/domain/storage.ts` is localStorage-oriented and not imported by the app.
**Do this instead:** Use `createOrderRepository` for durable workspace data and `src/domain/localDraftCache.ts` only for recovery/cache behavior.

## Error Handling

**Strategy:** Fail closed for auth/workspace access, preserve user input on save failure, and keep blocked browser storage from breaking app usage.

**Patterns:**
- Repository methods throw Supabase errors after `throwIfError` in `src/domain/orderRepository.ts`.
- `AuthGate` catches session and membership failures and renders signed-out or blocked states in `src/components/AuthGate.tsx`.
- `WorkspaceApp` catches load failures, attempts offline recent cache, then renders an error state in `src/App.tsx`.
- Failed order creation saves a draft to `localStorage` via `saveOrderDraft` in `src/App.tsx`.
- Failed order updates restore the previous order and show a persistence message in `src/App.tsx`.
- Local storage helpers catch storage exceptions in `src/domain/localDraftCache.ts` and `src/domain/storage.ts`.

## Cross-Cutting Concerns

**Logging:** No app-level structured logger detected. Console logging is not part of the inspected architecture.
**Validation:** Client validation and hydration use domain guards in `src/domain/storage.ts`, parser normalization in `src/domain/parser.ts`, review rules in `src/domain/reviewRules.ts`, and database constraints/RLS in Supabase SQL migrations.
**Authentication:** Supabase Auth provides sessions through `src/lib/supabaseClient.ts`; `AuthGate` and `AuthRepository` resolve sessions and workspace membership.
**Authorization:** UI checks `membership.role`; Supabase RLS and owner-only RPCs enforce workspace/member permissions in `supabase/migrations/*.sql`.
**Accessibility:** Components use roles and ARIA labels in modal, auth, list, status, and capture flows; examples include `src/components/AuthGate.tsx`, `src/components/OrderDetail.tsx`, and `src/App.tsx`.

---

*Architecture analysis: 2026-07-08*
