# Order List Default Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the order list quieter by hiding review-count labels, adding calculated production quantity badges, and improving view menu labels/tap targets.

**Architecture:** Keep behavior inside the existing `OrderList` component and add a small domain helper for confident pure-quantity calculation. Reuse the calendar quantity badge visual language so list/card/calendar views stay consistent.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS in `src/App.css`, existing order domain types.

---

## File Structure

- Modify `src/domain/orderQuantity.ts`: create a focused helper for pure production quantity calculation.
- Create `src/domain/orderQuantity.test.ts`: verify helper behavior without rendering UI.
- Modify `src/components/OrderList.tsx`: use short view labels, remove review-count pills from list/card rows, render calculated quantity badges.
- Modify `src/components/OrderList.test.tsx`: update expectations for quieter labels and view menu behavior.
- Modify `src/App.css`: expand view menu option touch target and style list quantity badges.
- Already updated `DESIGN.md`: keep order-list information density guidance aligned with implementation.

---

### Task 1: Add Pure Quantity Helper

**Files:**
- Create: `src/domain/orderQuantity.ts`
- Create: `src/domain/orderQuantity.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/domain/orderQuantity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CapturedOrder } from './orderTypes';
import { EMPTY_ORDER_FIELDS } from './orderTypes';
import { getPureProductionQuantity } from './orderQuantity';

function order(overrides: Partial<CapturedOrder>): CapturedOrder {
  return {
    id: 'order-1',
    source: '카카오톡 채널',
    rawText: '성함: 김리루',
    ...EMPTY_ORDER_FIELDS,
    menuMatches: [],
    quantityCandidates: [],
    parsedDate: null,
    manuallyEditedFields: [],
    reparseDifferences: [],
    missingFields: [],
    reviewReasons: [],
    warningLevel: 'none',
    status: '신규',
    createdAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('getPureProductionQuantity', () => {
  it('multiplies one known menu unit count by one set quantity', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBe(12);
  });

  it('uses piece quantity directly when the quantity candidate unit is 개', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [{ value: 12, unit: '개', rawText: '12개' }],
        }),
      ),
    ).toBe(12);
  });

  it('returns null when menu is ambiguous', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [
            { menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'family' },
            { menuId: 'roll-4', label: '곶감말이 4구', unitCount: 4, confidence: 'family' },
          ],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBeNull();
  });

  it('returns null when quantity is ambiguous', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [
            { value: 6, unit: '세트', rawText: '6세트' },
            { value: 12, unit: '개', rawText: '12개' },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('returns null when set quantity has no known menu unit count', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'custom', label: '맞춤 구성', unitCount: null, confidence: 'exact' }],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run helper tests to verify failure**

Run:

```bash
npm test -- src/domain/orderQuantity.test.ts
```

Expected: FAIL because `src/domain/orderQuantity.ts` does not exist.

- [ ] **Step 3: Add minimal helper implementation**

Create `src/domain/orderQuantity.ts`:

```ts
import type { CapturedOrder } from './orderTypes';

export const getPureProductionQuantity = (order: Pick<CapturedOrder, 'menuMatches' | 'quantityCandidates'>) => {
  if (order.quantityCandidates.length !== 1) {
    return null;
  }

  const [quantityCandidate] = order.quantityCandidates;

  if (quantityCandidate.unit === '개') {
    return quantityCandidate.value;
  }

  if (order.menuMatches.length !== 1) {
    return null;
  }

  const unitCount = order.menuMatches[0].unitCount;

  if (unitCount === null) {
    return null;
  }

  return unitCount * quantityCandidate.value;
};
```

- [ ] **Step 4: Run helper tests to verify pass**

Run:

```bash
npm test -- src/domain/orderQuantity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

```bash
git add src/domain/orderQuantity.ts src/domain/orderQuantity.test.ts
git commit -m "feat: add pure order quantity helper"
```

---

### Task 2: Update Order List Rendering

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Write failing list behavior tests**

Edit existing expectations in `src/components/OrderList.test.tsx`:

```ts
it('uses short labels for view mode choices', () => {
  renderOrderList();

  const viewGroup = openViewMenu();

  expect(within(viewGroup).getByRole('radio', { name: '목록형' })).toBeChecked();
  expect(within(viewGroup).getByRole('radio', { name: '카드형' })).toBeInTheDocument();
  expect(within(viewGroup).getByRole('radio', { name: '달력형' })).toBeInTheDocument();
  expect(within(viewGroup).queryByRole('radio', { name: '목록형 보기' })).not.toBeInTheDocument();
});

it('keeps view choice clickable from the visible text row', () => {
  renderOrderList();

  const viewGroup = openViewMenu();
  fireEvent.click(within(viewGroup).getByText('카드형'));

  fireEvent.click(screen.getByRole('button', { name: '보기' }));
  expect(screen.getByRole('radio', { name: '카드형' })).toBeChecked();
});

it('hides review reason counts in compact list mode', () => {
  renderOrderList({
    orders: [{ ...order, desiredDateTime: '7월 3일', fulfillmentType: '픽업', customerRequestNote: '리본 포장' }],
  });

  expect(screen.getAllByText('확인 필요')).toHaveLength(1);
  expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
  expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
  expect(screen.queryByText('정보 1개')).not.toBeInTheDocument();
  expect(screen.queryByText('확인 1개')).not.toBeInTheDocument();
});

it('hides review reason counts and missing-field raw text controls in card mode', () => {
  renderOrderList();

  fireEvent.click(screen.getByRole('button', { name: '보기' }));
  fireEvent.click(screen.getByRole('radio', { name: '카드형' }));

  expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
  expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
  expect(screen.queryByText('정보 1개')).not.toBeInTheDocument();
  expect(screen.queryByText('확인 1개')).not.toBeInTheDocument();
  expect(screen.queryByText(/부족 항목:/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
});

it('shows a calculated production quantity badge in compact list mode', () => {
  renderOrderList({
    orders: [
      {
        ...order,
        orderItems: '곶감말이 2구',
        quantity: '6세트',
        menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
        quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
      },
    ],
  });

  const compactOrderButton = screen.getByRole('button', { name: /곶감말이 2구 · 6세트/ });
  expect(within(compactOrderButton).getByText('12')).toHaveClass('orderQuantityBadge');
});

it('omits the production quantity badge when quantity cannot be calculated', () => {
  renderOrderList({
    orders: [
      {
        ...order,
        orderItems: '맞춤 구성',
        quantity: '6세트',
        menuMatches: [{ menuId: 'custom', label: '맞춤 구성', unitCount: null, confidence: 'exact' }],
        quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
      },
    ],
  });

  const compactOrderButton = screen.getByRole('button', { name: /맞춤 구성 · 6세트/ });
  expect(within(compactOrderButton).queryByText('12')).not.toBeInTheDocument();
  expect(within(compactOrderButton).queryByText('수량 확인')).not.toBeInTheDocument();
});

it('emphasizes the production quantity badge when the bulk threshold reason exists', () => {
  renderOrderList({
    orders: [
      {
        ...order,
        orderItems: '화과자 9구',
        quantity: '5세트',
        menuMatches: [{ menuId: 'wagashi-9', label: '화과자 9구', unitCount: 9, confidence: 'exact' }],
        quantityCandidates: [{ value: 5, unit: '세트', rawText: '5세트' }],
        reviewReasons: [
          ...order.reviewReasons,
          {
            kind: '확인필요',
            group: 'check',
            code: 'bulk-real-unit',
            field: 'quantity',
            label: '대량 기준 가능성',
            message: '대량 기준에 해당할 수 있어 확인이 필요합니다.',
          },
        ],
      },
    ],
  });

  expect(screen.getByText('45')).toHaveClass('orderQuantityBadge', 'bulk');
});
```

Update old tests that reference `목록형 보기`, `카드형 보기`, or `달력형 보기` to use `목록형`, `카드형`, and `달력형`.

- [ ] **Step 2: Run list tests to verify failure**

Run:

```bash
npm test -- src/components/OrderList.test.tsx
```

Expected: FAIL because old labels and review-count pills still render, and quantity badges are not in list/card rows.

- [ ] **Step 3: Implement list rendering changes**

Modify `src/components/OrderList.tsx`:

```tsx
import { getPureProductionQuantity } from '../domain/orderQuantity';
```

Change `viewOptions`:

```tsx
const viewOptions: Array<{ mode: OrderListViewMode; label: string }> = [
  { mode: 'list', label: '목록형' },
  { mode: 'card', label: '카드형' },
  { mode: 'calendar', label: '달력형' },
];
```

Add helpers near `getOrderStatusClass`:

```tsx
const hasBulkQuantityReason = (order: CapturedOrder) =>
  order.reviewReasons.some((reason) => reason.code === 'bulk-real-unit');

const renderQuantityBadge = (order: CapturedOrder) => {
  const pureQuantity = getPureProductionQuantity(order);

  if (pureQuantity === null) {
    return null;
  }

  return (
    <span className={`orderQuantityBadge ${hasBulkQuantityReason(order) ? 'bulk' : ''}`} aria-label={`제작 수량 ${pureQuantity}`}>
      {pureQuantity}
    </span>
  );
};
```

Remove `summarizeReviewReasonGroups` usage from row render. Delete:

```tsx
const reasonSummaries = summarizeReviewReasonGroups(order);
```

Remove these blocks from compact and card rows:

```tsx
{reasonSummaries.map((summary) => (
  <span key={summary} className="reasonSummaryPill">
    {summary}
  </span>
))}
```

Render quantity badge next to summary text in compact mode:

```tsx
<span className="orderSummaryLine">
  <strong className="orderSummaryText">{summarizeOrder(order)}</strong>
  {renderQuantityBadge(order)}
</span>
```

Render quantity badge next to summary text in card mode:

```tsx
<span className="orderSummaryLine">
  <strong className="orderSummaryText">{summarizeOrder(order)}</strong>
  {renderQuantityBadge(order)}
</span>
```

Remove the card-mode missing-field raw text block:

```tsx
{viewMode === 'card' && order.missingFields.length > 0 ? (
  <div className="rawTextArea">
    ...
  </div>
) : null}
```

Keep `toggleRawText` and `expandedRawTextIds` only if no references remain outside the removed block. If unused after removal, delete both.

- [ ] **Step 4: Run list tests to verify pass**

Run:

```bash
npm test -- src/components/OrderList.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit rendering changes**

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx
git commit -m "feat: quiet order list labels"
```

---

### Task 3: Update Styling And Touch Targets

**Files:**
- Modify: `src/App.css`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Add style-sensitive class expectations**

In the existing quantity badge tests from Task 2, keep these assertions:

```ts
expect(within(compactOrderButton).getByText('12')).toHaveClass('orderQuantityBadge');
expect(screen.getByText('45')).toHaveClass('orderQuantityBadge', 'bulk');
```

The DOM class tests fail until CSS class names are rendered by Task 2.

- [ ] **Step 2: Update CSS**

Modify `src/App.css`:

```css
.sortMenuOption {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  border-radius: 6px;
  padding: 8px 10px;
  color: #3f3429;
  cursor: pointer;
  font-size: 13px;
}

.sortMenuOption span {
  flex: 1;
}
```

Add list quantity badge styles near `.calendarQuantityBadge` or row badge styles:

```css
.orderQuantityBadge {
  display: inline-flex;
  min-width: 18px;
  min-height: 18px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e0c892;
  border-radius: 999px;
  background: #f9efd6;
  color: #8a611f;
  padding: 1px 5px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
}

.orderQuantityBadge.bulk {
  border-color: #c69a3d;
  color: #5b4322;
  font-weight: 900;
}

.orderSummaryLine {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
```

If `.reasonSummaryPill` becomes unused, leave its CSS unless a search confirms no component uses it. Removing unused CSS is optional and should not block the task.

- [ ] **Step 3: Run tests and build**

Run:

```bash
npm test -- src/domain/orderQuantity.test.ts src/components/OrderList.test.tsx
npm run build
```

Expected: PASS for tests and build.

- [ ] **Step 4: Commit styling**

```bash
git add src/App.css src/components/OrderList.test.tsx
git commit -m "style: refine order list quantity badges"
```

---

### Task 4: Verification And Documentation Check

**Files:**
- Modify: `DESIGN.md` only if the implementation changed from the already written guidance.

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm test -- src/domain/orderQuantity.test.ts src/components/OrderList.test.tsx
npm run build
```

Expected: all commands PASS.

- [ ] **Step 2: Inspect git status**

Run:

```bash
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms status --short
```

Expected: only intentional files are modified or staged. `supabase/seed.owner-samples.sql` may remain as pre-existing unrelated work unless the user asks to include it.

- [ ] **Step 3: Commit design doc update if still uncommitted**

If `DESIGN.md` is modified and matches the implemented behavior:

```bash
git add DESIGN.md
git commit -m "docs: add order list density guidance"
```

- [ ] **Step 4: Final manual check**

Start the app:

```bash
npm run dev -- --port 5175
```

Open the local URL and verify:

- View menu shows `목록형`, `카드형`, `달력형`.
- Text row in the view menu switches modes.
- Compact list has no `정보 N개` or `확인 N개` labels.
- Card mode has no missing-field raw text block.
- Calculated quantity badges appear beside order summaries.
- Unconfirmed change request label still appears.

Stop the dev server after verification.

---

## Self-Review

- Spec coverage: display label reduction, detail-only review counts, calculated quantity badge, absent fallback quantity, bulk emphasis, short view labels, and expanded tap targets are covered by Tasks 1-4.
- Placeholder scan: no unresolved placeholder markers remain.
- Type consistency: helper accepts `Pick<CapturedOrder, 'menuMatches' | 'quantityCandidates'>`, and `OrderList` passes a full `CapturedOrder`, which is compatible.
