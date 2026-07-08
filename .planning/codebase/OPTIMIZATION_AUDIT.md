# Code Optimization Audit

Date: 2026-07-08

## Summary

- Critical: 0
- High: 4
- Medium: 9
- Low: 8
- No issues found: I/O and network direct calls, security-performance patterns

Highest-impact candidates:

1. Make order + change-request save atomic in `src/domain/orderRepository.ts`.
2. Reduce initial Supabase payload and avoid unbounded `SELECT *` in `src/domain/orderRepository.ts`.
3. Replace repeated raw-text duplicate scans with a memoized normalized `Set`.
4. Bound offline cache size in `src/domain/localDraftCache.ts`.
5. Precompute sort timestamps in `src/domain/orderSorting.ts`.

## Findings

### High

#### `src/domain/orderRepository.ts`

- Multi-step order save is not atomic.
  - Current: order upsert succeeds, then change-request upsert/delete can fail separately.
  - Risk: order and change request can diverge while UI reports save failure.
  - Fix: move `saveOrder` into a Supabase RPC transaction, or add reconciliation/compensation.

- Initial workspace load uses unbounded `SELECT *` for orders.
  - Current: list load fetches all rows and heavy columns like `raw_text` and JSON fields.
  - Risk: mobile payload and render cost grow with order history.
  - Fix: page or window initial load, select only list-needed columns, lazy-load heavy detail fields.

- Change-request load fetches all rows then keeps latest per order in JS.
  - Current: client builds latest-per-order with a `Map`.
  - Risk: response rows and DB sort cost grow with change history.
  - Fix: DB view/RPC/window query for latest request per order, with matching composite index.

- Supabase DB reads have no timeout/retry boundary.
  - Current: workspace load waits on `Promise.all` of Supabase calls.
  - Risk: unstable mobile network can keep first screen stuck or fail on transient errors.
  - Fix: repository-level timeout wrapper and conservative retry for read-only calls.

### Medium

#### `src/domain/localDraftCache.ts`

- Recent offline cache is partly unbounded.
  - Current: recent 30 orders plus all desired-window orders are serialized to `localStorage`.
  - Risk: large seasonal windows can block main thread or exceed storage quota.
  - Fix: cap total cached orders or store minimal summaries; consider IndexedDB if full snapshots matter.

- Recent-order cache sorts full order list to keep top 30.
  - Current: full `sort` then `slice(0, 30)`.
  - Risk: unnecessary `O(n log n)` and repeated date parsing.
  - Fix: precompute timestamps and use bounded top-N selection, or at least decorate-sort-undecorate.

#### `src/App.tsx`, `src/components/OrderCaptureForm.tsx`, `src/domain/parser.ts`

- Duplicate raw-text check reallocates and rescans.
  - Current: `orders.map((order) => order.rawText)` plus linear normalization scan.
  - Risk: typing latency grows with order count and raw text length.
  - Fix: build normalized raw-text `Set` with `useMemo`, pass checker or keys to capture form.

#### `src/domain/orderSorting.ts`

- Sort comparator repeatedly parses dates.
  - Current: `compareRecent` parses date inside sort comparator and tie-breaker.
  - Risk: date parsing repeats `O(n log n)` times.
  - Fix: decorate orders with `recentTime` and primary key before sorting.

#### `src/components/OrderList.tsx`

- List/card rendering is not virtualized.
  - Current: all orders render via `.map()`.
  - Risk: DOM and row computation grow sharply over 100+ orders.
  - Fix: split row component, memoize row, consider `react-virtuoso` or `react-window` after list size justifies dependency.

- Calendar derived data recalculates during render.
  - Current: `buildRangeSegments`, `groupBy`, `buildDailyItems` run inside calendar render branch.
  - Risk: menu/selection state changes can recompute same calendar data.
  - Fix: wrap calendar window, segments, grouped rows, and daily items in `useMemo`.

#### `package.json`

- Build tools are in `dependencies`.
  - Current: `@vitejs/plugin-react`, `typescript`, `vite` live under runtime dependencies.
  - Risk: larger production install and audit surface.
  - Fix: move them to `devDependencies`; confirm deployment build/runtime split.

#### `src/domain/storage.ts`

- Legacy localStorage order/settings module appears test-only.
  - Current: production imports do not use `loadOrders`, `saveOrders`, `loadSettings`, `saveSettings`.
  - Risk: storage policy confusion and extra maintenance.
  - Fix: remove module and tests if migration path no longer needed; otherwise rename to explicit migration module.

#### `src/auth/authRepository.ts`, `src/components/AuthGate.tsx`

- Session/auth failures blur transient network errors with signed-out state.
  - Current: failed `getSession` path can show signed-out.
  - Risk: temporary network failure looks like logout.
  - Fix: separate "no session" from session lookup error; show retry state.

### Low

- `src/App.tsx`: ID lookups use repeated `.find()` over order arrays. Add `ordersById` memo if order count grows.
- `src/components/AccountModal.tsx`: member upsert is followed by full member reload. Use returned row for local update if ordering permits.
- `src/components/AuthGate.tsx`: `onBeforeSignOut` is awaited before `signOut`; future async cleanup could delay logout.
- `src/App.tsx`: settings save catch rethrows after showing user message; consider result return instead of global rejection.
- `src/App.css`: loading animation uses paint-heavy `filter`/`box-shadow`; prefer transform/opacity for low-end mobile.
- `src/App.tsx`: settings/account modals are statically imported; lazy-load only if those components grow.
- `tsconfig.json`: app typecheck lacks explicit incremental cache; add `incremental` and `tsBuildInfoFile` if local/CI cache benefits.
- `src/domain/devSeedOrders.ts`: `createYuriruSampleOrder` appears unused; remove or attach to real test fixture.

## Recommended Refactoring Slices

1. **Data integrity slice**
   - RPC transaction for order + change-request save.
   - Add tests for partial failure behavior.

2. **Initial load slice**
   - Replace unbounded order/change-request loading with explicit columns, pagination/window, and latest-change-request query.
   - Add matching Supabase indexes/migrations.

3. **Input responsiveness slice**
   - Memoized duplicate raw-text keys.
   - Precomputed order sort timestamps.
   - Calendar derivation `useMemo`.

4. **Storage cleanup slice**
   - Bound offline cache.
   - Decide whether `src/domain/storage.ts` is removable legacy.

5. **Small hygiene slice**
   - Move build tools to `devDependencies`.
   - Add TypeScript incremental cache.
   - Remove unused fixture if not needed.

## Notes

- No direct `fetch`/`axios` anti-patterns found.
- No confirmed security-performance issue found.
- Virtualization is not first refactor unless real order counts exceed roughly 100 visible rows.
