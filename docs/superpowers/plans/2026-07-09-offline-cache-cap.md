# Offline Cache Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap the offline recent-order cache at 100 orders while preserving recent-order safety and making the offline status message clearly say an internet connection is needed.

**Architecture:** Keep the existing `localStorage` snapshot format and read path. Add a total cache limit at the save boundary, after desired-date-window and recent-order candidates are merged and sorted. Update only the existing app-level offline message constant for the visible copy change.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, browser `localStorage`.

## Global Constraints

- Always include the 30 most recently updated orders.
- Include orders inside the existing desired shipping window.
- Deduplicate by order id.
- Sort the combined set by `updatedAt` descending.
- Store at most 100 orders total.
- Keep existing workspace id, TTL, shape validation, and read-only offline behavior.
- Update the offline status message so it clearly tells the owner that an internet connection is required for normal work.
- Do not add IndexedDB, multi-snapshot storage, offline mutation queueing, offline editing, offline search, repository load changes, or Supabase synchronization changes.
- Storage failures remain non-fatal.
- Date parsing failures, relative dates, and invalid desired dates remain excluded from the desired-shipping-window selection.

---

## File Structure

- Modify `src/domain/localDraftCache.ts`
  - Responsibility: draft and recent-order offline cache persistence.
  - Add `RECENT_ORDER_CACHE_LIMIT = 100`.
  - Apply the cap inside `saveRecentOrderCache` only.

- Modify `src/domain/localDraftCache.test.ts`
  - Responsibility: domain-level storage behavior tests.
  - Add focused tests proving the 100-order cap and recent-30 preservation.

- Modify `src/App.tsx`
  - Responsibility: app shell and offline fallback status copy.
  - Update `OFFLINE_CACHE_STATUS_MESSAGE`.

No new files are required for implementation.

---

### Task 1: Cap Recent-Order Cache at 100 Orders

**Files:**
- Modify: `src/domain/localDraftCache.ts:7-8`
- Modify: `src/domain/localDraftCache.ts:223-227`
- Test: `src/domain/localDraftCache.test.ts:165`

**Interfaces:**
- Consumes: `saveRecentOrderCache(workspaceId: string, orders: CapturedOrder[], now?: Date): void`
- Consumes: `loadRecentOrderCache(workspaceId: string, now?: Date): CapturedOrder[]`
- Produces: unchanged public API; `saveRecentOrderCache` stores at most 100 merged candidate orders.

- [ ] **Step 1: Write the failing cap test**

Add this test after the existing `caches date-window orders plus the 30 most recently updated orders and sorts by updatedAt desc` test in `src/domain/localDraftCache.test.ts`:

```typescript
  it('caps the recent-order cache at 100 orders after combining date-window and recent orders', () => {
    const dateWindowOrders = Array.from({ length: 120 }, (_, index) =>
      createOrder({
        id: `date-window-${index}`,
        desiredDateTime: '2026-07-20',
        updatedAt: `2026-06-${String(1 + (index % 28)).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );

    const recentOrders = Array.from({ length: 30 }, (_, index) =>
      createOrder({
        id: `recent-cap-${index}`,
        desiredDateTime: '2026-12-31',
        updatedAt: `2026-07-${String(6 - Math.floor(index / 24)).padStart(2, '0')}T${String(
          23 - (index % 24),
        ).padStart(2, '0')}:00:00.000Z`,
      }),
    );

    saveRecentOrderCache('workspace-1', [...dateWindowOrders, ...recentOrders]);

    const cachedOrders = loadRecentOrderCache('workspace-1');
    const cachedIds = cachedOrders.map((order) => order.id);

    expect(cachedOrders).toHaveLength(100);
    expect(recentOrders.every((order) => cachedIds.includes(order.id))).toBe(true);

    const stored = JSON.parse(localStorage.getItem('lyru-oms.recentOrderCache.v1') ?? '{}');
    expect(stored.orders).toHaveLength(100);
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm test -- src/domain/localDraftCache.test.ts --run
```

Expected: FAIL. The new test should fail because `cachedOrders` currently has more than 100 orders.

- [ ] **Step 3: Add the cache limit constant**

In `src/domain/localDraftCache.ts`, replace the constant block with:

```typescript
const ORDER_DRAFT_KEY = 'lyru-oms.orderDraft.v1';
const RECENT_ORDER_CACHE_KEY = 'lyru-oms.recentOrderCache.v1';
const DAY_MS = 86_400_000;
const RECENT_ORDER_LIMIT = 30;
const RECENT_ORDER_CACHE_LIMIT = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
```

- [ ] **Step 4: Apply the cap when writing the payload**

In `src/domain/localDraftCache.ts`, replace the payload creation in `saveRecentOrderCache` with:

```typescript
  const payload: RecentOrderCachePayload = {
    workspaceId,
    cachedAt: now.toISOString(),
    orders: sortByUpdatedDesc([...selectedOrdersById.values()]).slice(0, RECENT_ORDER_CACHE_LIMIT),
  };
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```powershell
npm test -- src/domain/localDraftCache.test.ts --run
```

Expected: PASS. Existing `localDraftCache` tests and the new cap test pass.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add src/domain/localDraftCache.ts src/domain/localDraftCache.test.ts
git commit -m "refactor: cap offline order cache"
```

Expected: commit succeeds with only the domain cache implementation and test changes.

---

### Task 2: Clarify Offline Internet-Connection Message

**Files:**
- Modify: `src/App.tsx:35-37`
- Test: existing regression suites `src/App.test.tsx` and `src/domain/localDraftCache.test.ts`

**Interfaces:**
- Consumes: existing `OFFLINE_CACHE_STATUS_MESSAGE` constant in `src/App.tsx`.
- Produces: visible offline-cache status copy that says internet connection is needed; no state or repository API changes.

- [ ] **Step 1: Update the offline status message**

In `src/App.tsx`, replace:

```typescript
const OFFLINE_CACHE_STATUS_MESSAGE = '오프라인 상태입니다. 최근 주문을 읽기 전용으로 보여드려요.';
```

with:

```typescript
const OFFLINE_CACHE_STATUS_MESSAGE = '인터넷 연결이 필요합니다. 최근 주문은 읽기 전용으로만 확인할 수 있어요.';
```

Leave this line unchanged:

```typescript
const READ_ONLY_CACHE_MUTATION_MESSAGE = '오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.';
```

- [ ] **Step 2: Run App regression tests**

Run:

```powershell
npm test -- src/App.test.tsx --run
```

Expected: PASS. If a test asserts the old Korean copy exactly, update that assertion to:

```typescript
expect(screen.getByText('인터넷 연결이 필요합니다. 최근 주문은 읽기 전용으로만 확인할 수 있어요.')).toBeInTheDocument();
```

Then rerun the same command and expect PASS.

- [ ] **Step 3: Run focused cache tests again**

Run:

```powershell
npm test -- src/domain/localDraftCache.test.ts --run
```

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm test -- --run
```

Expected: PASS.

Run:

```powershell
npm run build
```

Expected: PASS. A Vite chunk-size warning is acceptable if it matches the existing project behavior and no build error appears.

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add src/App.tsx src/App.test.tsx
git commit -m "copy: clarify offline cache connection message"
```

Expected: commit succeeds. If `src/App.test.tsx` did not need changes, run:

```powershell
git add src/App.tsx
git commit -m "copy: clarify offline cache connection message"
```

---

## Self-Review

Spec coverage:

- 100-order total cap is covered by Task 1.
- Recent 30 order preservation is covered by Task 1 test assertions.
- Existing snapshot format, workspace id, TTL, shape validation, and read-only fallback remain unchanged because Task 1 only slices the write payload and Task 2 only changes copy.
- Internet-connection offline message is covered by Task 2.
- Out-of-scope items remain excluded: no IndexedDB, queueing, offline editing/search, repository changes, or Supabase changes.

Placeholder scan:

- No placeholder tokens or incomplete implementation steps are present.
- Code-changing steps include exact replacement snippets.
- Test commands and expected outcomes are explicit.

Type consistency:

- Public cache signatures remain `saveRecentOrderCache(workspaceId: string, orders: CapturedOrder[], now?: Date): void` and `loadRecentOrderCache(workspaceId: string, now?: Date): CapturedOrder[]`.
- New constant name `RECENT_ORDER_CACHE_LIMIT` is only used inside `src/domain/localDraftCache.ts`.
