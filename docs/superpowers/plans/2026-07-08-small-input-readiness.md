# Small Input Readiness Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small `ordersById` read optimization for selected-order paths and remove the unused development seed fixture if it remains unreferenced.

**Architecture:** Keep the change inside `WorkspaceApp` and avoid changing save, clear, workspace-switch, and rollback flows. The memoized map is an internal derived value from `orders`, used only for selected-order read paths and source-filter validation. Fixture cleanup is independent and must be skipped if a fresh reference search finds usage.

**Tech Stack:** React `useMemo`, TypeScript, Vitest, React Testing Library, Git.

---

## File Structure

- Modify `src/App.tsx`
  - Add `ordersById` derived from `orders`.
  - Change `selectedOrder` lookup and source-filter selection validation to use the map.
  - Do not change `handleChangeOrder` rollback lookup.
- Modify `src/App.test.tsx` only if needed.
  - Existing tests already cover offline read-only mode and source-filter detail closing.
  - Add one regression only if the implementation changes behavior not already covered.
- Delete `src/domain/devSeedOrders.ts` only if unreferenced.
  - Confirm with `rg "createNasdaqSampleOrder|createYuriruSampleOrder|devSeedOrders" -n`.

---

### Task 1: Memoize Selected Order Lookup

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Run focused baseline tests**

Run:

```bash
npm test -- src/App.test.tsx --run
```

Expected: PASS. This establishes that source-filter, offline-cache, and race tests are passing before the refactor.

- [ ] **Step 2: Add `ordersById` memo**

In `src/App.tsx`, after `filteredOrders` and before `selectedOrder`, add:

```tsx
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
```

The surrounding block should become:

```tsx
  const filteredOrders = useMemo(
    () => (sourceFilter === '전체' ? orders : orders.filter((order) => order.source === sourceFilter)),
    [orders, sourceFilter],
  );
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedId) ?? null,
    [filteredOrders, selectedId],
  );
```

- [ ] **Step 3: Change `selectedOrder` to use `ordersById`**

Replace the current `selectedOrder` memo:

```tsx
  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedId) ?? null,
    [filteredOrders, selectedId],
  );
```

with:

```tsx
  const selectedOrder = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    const order = ordersById.get(selectedId) ?? null;

    if (!order) {
      return null;
    }

    return sourceFilter === '전체' || order.source === sourceFilter ? order : null;
  }, [ordersById, selectedId, sourceFilter]);
```

This preserves the existing behavior where detail closes visually when the selected order is filtered out.

- [ ] **Step 4: Change source-filter selection validation to use `ordersById`**

In `handleSourceFilterChange`, replace:

```tsx
      const selected = orders.find((order) => order.id === currentSelectedId);
      return selected?.source === nextSourceFilter ? currentSelectedId : null;
```

with:

```tsx
      const selected = ordersById.get(currentSelectedId);
      return selected?.source === nextSourceFilter ? currentSelectedId : null;
```

The full function should remain:

```tsx
  function handleSourceFilterChange(nextSourceFilter: OrderSourceFilter) {
    setSourceFilter(nextSourceFilter);
    setSelectedId((currentSelectedId) => {
      if (!currentSelectedId || nextSourceFilter === '전체') {
        return currentSelectedId;
      }

      const selected = ordersById.get(currentSelectedId);
      return selected?.source === nextSourceFilter ? currentSelectedId : null;
    });
  }
```

- [ ] **Step 5: Confirm rollback lookup remains unchanged**

Verify `handleChangeOrder` still contains this line:

```tsx
    const previousOrder = orders.find((order) => order.id === nextOrder.id) ?? null;
```

Do not replace it in this task. It captures rollback state before optimistic save and is intentionally outside the `ordersById` change.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/App.test.tsx --run
```

Expected: PASS. The existing test `closes detail when source filter excludes the selected order` must still pass.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/App.tsx
git commit -m "refactor: memoize selected order lookup"
```

---

### Task 2: Remove Unused Development Seed Fixture

**Files:**
- Delete: `src/domain/devSeedOrders.ts` only if unreferenced.
- Test: `src/App.test.tsx`

- [ ] **Step 1: Verify fixture references**

Run:

```bash
rg "createNasdaqSampleOrder|createYuriruSampleOrder|devSeedOrders" -n
```

Expected if safe to remove: no output and exit code `1`.

If there is any output, stop this task and do not delete `src/domain/devSeedOrders.ts`. Instead, report the references and leave the file unchanged.

- [ ] **Step 2: Delete the unused file if Step 1 has no references**

Delete:

```text
src/domain/devSeedOrders.ts
```

Use normal file deletion through the editing tool or shell only for this exact file.

- [ ] **Step 3: Run focused test that protects empty startup**

Run:

```bash
npm test -- src/App.test.tsx --run
```

Expected: PASS. The existing test `starts an empty authenticated workspace without sample orders` must still pass.

- [ ] **Step 4: Commit Task 2**

If the file was deleted, run:

```bash
git add src/domain/devSeedOrders.ts
git commit -m "chore: remove unused dev seed orders"
```

If deletion was skipped because references exist, do not create a commit for this task.

---

### Task 3: Final Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run focused App tests**

Run:

```bash
npm test -- src/App.test.tsx --run
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. A Vite chunk-size warning is acceptable if build exits with code `0`.

- [ ] **Step 4: Check whitespace and final Git state**

Run:

```bash
git diff --check
git status --short --branch
git log --oneline --max-count=6
```

Expected:

```text
git diff --check
# no output
```

`git status --short --branch` should show the current branch and no unstaged or staged files after commits.

`git log --oneline --max-count=6` should include the Task 1 commit and the Task 2 commit only if the unused fixture was deleted.

---

## Implementation Notes

- Do not add `ordersById` as a prop, context value, or exported helper.
- Do not change offline cache storage policy in this plan.
- Do not change Supabase repository behavior in this plan.
- Do not replace the rollback lookup in `handleChangeOrder`.
- Add a new `App.test.tsx` test only if the existing tests fail to cover selected-order behavior after implementation review. The preferred outcome is no new test if existing coverage remains sufficient.
