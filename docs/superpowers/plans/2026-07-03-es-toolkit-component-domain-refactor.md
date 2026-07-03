# es-toolkit Component and Domain Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `es-toolkit` only where it makes existing order detail and review-rule data transformations clearer without changing Lyru OMS behavior.

**Architecture:** Keep UI behavior unchanged. Apply es-toolkit first to small derived-data helpers in `OrderDetail`, then only continue to `reviewRules` if the refactor improves intent without weakening business-rule clarity. Leave `storage`, `orderSorting`, and `App` unchanged unless the implementation review finds an obvious, testable simplification.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, es-toolkit.

---

## File Structure

- Modify: `package.json`
  - Add `es-toolkit` to runtime dependencies.
- Modify: `package-lock.json`
  - Let `npm install es-toolkit` update the lockfile.
- Modify: `src/components/OrderDetail.tsx`
  - Use es-toolkit for field lookup and review reason grouping only if it keeps JSX unchanged and derived data clearer.
- Modify: `src/components/OrderDetail.test.tsx`
  - Lock current behavior for review reason grouping, fallback missing reasons, and reparse difference hints before refactoring.
- Modify: `src/domain/reviewRules.ts`
  - Optionally use es-toolkit for duplicate reason filtering or keyed collection handling, but keep quantity/date/business checks explicit.
- Modify: `src/domain/reviewRules.test.ts`
  - Lock current behavior before any domain refactor.
- Do not modify: `src/domain/storage.ts`
  - Keep current validators unless a specific type-safe simplification is identified during implementation.
- Do not modify: `src/domain/orderSorting.ts`
  - Keep current nullable-key sorting and recent fallback explicit.
- Do not modify: `src/App.tsx`
  - Keep current short `useMemo` derived-order logic unchanged.

---

### Task 1: Add es-toolkit Dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Inspect current dependency state**

Run:

```bash
npm view es-toolkit version
```

Expected: prints the latest available `es-toolkit` version.

- [ ] **Step 2: Install es-toolkit**

Run:

```bash
npm install es-toolkit
```

Expected: `package.json` includes `es-toolkit` in `dependencies`, and `package-lock.json` is updated.

- [ ] **Step 3: Verify package import shape**

Run:

```bash
node -e "import('es-toolkit').then((m)=>console.log(['groupBy','keyBy','partition'].map((k)=>`${k}:${typeof m[k]}`).join('\\n')))"
```

Expected:

```text
groupBy:function
keyBy:function
partition:function
```

- [ ] **Step 4: Commit dependency change**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: add es-toolkit dependency"
```

Expected: commit succeeds with only dependency files.

---

### Task 2: Lock OrderDetail Derived Data Behavior

**Files:**
- Modify: `src/components/OrderDetail.test.tsx`

- [ ] **Step 1: Add tests for current review reason and reparse hint behavior**

Add these tests near the existing `OrderDetail` behavior tests. The file already has `baseOrder(overrides)`, so use that helper directly.

```tsx
it('does not duplicate fallback missing fields that already have info reasons', () => {
  const order = baseOrder({
    missingFields: ['customerName', 'quantity'],
    reviewReasons: [
      {
        kind: '정보 부족',
        group: 'info',
        code: 'missing-field',
        field: 'customerName',
        label: '고객명',
        message: '고객명 정보가 비어 있어요.',
      },
      {
        kind: '확인필요',
        group: 'check',
        code: 'delivery-check',
        field: 'fulfillmentType',
        label: '택배 가능 여부',
        message: '택배 가능 여부를 확인해야 합니다.',
      },
    ],
  });

  render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

  const reviewBox = screen.getByLabelText('확인 필요 사유');

  expect(within(reviewBox).getByText('고객명')).toBeInTheDocument();
  expect(within(reviewBox).getByText('수량')).toBeInTheDocument();
  expect(within(reviewBox).getAllByText('고객명')).toHaveLength(1);
  expect(within(reviewBox).getByText('택배 가능 여부')).toBeInTheDocument();
});

it('shows reparse hints on fields by field key', () => {
  render(
    <OrderDetail
      order={baseOrder({
        reparseDifferences: [
          { field: 'quantity', extractedValue: '3세트' },
          { field: 'desiredDateTime', extractedValue: '2026-07-08 14:00' },
        ],
      })}
      settings={DEFAULT_SETTINGS}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  expect(screen.getByLabelText('새 추출값: 3세트')).toBeInTheDocument();
  expect(screen.getByLabelText('새 추출값: 2026-07-08 14:00')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused OrderDetail tests and confirm they pass before refactor**

Run:

```bash
npm test -- --run src/components/OrderDetail.test.tsx
```

Expected: all `OrderDetail` tests pass. If a selector conflicts with existing duplicated label text, adjust the assertion to a stable accessible label that already exists in the rendered DOM.

- [ ] **Step 3: Commit behavior-lock tests**

Run:

```bash
git add src/components/OrderDetail.test.tsx
git commit -m "test: lock order detail derived data behavior"
```

Expected: commit succeeds with only `OrderDetail` tests.

---

### Task 3: Refactor OrderDetail Derived Data With es-toolkit

**Files:**
- Modify: `src/components/OrderDetail.tsx`
- Test: `src/components/OrderDetail.test.tsx`

- [ ] **Step 1: Replace field lookup and grouping setup**

In `src/components/OrderDetail.tsx`, add the es-toolkit imports:

```tsx
import { groupBy, keyBy } from 'es-toolkit';
```

Keep the existing React and domain imports.

- [ ] **Step 2: Update `mergeInfoReasonsWithMissingFields`**

Replace the current function body with this implementation:

```tsx
const mergeInfoReasonsWithMissingFields = (infoReasons: ReviewReason[], missingFields: OrderFieldKey[]) => {
  const infoReasonsByField = keyBy(
    infoReasons.filter((reason): reason is ReviewReason & { field: OrderFieldKey } => Boolean(reason.field)),
    (reason) => reason.field,
  );
  const supplementalMissingFields = missingFields.filter((field) => !infoReasonsByField[field]);

  return [...infoReasons, ...buildFallbackMissingReasons(supplementalMissingFields)];
};
```

Expected: `keyBy` replaces the manual `Set` while preserving "do not duplicate fallback missing reasons for fields that already have info reasons."

- [ ] **Step 3: Update derived values inside `OrderDetail`**

Replace:

```tsx
const differenceByField = new Map(order.reparseDifferences.map((difference) => [difference.field, difference]));
const infoReasons = order.reviewReasons.filter((reason) => reason.group === 'info');
const checkReasons = order.reviewReasons.filter((reason) => reason.group === 'check');
```

with:

```tsx
const differenceByField = keyBy(order.reparseDifferences, (difference) => difference.field);
const reasonsByGroup = groupBy(order.reviewReasons, (reason) => reason.group);
const infoReasons = reasonsByGroup.info ?? [];
const checkReasons = reasonsByGroup.check ?? [];
```

- [ ] **Step 4: Update reparse difference reads**

Replace:

```tsx
const difference = differenceByField.get(field);
```

with:

```tsx
const difference = differenceByField[field];
```

Expected: rendering remains unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- --run src/components/OrderDetail.test.tsx
```

Expected: all `OrderDetail` tests pass.

- [ ] **Step 6: Commit OrderDetail refactor**

Run:

```bash
git add src/components/OrderDetail.tsx
git commit -m "refactor: use es-toolkit in order detail derivations"
```

Expected: commit succeeds with only `OrderDetail.tsx`.

---

### Task 4: Lock ReviewRules Behavior Before Optional Refactor

**Files:**
- Modify: `src/domain/reviewRules.test.ts`

- [ ] **Step 1: Add tests for duplicate reason preservation and generated reason grouping**

Add these tests near the existing `evaluateOrder` tests. The file already has `order(overrides)`, so use that helper directly. Some adjacent tests already cover duplicate preservation and minimum-order behavior; these assertions tighten the current behavior around regenerated info reasons and quantity rule labels before refactoring.

```ts
it('preserves duplicate raw text reasons while regenerating missing field reasons', () => {
  const evaluated = evaluateOrder(
    order({
      orderItems: '',
      quantity: '',
      desiredDateTime: '2026-07-08',
      fulfillmentType: '픽업',
      reviewReasons: [
        {
          kind: '중복 가능성',
          group: 'check',
          code: 'duplicate-raw-text',
          label: '중복 가능성',
          message: '비슷한 원문이 이미 있습니다.',
        },
      ],
    }),
    DEFAULT_SETTINGS,
  );

  expect(evaluated.reviewReasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: '중복 가능성', code: 'duplicate-raw-text' }),
      expect.objectContaining({ kind: '정보 부족', group: 'info', field: 'orderItems' }),
      expect.objectContaining({ kind: '정보 부족', group: 'info', field: 'quantity' }),
    ]),
  );
  expect(evaluated.status).toBe('확인 필요');
});

it('keeps quantity business rule reasons explicit', () => {
  const evaluated = evaluateOrder(
    order({
      orderItems: '화과자 4구',
      quantity: '1세트',
      desiredDateTime: '2026-07-08',
      fulfillmentType: '픽업',
      menuMatches: [{ menuId: 'hwagwaja-4', label: '화과자 4구', unitCount: 4, confidence: 'exact' }],
      quantityCandidates: [{ value: 1, unit: '세트', rawText: '1세트' }],
    }),
    DEFAULT_SETTINGS,
  );

  expect(evaluated.reviewReasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: '확인필요',
        group: 'check',
        code: 'minimum-order',
        field: 'quantity',
      }),
    ]),
  );
});
```

- [ ] **Step 2: Run focused reviewRules tests before refactor**

Run:

```bash
npm test -- --run src/domain/reviewRules.test.ts
```

Expected: all `reviewRules` tests pass.

- [ ] **Step 3: Commit behavior-lock tests**

Run:

```bash
git add src/domain/reviewRules.test.ts
git commit -m "test: lock review rule behavior"
```

Expected: commit succeeds with only `reviewRules` tests.

---

### Task 5: Refactor Only Safe ReviewRules Collections

**Files:**
- Modify: `src/domain/reviewRules.ts`
- Test: `src/domain/reviewRules.test.ts`

- [ ] **Step 1: Add es-toolkit import**

In `src/domain/reviewRules.ts`, add:

```ts
import { partition } from 'es-toolkit';
```

- [ ] **Step 2: Refactor duplicate reason separation only**

Replace `createReviewReasons` with a version that uses `partition` to make duplicate preservation explicit:

```ts
const createReviewReasons = (
  order: CapturedOrder,
  settings: OrderSettings,
  missingFields: Set<OrderFieldKey>,
): ReviewReason[] => {
  const [duplicateReasons] = partition(order.reviewReasons, isDuplicateReason);

  return [
    ...duplicateReasons.map(hydrateDuplicateReason),
    ...[...missingFields].map(createMissingFieldReason),
    ...createCheckReasons(order, settings),
  ];
};
```

Expected: only duplicate reason separation changes. Do not alter `createQuantityReviewReasons`, `createCheckReasons`, or `evaluateOrder` missing field loops.

- [ ] **Step 3: Run focused reviewRules tests**

Run:

```bash
npm test -- --run src/domain/reviewRules.test.ts
```

Expected: all `reviewRules` tests pass.

- [ ] **Step 4: Commit reviewRules refactor**

Run:

```bash
git add src/domain/reviewRules.ts
git commit -m "refactor: clarify review reason separation"
```

Expected: commit succeeds with only `reviewRules.ts`.

---

### Task 6: Full Verification and UI Smoke Check

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript build and Vite build both pass.

- [ ] **Step 3: Run mobile and desktop smoke checks if `OrderDetail` rendering changed**

Start a local preview or static server using the repo's existing workflow. Then verify:

```text
Mobile viewport:
- order list still opens an order detail modal
- review reason box still shows info/check groups
- reparse hint markers still appear on edited fields
- modal close button still works

Desktop viewport:
- order detail modal layout is unchanged
- no horizontal overflow appears
- status select and change request control still work
```

- [ ] **Step 4: Check final git state**

Run:

```bash
git status --short --branch
```

Expected: clean working tree, with local branch ahead by the commits created in this plan.

---

## Self-Review

- Spec coverage: The plan covers dependency addition, `OrderDetail` derived data, optional `reviewRules` collection separation, tests, build verification, and mobile/desktop smoke checks. It intentionally excludes `storage`, `orderSorting`, and `App` unless a later implementation review finds a concrete simplification.
- Placeholder scan: No placeholder implementation steps remain. Every code-changing step includes exact code or exact expected assertions.
- Type consistency: The plan uses existing project types: `CapturedOrder`, `OrderFieldKey`, `ReviewReason`, `DEFAULT_SETTINGS`, `evaluateOrder`, and current Korean statuses/reason groups.
