# Codebase Concerns

**Analysis Date:** 2026-07-08

## Tech Debt

**Large UI components concentrate state, rendering, and persistence orchestration:**
- Issue: `src/App.tsx` owns workspace loading, offline-cache mode, optimistic order saves, settings saves, source filtering, modal state, sign-out cleanup, and layout rendering in one component.
- Files: `src/App.tsx`, `src/App.test.tsx`
- Impact: Changes to persistence, workspace switching, offline cache, or header/detail layout can accidentally break unrelated flows because the state transitions share refs and effects.
- Fix approach: Extract workspace data orchestration into a hook such as `src/hooks/useWorkspaceOrders.ts` before adding more persistence states; keep `WorkspaceApp` responsible for composition only.

**Order list component mixes calendar calculations, menus, and list/card rendering:**
- Issue: `src/components/OrderList.tsx` contains view-mode persistence, date math, calendar range segmentation, four menu states, empty state, calendar mode, card mode, and compact list mode.
- Files: `src/components/OrderList.tsx`, `src/components/OrderList.test.tsx`
- Impact: Calendar/date changes and list-label changes have a high regression surface because helper functions and JSX branches are colocated in a 900-line component.
- Fix approach: Move pure calendar helpers to `src/domain/orderCalendar.ts` with focused tests, and split render branches into `OrderCalendarView`, `OrderCardList`, and `OrderCompactList` components under `src/components/`.

**Legacy localStorage persistence remains alongside Supabase persistence:**
- Issue: `src/domain/storage.ts` still defines full local order/settings load-save behavior for `lyru-oms.orders.v1` and `lyru-oms.settings.v1`, while the active app path uses `src/domain/orderRepository.ts` and `src/domain/localDraftCache.ts`.
- Files: `src/domain/storage.ts`, `src/domain/storage.test.ts`, `src/domain/orderRepository.ts`, `src/domain/localDraftCache.ts`, `src/App.tsx`
- Impact: Future work can accidentally reintroduce full local-only persistence or update only one of two storage models, causing schema drift in `CapturedOrder` hydration.
- Fix approach: Mark `src/domain/storage.ts` explicitly as migration/legacy support or remove it after a verified Supabase migration path; keep drafts/cache in `src/domain/localDraftCache.ts` only.

**Supabase repository uses a hand-rolled client shape and casts around SDK types:**
- Issue: `src/domain/orderRepository.ts` defines `SupabaseLike`, `SelectQuery`, and `MutationQuery`, then `src/App.tsx` passes the real client as `supabase as never`.
- Files: `src/domain/orderRepository.ts`, `src/App.tsx`
- Impact: TypeScript can miss Supabase API contract changes, return-shape differences, and table-column mismatches; repository tests may pass with mocks that do not match the real client.
- Fix approach: Type the repository against `SupabaseClient` or a generated database type, then adjust tests to mock only the SDK methods actually called.

**Settings UI only edits existing minimum-order rows:**
- Issue: `src/components/SettingsModal.tsx` maps over `settings.quantityRules.minimumOrderRules` and has no add/remove flow for rules.
- Files: `src/components/SettingsModal.tsx`, `src/components/SettingsModal.test.tsx`, `src/domain/orderTypes.ts`
- Impact: Operators can change the default `2구` and `4구` thresholds but cannot configure new product unit counts without code or database edits.
- Fix approach: Add explicit add/remove controls and validate duplicate `unitCount` values in `src/components/SettingsModal.tsx`, with normalization in `src/domain/storage.ts` or repository settings validation.

## Known Bugs

**Newly saved orders are prepended without replacing an existing matching id:**
- Symptoms: If `handleSaveOrder` receives an order whose id already exists, the UI prepends the saved order and keeps the old copy, producing duplicates until reload.
- Files: `src/App.tsx:219`, `src/App.tsx:234`, `src/domain/orderRepository.ts:240`
- Trigger: Save an order through the capture path with an id already present in `orders`, or retry a draft/save flow that preserves an existing id.
- Workaround: Reloading from Supabase returns one row because `orders.id` is primary key.

**Change-request deletion can make a saved order appear to lose request state on partial failure:**
- Symptoms: `saveOrder` upserts the order row first, then deletes `order_change_requests` when the trimmed note is empty. If the order upsert succeeds and change-request delete fails, the thrown error makes the caller roll back UI state even though the order row already changed.
- Files: `src/domain/orderRepository.ts:240`, `src/domain/orderRepository.ts:249`, `src/App.tsx:299`
- Trigger: Editing order fields while clearing `changeRequestNote`, with a successful `orders` upsert and failed `order_change_requests` delete.
- Workaround: Reloading workspace data reconciles to the database state, but the user gets a generic failure message.

**Relative dates are intentionally unresolved but can disappear from desired date display:**
- Symptoms: `parseRawText` does not write `desiredDateTime` for relative dates, while `reviewRules` flags `relative-date`; list/calendar views then treat the order as date-missing until manual correction.
- Files: `src/domain/parser.ts:185`, `src/domain/parser.ts:211`, `src/domain/reviewRules.ts:162`, `src/components/OrderList.tsx:414`
- Trigger: Raw text like "내일 픽업" or other relative date expressions parsed as `parsedDate.isRelative`.
- Workaround: The detail modal shows a review reason; the operator must manually set a concrete desired date.

## Security Considerations

**Order PII is cached in browser localStorage:**
- Risk: Customer names, phone numbers, addresses, raw order text, request notes, and owner memos can persist locally in drafts and the recent-order offline cache.
- Files: `src/domain/localDraftCache.ts:4`, `src/domain/localDraftCache.ts:192`, `src/domain/localDraftCache.ts:210`, `src/App.tsx:197`, `src/App.tsx:584`
- Current mitigation: `clearLocalOrderData` removes draft/cache keys on sign-out via `AuthGate` in `src/App.tsx`; recent cache is limited to 30 recent orders plus the desired-shipping window and expires after 24 hours.
- Recommendations: Add an account-visible "local data clear" action, document shared-device risk in the UI, and consider caching only non-sensitive summary fields for offline read-only mode.

**RLS delete policy is broader for change requests than for orders/checklist items:**
- Risk: Any workspace member can delete `order_change_requests`, while only owners can delete `orders` and `order_checklist_items`.
- Files: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`
- Current mitigation: RLS restricts deletion to workspace members and the foreign key keeps change requests within the order workspace boundary.
- Recommendations: Align `order_change_requests` delete policy with owner-only order deletion or add an explicit product decision that staff may clear request notes.

**Workspace admin RPCs expose Auth user emails to owners:**
- Risk: `list_workspace_members` joins `auth.users` and returns member emails through a `security definer` function.
- Files: `supabase/migrations/20260707000000_workspace_admin_rpc.sql`, `src/auth/authRepository.ts:129`, `src/components/AccountModal.tsx:227`
- Current mitigation: The RPC checks `public.is_workspace_owner(target_workspace_id)`, revokes from `anon`, and grants only to `authenticated`.
- Recommendations: Keep RPC parameters workspace-scoped, avoid adding search/list-all-user behavior, and add database tests or migration review for any future `security definer` function.

**Password change re-authenticates with email/password in the browser:**
- Risk: `changePassword` signs in again with the current password before `updateUser`, temporarily handling both current and new passwords in React state.
- Files: `src/auth/authRepository.ts:85`, `src/components/AccountModal.tsx:17`
- Current mitigation: Inputs use password fields, state is cleared after success, and Supabase Auth performs the credential checks.
- Recommendations: Prefer Supabase's built-in reauthentication/password update pattern if available for the configured auth flow, and clear password state on modal close and failure paths.

## Performance Bottlenecks

**Full workspace load fetches all orders and all change requests:**
- Problem: Workspace load selects every order and every change request for the workspace, then groups latest change requests on the client.
- Files: `src/domain/orderRepository.ts:192`, `src/domain/orderRepository.ts:206`, `src/domain/orderRepository.ts:217`
- Cause: There is no pagination, date window, server-side latest-change-request view, or filtered query for active orders.
- Improvement path: Add pagination or an active date/status filter to `selectOrders`, and expose latest change request per order through a view/RPC if the table grows.

**Order list renders every order and recomputes calendar segments in memory:**
- Problem: `src/components/OrderList.tsx` maps every visible order and calendar mode segments every item across week rows.
- Files: `src/components/OrderList.tsx:458`, `src/components/OrderList.tsx:698`, `src/components/OrderList.tsx:843`
- Cause: No virtualization or incremental rendering is used; calendar helper work grows with the number of displayed orders.
- Improvement path: Add a render limit or virtualization for list/card mode, and precompute calendar range data in a domain helper with benchmark-like tests for large order sets.

**Recent-order cache serializes many full order objects after each ready-state order change:**
- Problem: A debounced effect writes selected full `CapturedOrder` objects, including raw text and notes, to localStorage whenever `orders` changes.
- Files: `src/App.tsx:197`, `src/domain/localDraftCache.ts:210`
- Cause: Cache selection keeps full order records for up to 30 recent orders plus all orders in a -14 to +45 day desired-shipping window.
- Improvement path: Store a compact offline snapshot type with only fields needed by the read-only list/detail view, and skip cache writes when serialized content is unchanged.

## Fragile Areas

**Parser heuristics are regex- and catalog-dependent:**
- Files: `src/domain/parser.ts`, `src/domain/menuCatalog.ts`, `src/domain/parser.test.ts`, `src/domain/menuCatalog.test.ts`
- Why fragile: Label splitting, quantity exclusion, fulfillment detection, menu matching, and date extraction all infer structured fields from informal Korean message text.
- Safe modification: Add failing examples to `src/domain/parser.test.ts` and `src/domain/menuCatalog.test.ts` before changing regexes, labels, aliases, or `MENU_CATALOG`.
- Test coverage: Unit coverage exists, but production message variations can still outgrow the current fixtures.

**Review rule status transitions preserve some manual states but auto-reset others:**
- Files: `src/domain/reviewRules.ts:191`, `src/components/OrderDetail.tsx:77`, `src/App.tsx:355`, `src/domain/reviewRules.test.ts`
- Why fragile: `evaluateOrder` keeps `제작 준비` and `발송 완료`, keeps any status when warnings are gone, and otherwise changes status to `확인 필요`.
- Safe modification: Add explicit tests for every status transition before changing missing-field, quantity, or request review logic.
- Test coverage: `src/domain/reviewRules.test.ts` covers core rules, but hidden helper `getSingleKnownUnitCount` and UI-triggered re-evaluation paths rely on indirect coverage.

**Optimistic save sequencing is per-order and easy to bypass:**
- Files: `src/App.tsx:90`, `src/App.tsx:108`, `src/App.tsx:299`, `src/App.test.tsx`
- Why fragile: `orderSaveSequenceByIdRef` and `orderSaveChainByIdRef` protect `handleChangeOrder`, but `handleSaveOrder`, `handleClearOrders`, settings save, and workspace reload use separate paths.
- Safe modification: Keep all existing per-order save ordering tests, then add race tests whenever a new mutation path touches `orders`.
- Test coverage: App tests cover several local draft/cache and sign-out paths; multi-request race coverage should be expanded around save failure and workspace switch behavior.

**Database schema stores application enums as plain text/jsonb:**
- Files: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`, `src/domain/orderTypes.ts`, `src/domain/orderRepository.ts`
- Why fragile: `orders.source`, `orders.status`, `orders.warning_level`, and several structured fields are not constrained to the TypeScript enum/value sets at the database layer.
- Safe modification: Add check constraints or domain-specific enums in migrations before relying on database data as trusted `CapturedOrder` values.
- Test coverage: Repository mapping tests cover client mapping, but database-level invalid values are not rejected by the current migration.

## Scaling Limits

**Single-workspace membership selection only returns the earliest membership:**
- Current capacity: `getWorkspaceMembership` limits to one workspace membership.
- Limit: A user in multiple workspaces cannot choose workspace; the app loads only the first membership by `created_at`.
- Scaling path: Add a workspace switcher and change `AuthRepository.getWorkspaceMembership` to list memberships.
- Files: `src/auth/authRepository.ts:98`, `src/components/AuthGate.tsx:40`, `src/App.tsx:578`

**No production-capacity model is implemented:**
- Current capacity: Quantity badges and calendar views show counts/dates, but no daily capacity threshold is modeled.
- Limit: Requirement `SCH-03` in `.planning/REQUIREMENTS.md` cannot be fulfilled by the current settings or calendar code.
- Scaling path: Add capacity settings, aggregate production quantity by desired date, and surface overloaded dates in `src/components/OrderList.tsx` or a new schedule view.
- Files: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `src/components/OrderList.tsx`, `src/domain/orderQuantity.ts`

## Dependencies at Risk

**No dependency risk detected from unsupported or deprecated packages:**
- Risk: Not detected.
- Impact: Not applicable.
- Migration plan: Keep dependency updates verified through `npm test` and `npm run build`.

**React 19 and Vite 6 keep the frontend on current major versions:**
- Risk: Major-version behavior changes in React testing/rendering APIs can affect component tests and event timing.
- Impact: Test failures or subtle UI behavior changes in `src/components/*.test.tsx`.
- Migration plan: Pin upgrade batches, run `npm test` and `npm run build`, and verify modal/list interactions manually after React or Testing Library upgrades.

## Missing Critical Features

**PWA/offline write retry is not implemented:**
- Problem: The app has read-only recent-order cache fallback, but no service worker, offline shell, or reconnect retry queue for failed writes.
- Blocks: Reliable offline operation beyond viewing cached recent orders.
- Files: `src/App.tsx`, `src/domain/localDraftCache.ts`, `docs/superpowers/specs/2026-07-06-supabase-pwa-roadmap-design.md`

**Order checklist table exists without application workflow:**
- Problem: `order_checklist_items` is created with RLS and indexes, but no UI or repository methods manage checklist items.
- Blocks: 출고 전 검수 workflow that requires persistent checklist completion.
- Files: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`, `src/domain/orderRepository.ts`, `src/components/OrderDetail.tsx`

**Member removal/demotion UI is absent:**
- Problem: Owners can add/update workspace members, but the current account modal only lists members and upserts a role by email.
- Blocks: Revoking access or correcting member mistakes without SQL/Supabase admin work.
- Files: `src/components/AccountModal.tsx`, `src/auth/authRepository.ts`, `supabase/migrations/20260707000000_workspace_admin_rpc.sql`

## Test Coverage Gaps

**Database RLS and RPC behavior lack automated database tests:**
- What's not tested: Actual Supabase policies, `security definer` ownership checks, last-owner trigger behavior, and owner/staff delete differences.
- Files: `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`, `supabase/migrations/20260707000000_workspace_admin_rpc.sql`
- Risk: A migration can pass TypeScript/Vitest while weakening workspace data isolation.
- Priority: High

**Repository tests use mocks rather than a real Supabase client/database:**
- What's not tested: Real query chaining, `upsert` conflict behavior, RLS failures, trigger-updated timestamps, and JSONB serialization.
- Files: `src/domain/orderRepository.test.ts`, `src/auth/authRepository.test.ts`, `src/domain/orderRepository.ts`, `src/auth/authRepository.ts`
- Risk: Mock behavior can drift from Supabase SDK behavior, especially around `.select().single()` and RPC returns.
- Priority: High

**Large UI flows have component tests but limited browser-layout verification:**
- What's not tested: Mobile/desktop layout, overflow, modal focus trapping across real browser engines, calendar density, and Korean text wrapping.
- Files: `src/components/OrderList.test.tsx`, `src/components/OrderDetail.test.tsx`, `src/components/AccountModal.test.tsx`, `src/App.css`
- Risk: Vitest/jsdom can pass while the production UI is hard to use on the mobile-first target.
- Priority: Medium

**Offline cache security/retention behavior needs policy-level tests:**
- What's not tested: Shared-device behavior, manual local-data clearing, and cache contents minimization.
- Files: `src/domain/localDraftCache.test.ts`, `src/App.test.tsx`, `src/domain/localDraftCache.ts`
- Risk: Future changes may expand cached PII or fail to clear cache on all sign-out paths.
- Priority: Medium

---

*Concerns audit: 2026-07-08*
