# Safe Refactor Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a small, behavior-preserving refactor slice that reduces repeated client-side work and cleans build-only dependencies.

**Architecture:** Keep public component and domain APIs stable where possible. Optimize by precomputing derived values with `useMemo` or decorate-sort-undecorate patterns, and avoid runtime behavior changes to Supabase, auth, offline cache, and UI flows.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Supabase JS.

---

## File Structure

- Modify: `src/domain/orderSorting.ts` - precompute `recentTime` during sorting.
- Modify: `src/domain/orderSorting.test.ts` - lock behavior for invalid `createdAt` and tie-break ordering.
- Modify: `src/domain/parser.ts` - export raw-text duplicate normalization helper and support `Set`-based duplicate checks.
- Modify: `src/components/OrderCaptureForm.tsx` - accept normalized duplicate keys instead of raw text arrays.
- Modify: `src/components/OrderCaptureForm.test.tsx` - update props and preserve duplicate warning coverage.
- Modify: `src/App.tsx` - memoize normalized duplicate keys from orders before rendering capture form.
- Modify: `src/components/OrderList.tsx` - memoize calendar-mode derived data.
- Modify: `src/components/OrderList.test.tsx` - add regression coverage that calendar output remains stable across unrelated menu state changes.
- Modify: `package.json` - move Vite and TypeScript build tools to `devDependencies`.
- Modify: `package-lock.json` - update dependency metadata using npm.
- Modify: `tsconfig.json` - add incremental typecheck cache under `node_modules/.tmp/`.

---

### Task 1: Precompute Order Sort Timestamps

**Files:**
- Modify: `src/domain/orderSorting.ts`
- Modify: `src/domain/orderSorting.test.ts`

- [ ] **Step 1: Add behavior tests for recent fallback stability**

Append these tests inside the existing `describe('orderSorting', () => { ... })` block in `src/domain/orderSorting.test.ts`, before the final closing `});`:

```ts
  it('keeps invalid created dates at the oldest end for recent sorting', () => {
    const orders = [
      order({ id: 'valid-old', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'invalid', createdAt: 'not-a-date' }),
      order({ id: 'valid-new', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'recent'))).toEqual(['valid-new', 'valid-old', 'invalid']);
  });

  it('uses recent registration as the tie-breaker after primary sort keys match', () => {
    const orders = [
      order({ id: 'old-same-date', desiredDateTime: '2026-07-03', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'new-same-date', desiredDateTime: '2026-07-03', createdAt: '2026-07-02T00:00:00.000Z' }),
      order({ id: 'earlier', desiredDateTime: '2026-07-02', createdAt: '2026-07-01T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'desiredDate'))).toEqual(['earlier', 'new-same-date', 'old-same-date']);
  });
```

- [ ] **Step 2: Run the focused test before implementation**

Run:

```bash
npm test -- src/domain/orderSorting.test.ts --run
```

Expected: PASS. These are characterization tests for current behavior.

- [ ] **Step 3: Refactor `sortOrders` to decorate once**

In `src/domain/orderSorting.ts`, replace:

```ts
const compareRecent = (a: CapturedOrder, b: CapturedOrder) => getRecentTime(b) - getRecentTime(a);
```

with:

```ts
const compareRecentTimes = (aTime: number, bTime: number) => bTime - aTime;
```

Keep the existing `type SortKey = number | null;`.

After `getSortKey`, add:

```ts
interface KeyedOrder {
  order: CapturedOrder;
  key: SortKey;
  recentTime: number;
}

const createKeyedOrder = (order: CapturedOrder, mode: Exclude<OrderSortMode, 'recent'>): KeyedOrder => ({
  order,
  key: getSortKey(order, mode),
  recentTime: getRecentTime(order),
});
```

Then replace the whole existing `sortOrders` function with:

```ts
export const sortOrders = (orders: CapturedOrder[], mode: OrderSortMode): CapturedOrder[] => {
  if (mode === 'recent') {
    return orders
      .map((order) => ({ order, recentTime: getRecentTime(order) }))
      .sort((a, b) => compareRecentTimes(a.recentTime, b.recentTime))
      .map((item) => item.order);
  }

  const direction = mode === 'quantityDesc' ? 'desc' : 'asc';
  const keyedOrders = orders.map((order) => createKeyedOrder(order, mode));

  keyedOrders.sort((a, b) => compareNullableKeys(a.key, b.key, direction) || compareRecentTimes(a.recentTime, b.recentTime));

  return keyedOrders.map((item) => item.order);
};
```

Do not change `getRecentTime`, `getSortKey`, or `compareNullableKeys`.

- [ ] **Step 4: Run focused sorting tests**

Run:

```bash
npm test -- src/domain/orderSorting.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/domain/orderSorting.ts src/domain/orderSorting.test.ts
git commit -m "refactor: precompute order sort timestamps"
```

---

### Task 2: Memoize Duplicate Raw Text Keys

**Files:**
- Modify: `src/domain/parser.ts`
- Modify: `src/domain/parser.test.ts`
- Modify: `src/components/OrderCaptureForm.tsx`
- Modify: `src/components/OrderCaptureForm.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add parser tests for normalized key behavior**

In `src/domain/parser.test.ts`, change the parser import to:

```ts
import { createRawTextDuplicateKey, hasSimilarRawText, parseRawText } from './parser';
```

Add this helper after the imports:

```ts
const rawTextKeys = (values: string[]) => new Set(values.map(createRawTextDuplicateKey));
```

Add this test as the first test inside `describe('hasSimilarRawText', () => { ... })`:

```ts
  it('normalizes raw text duplicate keys with width, case, and whitespace folding', () => {
    expect(createRawTextDuplicateKey(' 성함:  김리루\n수량: ５세트 ')).toBe('성함: 김리루 수량: 5세트');
  });
```

Update the existing `hasSimilarRawText` tests to pass `Set` values:

```ts
  it('flags normalized exact raw text as duplicate possibility', () => {
    expect(hasSimilarRawText('성함: 김리루\n수량: 5', rawTextKeys([' 성함: 김리루 수량: 5 ']))).toBe(true);
  });

  it('does not flag punctuation or phone-format differences as duplicate', () => {
    expect(hasSimilarRawText('전화번호: 010-1111-2222', rawTextKeys(['전화번호 01011112222']))).toBe(false);
  });

  it('does not flag unrelated messages', () => {
    expect(hasSimilarRawText('성함: 김리루', rawTextKeys(['성함: 박화과']))).toBe(false);
  });
```

- [ ] **Step 2: Run parser test to verify it fails**

Run:

```bash
npm test -- src/domain/parser.test.ts --run
```

Expected: FAIL with `createRawTextDuplicateKey` missing.

- [ ] **Step 3: Export normalized duplicate key helper**

In `src/domain/parser.ts`, replace:

```ts
const normalizeRawTextForExactDuplicate = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
```

with:

```ts
export const createRawTextDuplicateKey = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
```

Then replace `hasSimilarRawText` with:

```ts
export const hasSimilarRawText = (rawText: string, existingRawTextKeys: ReadonlySet<string>) => {
  const normalizedRawText = createRawTextDuplicateKey(rawText);

  return existingRawTextKeys.has(normalizedRawText);
};
```

- [ ] **Step 4: Update `OrderCaptureForm` props**

In `src/components/OrderCaptureForm.tsx`, keep the parser import as:

```ts
import { hasSimilarRawText, parseRawText } from '../domain/parser';
```

Change props:

```ts
interface OrderCaptureFormProps {
  existingRawTextKeys: ReadonlySet<string>;
  settings: OrderSettings;
  source: OrderSource;
  initialRawText?: string;
  onSave: (order: CapturedOrder) => void | boolean | Promise<void | boolean>;
}
```

Change function destructuring:

```ts
export function OrderCaptureForm({
  existingRawTextKeys,
  settings,
  source,
  initialRawText = '',
  onSave,
}: OrderCaptureFormProps) {
```

Change duplicate check:

```ts
  const isDuplicate = rawText.trim() !== '' && hasSimilarRawText(rawText, existingRawTextKeys);
```

- [ ] **Step 5: Update capture form tests**

In `src/components/OrderCaptureForm.test.tsx`, add this import:

```ts
import { createRawTextDuplicateKey } from '../domain/parser';
```

Add this helper near `createDeferred`:

```ts
const rawTextKeys = (values: string[]) => new Set(values.map(createRawTextDuplicateKey));
```

Replace every `existingRawTexts={[]}` with:

```tsx
existingRawTextKeys={rawTextKeys([])}
```

Replace:

```tsx
existingRawTexts={['성함: 김리루']}
```

with:

```tsx
existingRawTextKeys={rawTextKeys(['성함: 김리루'])}
```

- [ ] **Step 6: Memoize duplicate keys in `WorkspaceApp`**

In `src/App.tsx`, add parser import:

```ts
import { createRawTextDuplicateKey } from './domain/parser';
```

After `filteredOrders` memo, add:

```ts
  const existingRawTextKeys = useMemo(
    () => new Set(orders.map((order) => createRawTextDuplicateKey(order.rawText))),
    [orders],
  );
```

Update `OrderCaptureForm` props:

```tsx
                <OrderCaptureForm
                  existingRawTextKeys={existingRawTextKeys}
                  settings={settings}
                  source={captureSource}
                  initialRawText={savedOrderDraft?.rawText}
                  onSave={handleSaveOrder}
                />
```

- [ ] **Step 7: Run focused duplicate tests**

Run:

```bash
npm test -- src/domain/parser.test.ts src/components/OrderCaptureForm.test.tsx src/App.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add src/domain/parser.ts src/domain/parser.test.ts src/components/OrderCaptureForm.tsx src/components/OrderCaptureForm.test.tsx src/App.tsx
git commit -m "refactor: memoize raw text duplicate keys"
```

---

### Task 3: Memoize Calendar Derived Data

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Add regression test for calendar output after menu state changes**

Append this test inside `describe('OrderList', () => { ... })` in `src/components/OrderList.test.tsx`:

```ts
  it('keeps calendar range output stable after unrelated toolbar menu changes', () => {
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'stable-calendar-range',
          customerName: '박기간',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-03',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형' }));

    expect(screen.getByRole('button', { name: /곶감단지 수량 2.*마감/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '정렬' }));
    fireEvent.click(screen.getByRole('button', { name: '채널: 전체' }));

    expect(screen.getByRole('button', { name: /곶감단지 수량 2.*마감/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run focused OrderList test before implementation**

Run:

```bash
npm test -- src/components/OrderList.test.tsx --run
```

Expected: PASS. This locks current behavior before memoization.

- [ ] **Step 3: Add memoized calendar derivation before the calendar branch**

In `src/components/OrderList.tsx`, after `calendarData` `useMemo`, add:

```ts
  const calendarWindow = useMemo(
    () => (viewMode === 'calendar' && calendarRangeMode !== 'day' ? getCalendarWindow(calendarRangeMode, todayIsoDate) : null),
    [calendarRangeMode, todayIsoDate, viewMode],
  );
  const calendarSegments = useMemo(
    () =>
      calendarWindow
        ? buildRangeSegments(calendarData.rangeItems, calendarWindow.rows, calendarWindow.startDate, calendarWindow.endDate)
        : [],
    [calendarData.rangeItems, calendarWindow],
  );
  const segmentsByRow = useMemo(() => groupBy(calendarSegments, (segment) => segment.rowId), [calendarSegments]);
  const dailyItems = useMemo(
    () => (viewMode === 'calendar' && calendarRangeMode === 'day' ? buildDailyItems(calendarData.rangeItems, todayIsoDate) : []),
    [calendarData.rangeItems, calendarRangeMode, todayIsoDate, viewMode],
  );
```

Then remove these local declarations from inside `if (viewMode === 'calendar')`:

```ts
    const calendarWindow = calendarRangeMode === 'day' ? null : getCalendarWindow(calendarRangeMode, todayIsoDate);
    const calendarSegments = calendarWindow
      ? buildRangeSegments(calendarData.rangeItems, calendarWindow.rows, calendarWindow.startDate, calendarWindow.endDate)
      : [];
    const segmentsByRow = groupBy(calendarSegments, (segment) => segment.rowId);
    const dailyItems = calendarRangeMode === 'day' ? buildDailyItems(calendarData.rangeItems, todayIsoDate) : [];
```

- [ ] **Step 4: Run focused OrderList tests**

Run:

```bash
npm test -- src/components/OrderList.test.tsx --run
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx
git commit -m "refactor: memoize order calendar data"
```

---

### Task 4: Build Dependency Hygiene

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Move build tools with npm**

Run:

```bash
npm install --save-dev @vitejs/plugin-react@^4.3.4 typescript@^5.7.2 vite@^6.0.7
```

Expected: `package.json` has `@vitejs/plugin-react`, `typescript`, and `vite` under `devDependencies`, not `dependencies`. `package-lock.json` updates accordingly.

- [ ] **Step 2: Add TypeScript incremental cache**

In `tsconfig.json`, add these compiler options after `"noEmit": true`:

```json
    "incremental": true,
    "tsBuildInfoFile": "node_modules/.tmp/tsconfig.app.tsbuildinfo",
```

Resulting section should look like:

```json
    "isolatedModules": true,
    "noEmit": true,
    "incremental": true,
    "tsBuildInfoFile": "node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "jsx": "react-jsx"
```

- [ ] **Step 3: Verify dependency placement**

Run:

```bash
npm pkg get dependencies devDependencies
```

Expected:

- `dependencies` includes `@supabase/supabase-js`, `es-toolkit`, `react`, `react-day-picker`, `react-dom`.
- `devDependencies` includes `@vitejs/plugin-react`, `typescript`, `vite`, Vitest, Testing Library, and type packages.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS. Vite chunk-size warning is acceptable.

- [ ] **Step 5: Ensure generated build info is not tracked**

Run:

```bash
git status --short
```

Expected: no tracked `node_modules/.tmp/tsconfig.app.tsbuildinfo`. If it appears, stop and inspect `.gitignore`; do not commit generated build cache.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: move build tools to dev dependencies"
```

---

### Task 5: Final Verification

**Files:**
- Verify all changed files from Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/domain/orderSorting.test.ts src/domain/parser.test.ts src/components/OrderCaptureForm.test.tsx src/components/OrderList.test.tsx src/App.test.tsx --run
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

Expected: PASS. Vite chunk-size warning is acceptable.

- [ ] **Step 4: Check formatting-sensitive diff issues**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Review final branch history**

Run:

```bash
git log --oneline --max-count=8
git status --short --branch
```

Expected: working tree clean, branch ahead by task commits.
