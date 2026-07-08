# Small Input Readiness Refactor Design

Date: 2026-07-08

## Goal

Finish the remaining low-risk input responsiveness cleanup after the first safe refactor slice.

The slice should make selected-order lookup cheaper and clearer in `WorkspaceApp`, while staying compatible with offline-cache read-only mode. It should also remove the unused development seed fixture if it is still unreferenced.

## Scope

Included:

- Add an `ordersById` memo in `src/App.tsx`.
- Use `ordersById` for selected-order lookup and source-filter selected-order validation.
- Preserve the existing save, clear, workspace-switch, and rollback behavior.
- Remove `src/domain/devSeedOrders.ts` only if it has no imports or runtime/test references.
- Add or adjust focused tests only where existing coverage does not prove the selected-order behavior.

Excluded:

- Offline cache size limits or top-N selection changes.
- Supabase RPC transaction work.
- Latest change-request query, view, or index changes.
- Full replacement of every `orders.find(...)` in `App.tsx`.
- Any UI copy, layout, or behavior change.

## Design

### Orders By Id Memo

`WorkspaceApp` should derive a memoized map from the current `orders` array:

```ts
const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
```

This map is an internal read optimization. It should not become a new prop or exported helper in this slice.

### Selected Order

`selectedOrder` should use `ordersById.get(selectedId)` instead of scanning the filtered list. It must still respect the current source filter:

- If there is no selected id, return `null`.
- If the selected id is not present in `ordersById`, return `null`.
- If `sourceFilter` is not `전체` and the selected order's source does not match, return `null`.
- Otherwise return the selected order.

This keeps the existing behavior where a filtered-out selected order is not shown in detail.

### Source Filter Change

`handleSourceFilterChange` should use `ordersById.get(currentSelectedId)` to decide whether the selected order remains valid under the next source filter.

This is relevant to offline cache because offline snapshots populate `orders` and use the same selection/filter path, even though mutations are blocked.

### Save Rollback Boundary

The rollback lookup in `handleChangeOrder` should remain unchanged in this slice.

That lookup captures the previous order before an optimistic update and is tied to save sequencing, rollback, and workspace-generation guards. Offline-cache mode blocks mutations before this path, so changing it is not needed for the offline-cache concern and would increase risk.

### Unused Dev Seed Fixture

`src/domain/devSeedOrders.ts` should be removed only if a fresh reference search shows no imports or usages of:

- `devSeedOrders`
- `createNasdaqSampleOrder`
- `createYuriruSampleOrder`

If any usage exists, leave the file in place and document why removal was skipped in the implementation notes.

## Error Handling

No error-handling behavior should change.

Offline-cache read-only guards, save failure rollback, workspace switching, and local draft recovery should remain as they are.

## Testing

Use existing tests as the primary safety net:

- `src/App.test.tsx`
- full test suite

Add one focused `App.test.tsx` regression only if existing tests do not prove that a selected order still resolves to the latest object after `orders` changes and still disappears when the current source filter excludes it.

Verification commands:

- `npm test -- src/App.test.tsx --run`
- `npm test -- --run`
- `npm run build`
- `git diff --check`

## Acceptance Criteria

- `WorkspaceApp` uses a memoized `ordersById` for selected-order read paths.
- Source-filter selection validation uses `ordersById`.
- Save rollback and async race behavior are untouched.
- Offline-cache read-only display and mutation blocking still pass existing tests.
- `devSeedOrders.ts` is removed only if unreferenced.
- All relevant tests and build pass.
