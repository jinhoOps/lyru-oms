# Safe Refactor Slice Design

Date: 2026-07-08

## Goal

Apply the first low-risk refactoring slice from `.planning/codebase/OPTIMIZATION_AUDIT.md`.

The slice must keep product behavior unchanged while reducing repeated client-side work and cleaning up build-only dependencies. It should be small enough for one focused PR and easy to verify with existing tests.

## Scope

Included:

- Precompute recent timestamps in `src/domain/orderSorting.ts` so sort comparators do not parse dates repeatedly.
- Replace repeated raw-text duplicate scans with memoized normalized duplicate keys or a checker function.
- Memoize calendar-mode derived data in `src/components/OrderList.tsx`.
- Move Vite and TypeScript build tools from `dependencies` to `devDependencies` in `package.json`.
- Add TypeScript incremental build cache settings in `tsconfig.json`.

Excluded:

- Supabase RPC transaction for `saveOrder`.
- Initial load pagination, column narrowing, or latest change-request query changes.
- Offline cache size policy changes.
- List virtualization.
- Legacy `src/domain/storage.ts` removal.
- Unused fixture removal.

## Design

### Order Sorting

`sortOrders` should keep the same public API and output order. Internally, it should decorate each order with any values used repeatedly by comparators, especially `recentTime`.

For `recent` sorting, each order's recent timestamp is computed once before sorting. For other modes, each keyed item includes both the primary sort key and `recentTime` for tie-breaking. Comparators then compare numbers instead of reparsing dates.

This is a pure domain change and should be covered by existing `src/domain/orderSorting.test.ts`.

### Duplicate Raw Text Check

The capture flow should avoid rebuilding and rescanning raw-text arrays on every render.

`WorkspaceApp` should derive duplicate-check data from `orders` with `useMemo`. The preferred boundary is to pass a stable duplicate checker or normalized key set into `OrderCaptureForm` instead of passing `orders.map((order) => order.rawText)` directly.

The parsing helper should preserve current duplicate semantics. A raw text is duplicate when its normalized exact-duplicate key matches an existing order's normalized key. Empty raw text should not be duplicate.

Tests should continue to verify duplicate warnings and save behavior.

### Calendar Derived Data

`OrderList` currently derives range windows, range segments, grouped rows, and daily items during calendar render. These values should be wrapped in `useMemo` with explicit dependencies:

- `calendarRangeMode`
- `calendarData.rangeItems`
- `todayIsoDate`
- `viewMode` only if needed to skip work outside calendar mode

Behavior and rendered labels must remain unchanged.

### Build Hygiene

`@vitejs/plugin-react`, `typescript`, and `vite` should move from `dependencies` to `devDependencies` because they are build-time tools. `package-lock.json` should be updated by the package manager, not hand-edited.

`tsconfig.json` should add incremental settings for app typecheck cache. Use a cache path under `node_modules/.tmp/` so generated metadata stays out of source control.

## Error Handling

No runtime error-handling behavior changes are in scope. This slice should not change Supabase repository behavior, auth flows, save retries, or offline cache recovery.

If build dependency movement exposes deployment assumptions, stop and report rather than changing deployment workflow.

## Testing

Run focused tests first:

- `npm test -- src/domain/orderSorting.test.ts --run`
- `npm test -- src/components/OrderCaptureForm.test.tsx src/components/OrderList.test.tsx src/App.test.tsx --run`

Then run full verification:

- `npm test -- --run`
- `npm run build`

Build output should still be valid. Any Vite chunk-size warning is not part of this slice.

## Acceptance Criteria

- Sort order behavior remains unchanged.
- Duplicate raw-text warning behavior remains unchanged.
- Calendar mode output remains unchanged.
- Build tools are no longer runtime dependencies.
- TypeScript incremental cache is configured without committing generated cache files.
- All relevant tests and build pass.
