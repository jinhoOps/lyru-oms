# Codebase Structure

**Analysis Date:** 2026-07-08

## Directory Layout

```text
lyru-oms/
├── .agents/                  # Project-local agent skill directory; no SKILL.md files detected
├── .codegraph/               # CodeGraph index for code exploration
├── .github/                  # GitHub project automation/configuration
├── .planning/                # GSD product, requirements, roadmap, state, and generated codebase maps
├── dist/                     # Vite build output
├── docs/                     # Superpowers design specs and implementation plans
├── node_modules/             # Installed npm dependencies
├── src/                      # React app source, components, auth, domain, and lib utilities
│   ├── auth/                 # Auth repository and auth-facing types
│   ├── components/           # React UI components and co-located tests
│   ├── domain/               # Order model, parser, rules, sorting, storage, repository, tests
│   └── lib/                  # Cross-cutting browser/library helpers
├── supabase/                 # Supabase SQL migrations, bootstrap, grants, and seed data
│   └── migrations/           # Versioned schema/RLS/RPC migrations
├── index.html                # Vite HTML entry
├── package.json              # npm scripts, dependencies, Node engine
├── package-lock.json         # npm lockfile
├── tsconfig.json             # Browser app TypeScript config
├── tsconfig.node.json        # Vite/node TypeScript config
├── vite.config.ts            # Vite and Vitest config
└── vitest.setup.ts           # Vitest DOM setup
```

## Directory Purposes

**`src`:**
- Purpose: All browser application source code.
- Contains: React entry, app shell, CSS, auth, components, domain functions, infrastructure helpers, and tests.
- Key files: `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/vite-env.d.ts`

**`src/auth`:**
- Purpose: Authentication and workspace membership adapter layer.
- Contains: Supabase-backed auth repository, repository interface types, workspace member types.
- Key files: `src/auth/authRepository.ts`, `src/auth/authTypes.ts`, `src/auth/authRepository.test.ts`

**`src/components`:**
- Purpose: React presentation and interaction components.
- Contains: Auth gate, account modal, settings modal, order capture form, order list, order detail modal, date picker, confirmation dialog, question note, reparse hint.
- Key files: `src/components/AuthGate.tsx`, `src/components/OrderCaptureForm.tsx`, `src/components/OrderList.tsx`, `src/components/OrderDetail.tsx`, `src/components/SettingsModal.tsx`, `src/components/AccountModal.tsx`

**`src/domain`:**
- Purpose: Order business model, pure workflow logic, parsing, review rules, sorting, persistence adapters, local recovery/cache.
- Contains: Types, parser, review rules, date formatting/parsing, menu catalog, quantity calculations, Supabase repository, local storage helpers, seed fixture helper, tests.
- Key files: `src/domain/orderTypes.ts`, `src/domain/parser.ts`, `src/domain/reviewRules.ts`, `src/domain/orderRepository.ts`, `src/domain/localDraftCache.ts`, `src/domain/orderSorting.ts`, `src/domain/dateDisplay.ts`

**`src/lib`:**
- Purpose: Small cross-cutting helpers that are neither domain-specific nor full components.
- Contains: Supabase client factory and focus/menu blur helper.
- Key files: `src/lib/supabaseClient.ts`, `src/lib/focusMenu.ts`

**`supabase`:**
- Purpose: Database schema, RLS, RPC, grants, bootstrap, and sample data.
- Contains: Migration SQL, owner bootstrap scripts, development seed scripts.
- Key files: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`, `supabase/migrations/20260707000000_workspace_admin_rpc.sql`, `supabase/bootstrap.owner.sql`, `supabase/grant.initial-admins.sql`

**`docs/superpowers`:**
- Purpose: Durable design and plan artifacts for feature work.
- Contains: `specs` and `plans` Markdown documents grouped by date and feature.
- Key files: `docs/superpowers/specs/2026-07-08-order-list-default-labels-design.md`, `docs/superpowers/plans/2026-07-08-order-list-default-labels.md`

**`.planning`:**
- Purpose: GSD product context and generated codebase maps.
- Contains: Project charter, requirements, roadmap, workflow state, codebase analysis documents.
- Key files: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

**`.codegraph`:**
- Purpose: Local CodeGraph index for symbol-aware exploration.
- Contains: Generated index data.
- Key files: Generated; do not edit manually.

## Key File Locations

**Entry Points:**
- `index.html`: Vite HTML shell with the root DOM node.
- `src/main.tsx`: React root creation and global CSS import.
- `src/App.tsx`: Main app composition, repository creation, workspace orchestration.

**Configuration:**
- `package.json`: npm scripts, Node `>=22.0.0`, dependencies, dev dependencies.
- `package-lock.json`: Exact npm dependency lockfile.
- `vite.config.ts`: Vite React plugin, `/lyru-oms/` base path, Vitest `jsdom` environment and setup file.
- `tsconfig.json`: Strict TypeScript browser app config with `jsx: react-jsx`.
- `tsconfig.node.json`: TypeScript config for Vite/node config files.
- `vitest.setup.ts`: Testing Library DOM matcher setup.
- `.env`: Present; environment configuration only, contents not read.
- `.env.example`: Public example env shape for Supabase configuration.

**Core Logic:**
- `src/domain/orderTypes.ts`: Shared order sources, statuses, field keys, review reason types, `CapturedOrder`, `OrderSettings`, defaults, and empty fields.
- `src/domain/parser.ts`: Raw order text parsing and duplicate raw text normalization.
- `src/domain/reviewRules.ts`: Missing information, confirmation reasons, warning level, status evaluation, and reparse merge behavior.
- `src/domain/orderRepository.ts`: Supabase-backed order/settings/change-request repository.
- `src/auth/authRepository.ts`: Supabase-backed auth and workspace membership repository.
- `src/domain/localDraftCache.ts`: Draft recovery and recent offline cache.
- `src/domain/orderSorting.ts`: Desired date, recent, and quantity sorting.
- `src/domain/dateDisplay.ts`: Korean date parsing and D-day display labels.
- `src/domain/menuCatalog.ts`: Menu matching and purpose mapping.
- `src/domain/orderQuantity.ts`: Production quantity calculation.

**UI Components:**
- `src/components/AuthGate.tsx`: Login, blocked, loading, and authenticated workspace gate.
- `src/components/OrderCaptureForm.tsx`: Raw text capture and parsed preview.
- `src/components/OrderList.tsx`: Order list/card/calendar views, filters, sort controls.
- `src/components/OrderDetail.tsx`: Detail modal, editable fields, status changes, review reason navigation, change request section.
- `src/components/DesiredDateTimePicker.tsx`: Date/time picker using `react-day-picker`.
- `src/components/SettingsModal.tsx`: Required field and quantity rule settings.
- `src/components/AccountModal.tsx`: Workspace member management.
- `src/components/ConfirmDialog.tsx`: Reusable confirmation modal.
- `src/components/QuestionNote.tsx`: Phase validation note UI.
- `src/components/ReparseHint.tsx`: Difference indicator for parser re-runs.

**Database:**
- `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`: Tables, enum, indexes, triggers, RLS policies, workspace membership helper functions.
- `supabase/migrations/20260707000000_workspace_admin_rpc.sql`: Owner-only member listing/upsert RPC functions.
- `supabase/bootstrap.owner.sql`: Owner/bootstrap SQL.
- `supabase/grant.initial-admins.sql`: Initial admin grants.
- `supabase/seed.dev.sql`: Development seed data.
- `supabase/seed.owner-samples.sql`: Owner sample seed data.

**Testing:**
- `src/App.test.tsx`: App orchestration tests.
- `src/components/*.test.tsx`: Component tests beside component files.
- `src/domain/*.test.ts`: Domain/repository/storage tests beside domain files.
- `src/lib/*.test.ts`: Library helper tests beside helper files.
- `vitest.setup.ts`: Test setup.

## Naming Conventions

**Files:**
- React components use PascalCase: `src/components/OrderDetail.tsx`, `src/components/SettingsModal.tsx`.
- Component tests use the same basename with `.test.tsx`: `src/components/OrderList.test.tsx`.
- Domain and lib modules use camelCase: `src/domain/orderRepository.ts`, `src/domain/localDraftCache.ts`, `src/lib/supabaseClient.ts`.
- Domain tests use `.test.ts`: `src/domain/reviewRules.test.ts`, `src/domain/parser.test.ts`.
- SQL migrations use timestamp-prefix snake_case names: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`.
- Planning/design docs use date-prefix kebab-case names: `docs/superpowers/plans/2026-07-06-supabase-auth-db-foundation.md`.

**Directories:**
- Source directories are lowercase by layer: `src/auth`, `src/components`, `src/domain`, `src/lib`.
- Supabase migrations live under `supabase/migrations`.
- Generated GSD maps live under `.planning/codebase`.

## Where to Add New Code

**New Order Workflow Feature:**
- Primary orchestration: `src/App.tsx`
- UI component: `src/components`
- Domain rules: `src/domain`
- Tests: co-located `src/App.test.tsx`, `src/components/*.test.tsx`, or `src/domain/*.test.ts`
- Use when: The feature changes order capture, list, detail, settings, or status behavior.

**New Order Field:**
- Type/default definitions: `src/domain/orderTypes.ts`
- Parser support: `src/domain/parser.ts`
- Review/evaluation support: `src/domain/reviewRules.ts`
- Supabase row mapping: `src/domain/orderRepository.ts`
- Durable schema: new migration under `supabase/migrations`
- UI editing/display: `src/components/OrderCaptureForm.tsx`, `src/components/OrderDetail.tsx`, `src/components/OrderList.tsx` as applicable
- Local recovery/cache: `src/domain/localDraftCache.ts`
- Tests: `src/domain/orderTypes.test.ts`, `src/domain/parser.test.ts`, `src/domain/reviewRules.test.ts`, `src/domain/orderRepository.test.ts`, relevant component tests

**New Persistence Operation:**
- Repository interface and implementation: `src/domain/orderRepository.ts` for order/settings data or `src/auth/authRepository.ts` for auth/workspace data
- App-level callback and state coordination: `src/App.tsx`
- Database support: `supabase/migrations/*.sql`
- Tests: repository tests plus app/component tests for UI behavior

**New Authentication Or Workspace Admin Feature:**
- Repository/type changes: `src/auth/authRepository.ts`, `src/auth/authTypes.ts`
- UI: `src/components/AuthGate.tsx` or `src/components/AccountModal.tsx`
- SQL/RPC/RLS: `supabase/migrations`
- Tests: `src/auth/authRepository.test.ts`, `src/components/AuthGate.test.tsx`, `src/components/AccountModal.test.tsx`

**New Domain Utility:**
- Implementation: `src/domain/<camelCaseName>.ts`
- Tests: `src/domain/<camelCaseName>.test.ts`
- Use from components through imports only when the utility is pure or display-oriented; persistence stays behind repositories.

**New Shared UI Helper:**
- Implementation: `src/lib/<camelCaseName>.ts`
- Tests: `src/lib/<camelCaseName>.test.ts`
- Use when the helper is not specific to orders, auth, or one component.

**New Modal Or Reusable Component:**
- Implementation: `src/components/<PascalCaseName>.tsx`
- Tests: `src/components/<PascalCaseName>.test.tsx`
- Styling: `src/App.css`

**New Supabase Schema Change:**
- Migration: `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_case_name>.sql`
- Repository mapping: `src/domain/orderRepository.ts` or `src/auth/authRepository.ts`
- Tests: repository tests with fake Supabase-like clients.

**Utilities:**
- Domain-specific helpers: `src/domain`
- Browser/library helpers: `src/lib`
- Test fixture helpers for domain data: `src/domain/devSeedOrders.ts`

## Special Directories

**`.planning`:**
- Purpose: Product context and codebase map output.
- Generated: Partially
- Committed: Yes

**`.codegraph`:**
- Purpose: Local symbol/code index used before grep/find for code understanding.
- Generated: Yes
- Committed: Repository-specific; do not manually edit.

**`dist`:**
- Purpose: Vite production build output.
- Generated: Yes
- Committed: Depends on repository policy; do not edit manually.

**`node_modules`:**
- Purpose: npm dependency installation.
- Generated: Yes
- Committed: No

**`docs/superpowers`:**
- Purpose: Design and plan history for implemented and planned work.
- Generated: Partially
- Committed: Yes

**`supabase`:**
- Purpose: Database schema and seed/bootstrap assets.
- Generated: No
- Committed: Yes

**`.agents/skills`:**
- Purpose: Project-local skill instructions.
- Generated: No
- Committed: Yes
- Note: No `SKILL.md` files detected during this mapping.

---

*Structure analysis: 2026-07-08*
