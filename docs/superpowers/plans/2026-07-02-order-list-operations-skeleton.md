# Order List Operations Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1에서 저장된 주문을 희망일 기준 운영 대장으로 보여주고, 최소 상태값과 간단 변경 요청 확인 흐름을 추가한다.

**Architecture:** 도메인 타입과 저장소 hydrate에서 운영 상태와 변경 요청 기본값을 먼저 안정화한다. 정렬은 `src/domain/orderSorting.ts`로 분리하고 `App`이 `sortMode`와 `displayOrders`를 소유하며, `OrderList`는 정렬 UI와 표시만 담당한다. `OrderDetail`은 기존 편집 모달에 변경 요청 섹션과 새 상태값을 붙인다.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, localStorage.

---

## File Structure

- Modify: `src/domain/orderTypes.ts`
  - 운영 상태 4개와 `CapturedOrder` 변경 요청 필드를 정의한다.
- Modify: `src/domain/storage.ts`
  - 기존 상태값을 새 상태값으로 hydrate하고, 변경 요청 필드 기본값을 보정한다.
- Modify: `src/domain/reviewRules.ts`
  - `evaluateOrder`의 자동 `확인 필요` 전환 규칙을 새 상태값에 맞춘다.
- Create: `src/domain/orderSorting.ts`
  - 희망일/최근 등록/수량 정렬을 순수 함수로 제공한다.
- Create: `src/domain/orderSorting.test.ts`
  - 정렬 규칙과 수량 비교값을 검증한다.
- Modify: `src/domain/storage.test.ts`
  - 상태 마이그레이션과 변경 요청 필드 hydrate 테스트를 추가하고 기존 기대값을 갱신한다.
- Modify: `src/components/OrderList.tsx`
  - 정렬 선택 컨트롤과 변경 요청 배지를 표시한다.
- Modify: `src/components/OrderList.test.tsx`
  - 새 상태값, 변경 요청 배지, 정렬 컨트롤 렌더링을 검증한다.
- Modify: `src/components/OrderDetail.tsx`
  - 변경 요청 메모/확인 체크 섹션을 추가하고 원문 영역을 하단으로 이동한다.
- Modify: `src/components/OrderDetail.test.tsx`
  - 새 상태 선택지와 변경 요청 편집 동작을 검증한다.
- Modify: `src/App.tsx`
  - 목록 UI task에서 `sortMode` 상태와 `displayOrders` 계산을 추가한다.
- Modify: `src/App.test.tsx`
  - 정렬 옵션 변경과 상세 변경 요청 확인 후 배지 제거를 통합 검증한다.
- Modify: `src/App.css`
  - 목록 헤더 정렬 컨트롤, 변경 요청 섹션, 모바일 배치를 다듬는다.

---

### Task 1: 운영 상태와 저장 데이터 hydrate

**Files:**
- Modify: `src/domain/orderTypes.ts`
- Modify: `src/domain/storage.ts`
- Modify: `src/domain/reviewRules.ts`
- Test: `src/domain/storage.test.ts`
- Test: `src/components/OrderDetail.test.tsx`

- [ ] **Step 1: 저장소 실패 테스트 추가**

`src/domain/storage.test.ts`에 다음 테스트를 추가한다.

```ts
it('hydrates legacy order statuses into operating statuses', () => {
  localStorage.setItem(
    'lyru-oms.orders.v1',
    JSON.stringify([
      {
        ...EMPTY_ORDER_FIELDS,
        id: 'new',
        source: '카카오톡 채널',
        rawText: '신규 주문',
        status: '수집',
        menuMatches: [],
        quantityCandidates: [],
        parsedDate: null,
        manuallyEditedFields: [],
        reparseDifferences: [],
        missingFields: [],
        reviewReasons: [],
        warningLevel: 'none',
        createdAt: '2026-06-30T09:00:00.000Z',
        updatedAt: '2026-06-30T09:00:00.000Z',
      },
      {
        ...EMPTY_ORDER_FIELDS,
        id: 'attention',
        source: '카카오톡 채널',
        rawText: '확인 필요 주문',
        status: '확인필요',
        menuMatches: [],
        quantityCandidates: [],
        parsedDate: null,
        manuallyEditedFields: [],
        reparseDifferences: [],
        missingFields: [],
        reviewReasons: [],
        warningLevel: 'none',
        createdAt: '2026-06-30T09:00:00.000Z',
        updatedAt: '2026-06-30T09:00:00.000Z',
      },
      {
        ...EMPTY_ORDER_FIELDS,
        id: 'ready',
        source: '카카오톡 채널',
        rawText: '정리 완료 주문',
        status: '정리 완료',
        menuMatches: [],
        quantityCandidates: [],
        parsedDate: null,
        manuallyEditedFields: [],
        reparseDifferences: [],
        missingFields: [],
        reviewReasons: [],
        warningLevel: 'none',
        createdAt: '2026-06-30T09:00:00.000Z',
        updatedAt: '2026-06-30T09:00:00.000Z',
      },
    ]),
  );

  expect(loadOrders().map((order) => [order.id, order.status])).toEqual([
    ['new', '신규'],
    ['attention', '확인 필요'],
    ['ready', '제작 준비'],
  ]);
});

it('hydrates missing change request fields with safe defaults', () => {
  const legacyOrder = {
    ...EMPTY_ORDER_FIELDS,
    id: 'legacy-change',
    source: '카카오톡 채널',
    rawText: '성함: 김리루',
    status: '수집',
    menuMatches: [],
    quantityCandidates: [],
    parsedDate: null,
    manuallyEditedFields: [],
    reparseDifferences: [],
    missingFields: [],
    reviewReasons: [],
    warningLevel: 'none',
    createdAt: '2026-06-30T09:00:00.000Z',
    updatedAt: '2026-06-30T09:00:00.000Z',
  };

  localStorage.setItem('lyru-oms.orders.v1', JSON.stringify([legacyOrder]));

  expect(loadOrders()[0]).toEqual(
    expect.objectContaining({
      changeRequestNote: '',
      changeRequestConfirmed: false,
    }),
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/domain/storage.test.ts`

Expected: FAIL. TypeScript 또는 runtime에서 새 status/field 기대값이 아직 맞지 않아 실패한다.

- [ ] **Step 3: 운영 상태와 변경 요청 필드 타입 추가**

`src/domain/orderTypes.ts`를 다음 의도로 수정한다.

```ts
export const ORDER_STATUSES = ['신규', '확인 필요', '제작 준비', '발송 완료'] as const;

export interface CapturedOrder {
  id: string;
  source: OrderSource;
  rawText: string;
  customerName: string;
  phone: string;
  orderItems: string;
  quantity: string;
  purpose: string;
  fulfillmentType: FulfillmentType;
  desiredDateTime: string;
  pickupTime: string;
  address: string;
  allergyNote: string;
  options: string;
  customerRequestNote: string;
  ownerMemo: string;
  changeRequestNote: string;
  changeRequestConfirmed: boolean;
  menuMatches: MenuMatch[];
  quantityCandidates: QuantityCandidate[];
  parsedDate: ParsedDateValue | null;
  manuallyEditedFields: OrderFieldKey[];
  reparseDifferences: ReparseDifference[];
  missingFields: OrderFieldKey[];
  reviewReasons: ReviewReason[];
  warningLevel: WarningLevel;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: hydrate 마이그레이션 구현**

`src/domain/storage.ts`에서 status set과 hydrate를 다음처럼 조정한다.

```ts
const LEGACY_ORDER_STATUSES = new Set<string>(['수집', '확인필요', '정리 완료']);
const ORDER_STATUS_VALUES = new Set<string>([...ORDER_STATUSES, ...LEGACY_ORDER_STATUSES]);

const hydrateOrderStatus = (status: CapturedOrder['status'] | string): CapturedOrder['status'] => {
  if (status === '수집') {
    return '신규';
  }

  if (status === '확인필요') {
    return '확인 필요';
  }

  if (status === '정리 완료') {
    return '제작 준비';
  }

  return status as CapturedOrder['status'];
};
```

`hydrateStoredOrder` 반환 객체에 다음 필드를 포함한다.

```ts
return {
  ...EMPTY_ORDER_FIELDS,
  ...value,
  status: hydrateOrderStatus(value.status),
  changeRequestNote: typeof storedValue.changeRequestNote === 'string' ? storedValue.changeRequestNote : '',
  changeRequestConfirmed:
    typeof storedValue.changeRequestConfirmed === 'boolean' ? storedValue.changeRequestConfirmed : false,
  menuMatches: isMenuMatchArray(storedValue.menuMatches) ? (storedValue.menuMatches as MenuMatch[]) : [],
  quantityCandidates: isQuantityCandidateArray(storedValue.quantityCandidates)
    ? (storedValue.quantityCandidates as QuantityCandidate[])
    : [],
  parsedDate: isParsedDateValue(storedValue.parsedDate) ? (storedValue.parsedDate as ParsedDateValue | null) : null,
  reviewReasons: hydrateReviewReasons(storedValue.reviewReasons),
};
```

- [ ] **Step 5: evaluateOrder 상태 규칙 갱신**

`src/domain/reviewRules.ts`의 반환 status 계산을 새 상태값에 맞춘다.

```ts
const shouldKeepManualStatus = order.status === '제작 준비' || order.status === '발송 완료' || warningLevel === 'none';

return {
  ...order,
  missingFields: [...missingFields],
  reviewReasons,
  warningLevel,
  status: shouldKeepManualStatus ? order.status : '확인 필요',
};
```

- [ ] **Step 6: 기존 테스트 fixture 상태값 갱신**

`src/domain/storage.test.ts`, `src/components/OrderDetail.test.tsx`, `src/components/OrderList.test.tsx`의 `status: '수집'`, `status: '확인필요'`, `status: '정리 완료'` 타입 fixture를 각각 `신규`, `확인 필요`, `제작 준비`로 바꾼다. legacy hydrate 테스트의 raw localStorage 객체는 기존 문자열을 유지한다.

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test -- src/domain/storage.test.ts src/components/OrderDetail.test.tsx src/components/OrderList.test.tsx`

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/domain/orderTypes.ts src/domain/storage.ts src/domain/reviewRules.ts src/domain/storage.test.ts src/components/OrderDetail.test.tsx src/components/OrderList.test.tsx
git commit -m "feat: migrate orders to operating statuses"
```

---

### Task 2: 주문 정렬 도메인 유틸

**Files:**
- Create: `src/domain/orderSorting.ts`
- Create: `src/domain/orderSorting.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/domain/orderSorting.test.ts`를 만든다.

```ts
import { describe, expect, it } from 'vitest';
import { EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';
import { sortOrders, type OrderSortMode } from './orderSorting';

const order = (overrides: Partial<CapturedOrder>): CapturedOrder => ({
  ...EMPTY_ORDER_FIELDS,
  id: 'base',
  source: '카카오톡 채널',
  rawText: '성함: 김리루',
  status: '신규',
  menuMatches: [],
  quantityCandidates: [],
  parsedDate: null,
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: [],
  warningLevel: 'none',
  changeRequestNote: '',
  changeRequestConfirmed: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const ids = (orders: CapturedOrder[]) => orders.map((item) => item.id);

describe('orderSorting', () => {
  it('sorts by desired date first and falls back to recent registration for unknown dates', () => {
    const orders = [
      order({ id: 'unknown-old', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'later', desiredDateTime: '2026-07-05' }),
      order({ id: 'earlier', desiredDateTime: '2026-07-03' }),
      order({ id: 'unknown-new', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'desiredDate'))).toEqual(['earlier', 'later', 'unknown-new', 'unknown-old']);
  });

  it('sorts by recent registration', () => {
    const orders = [
      order({ id: 'old', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'new', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'recent'))).toEqual(['new', 'old']);
  });

  it('sorts by largest quantity using parsed candidates before quantity text', () => {
    const orders = [
      order({ id: 'text-12', quantity: '12세트' }),
      order({ id: 'parsed-40', quantity: '5세트', quantityCandidates: [{ value: 40, unit: '개', rawText: '40개' }] }),
      order({ id: 'unknown', quantity: '많이' }),
    ];

    expect(ids(sortOrders(orders, 'quantityDesc'))).toEqual(['parsed-40', 'text-12', 'unknown']);
  });

  it('does not mutate the input array', () => {
    const orders = [order({ id: 'b', desiredDateTime: '2026-07-05' }), order({ id: 'a', desiredDateTime: '2026-07-03' })];

    sortOrders(orders, 'desiredDate' satisfies OrderSortMode);

    expect(ids(orders)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/domain/orderSorting.test.ts`

Expected: FAIL because `src/domain/orderSorting.ts` does not exist.

- [ ] **Step 3: 정렬 유틸 구현**

`src/domain/orderSorting.ts`를 만든다.

```ts
import { parseExplicitDate } from './dateDisplay';
import type { CapturedOrder } from './orderTypes';

export type OrderSortMode = 'desiredDate' | 'recent' | 'quantityDesc';

const toTime = (isoDate: string) => {
  const time = new Date(isoDate).getTime();

  return Number.isFinite(time) ? time : 0;
};

const getDesiredDateTime = (order: CapturedOrder) => {
  const parsed = order.desiredDateTime.trim() ? parseExplicitDate(order.desiredDateTime) : order.parsedDate;

  if (!parsed || parsed.isRelative || !parsed.isoDate) {
    return null;
  }

  return toTime(`${parsed.isoDate}T${parsed.timeText || '00:00'}:00.000+09:00`);
};

export const getComparableQuantity = (order: CapturedOrder): number | null => {
  if (order.quantityCandidates.length > 0) {
    return Math.max(...order.quantityCandidates.map((candidate) => candidate.value));
  }

  const numericMatches = [...order.quantity.matchAll(/\d+/g)].map((match) => Number(match[0]));

  if (numericMatches.length === 0) {
    return null;
  }

  return Math.max(...numericMatches);
};

const compareRecent = (a: CapturedOrder, b: CapturedOrder) => toTime(b.createdAt) - toTime(a.createdAt);

const compareDesiredDate = (a: CapturedOrder, b: CapturedOrder) => {
  const aDate = getDesiredDateTime(a);
  const bDate = getDesiredDateTime(b);

  if (aDate !== null && bDate !== null && aDate !== bDate) {
    return aDate - bDate;
  }

  if (aDate !== null && bDate === null) {
    return -1;
  }

  if (aDate === null && bDate !== null) {
    return 1;
  }

  return compareRecent(a, b);
};

const compareQuantityDesc = (a: CapturedOrder, b: CapturedOrder) => {
  const aQuantity = getComparableQuantity(a);
  const bQuantity = getComparableQuantity(b);

  if (aQuantity !== null && bQuantity !== null && aQuantity !== bQuantity) {
    return bQuantity - aQuantity;
  }

  if (aQuantity !== null && bQuantity === null) {
    return -1;
  }

  if (aQuantity === null && bQuantity !== null) {
    return 1;
  }

  return compareRecent(a, b);
};

export const sortOrders = (orders: CapturedOrder[], mode: OrderSortMode): CapturedOrder[] =>
  [...orders].sort((a, b) => {
    if (mode === 'recent') {
      return compareRecent(a, b);
    }

    if (mode === 'quantityDesc') {
      return compareQuantityDesc(a, b);
    }

    return compareDesiredDate(a, b);
  });
```

- [ ] **Step 4: 정렬 테스트 통과 확인**

Run: `npm test -- src/domain/orderSorting.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domain/orderSorting.ts src/domain/orderSorting.test.ts
git commit -m "feat: add order sorting domain logic"
```

---

### Task 3: 목록 정렬 컨트롤과 변경 요청 배지

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: OrderList props 테스트 갱신**

`src/components/OrderList.test.tsx`의 `render(<OrderList ... />)` 호출에 다음 props를 모두 추가한다.

```tsx
sortMode="desiredDate"
onSortModeChange={vi.fn()}
```

새 테스트를 추가한다.

```ts
it('shows sort controls separately from view controls', () => {
  const onSortModeChange = vi.fn();

  render(
    <OrderList
      orders={[order]}
      selectedId={null}
      sortMode="desiredDate"
      onSortModeChange={onSortModeChange}
      onSelect={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'quantityDesc' } });

  expect(onSortModeChange).toHaveBeenCalledWith('quantityDesc');
  expect(screen.getByRole('button', { name: '카드형 보기' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '목록형 보기' })).toBeInTheDocument();
});

it('shows change confirmation badge for unconfirmed change requests', () => {
  render(
    <OrderList
      orders={[{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: false }]}
      selectedId={null}
      sortMode="desiredDate"
      onSortModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByText('변경 확인 필요')).toBeInTheDocument();
});

it('hides change confirmation badge after change request is confirmed', () => {
  render(
    <OrderList
      orders={[{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: true }]}
      selectedId={null}
      sortMode="desiredDate"
      onSortModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.queryByText('변경 확인 필요')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/components/OrderList.test.tsx`

Expected: FAIL because props and badge UI are not implemented.

- [ ] **Step 3: OrderList props와 정렬 select 구현**

`src/components/OrderList.tsx` import와 props를 수정한다.

```ts
import type { OrderSortMode } from '../domain/orderSorting';

interface OrderListProps {
  orders: CapturedOrder[];
  selectedId: string | null;
  sortMode: OrderSortMode;
  onSortModeChange: (mode: OrderSortMode) => void;
  onSelect: (orderId: string) => void;
}
```

컴포넌트 시그니처를 바꾼다.

```ts
export function OrderList({ orders, selectedId, sortMode, onSortModeChange, onSelect }: OrderListProps) {
```

헤더 액션에 정렬 select를 추가한다.

```tsx
<label className="sortControl">
  정렬
  <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value as OrderSortMode)}>
    <option value="desiredDate">희망일 빠른 순</option>
    <option value="recent">최근 등록순</option>
    <option value="quantityDesc">수량 많은 순</option>
  </select>
</label>
```

- [ ] **Step 4: App에 sortMode 연결**

`src/App.tsx`에 import와 상태를 추가한다.

```ts
import { sortOrders, type OrderSortMode } from './domain/orderSorting';
```

컴포넌트 내부에 다음을 추가한다.

```ts
const [sortMode, setSortMode] = useState<OrderSortMode>('desiredDate');

const displayOrders = useMemo(() => sortOrders(orders, sortMode), [orders, sortMode]);
```

`OrderList` 호출을 다음처럼 바꾼다.

```tsx
<OrderList
  orders={displayOrders}
  selectedId={selectedId}
  sortMode={sortMode}
  onSortModeChange={setSortMode}
  onSelect={setSelectedId}
/>
```

- [ ] **Step 5: 변경 요청 배지 구현**

`orders.map` 내부에서 flag 값을 계산한다.

```ts
const hasUnconfirmedChangeRequest = order.changeRequestNote.trim() !== '' && !order.changeRequestConfirmed;
const needsAttention =
  order.warningLevel === 'attention' || order.reviewReasons.length > 0 || order.missingFields.length > 0;
```

카드형 `flagLine` 안에 다음 배지를 추가한다.

```tsx
{needsAttention ? <span className="reasonSummaryPill">확인 필요</span> : null}
{hasUnconfirmedChangeRequest ? <span className="changeRequestPill">변경 확인 필요</span> : null}
```

목록형의 `reasonSummaryLine`에도 같은 의미의 배지를 추가한다.

```tsx
{needsAttention ? <span className="reasonSummaryPill">확인 필요</span> : null}
{hasUnconfirmedChangeRequest ? <span className="changeRequestPill">변경 확인 필요</span> : null}
```

- [ ] **Step 5: CSS 추가**

- [ ] **Step 6: CSS 추가**

`src/App.css`에 다음 스타일을 추가한다.

```css
.sortControl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #56463a;
  font-size: 0.9rem;
  white-space: nowrap;
}

.sortControl select {
  min-height: 36px;
  border: 1px solid #d8c8aa;
  border-radius: 8px;
  background: #fffdf8;
  color: #2d2a32;
  padding: 0 10px;
}

.changeRequestPill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border-radius: 999px;
  background: #2f4a5f;
  color: #fffdf8;
  padding: 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
}

@media (max-width: 720px) {
  .listHeaderActions {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .sortControl {
    width: 100%;
    justify-content: space-between;
  }

  .sortControl select {
    flex: 1;
  }
}
```

- [ ] **Step 7: App 통합 테스트 추가**

`src/App.test.tsx`에 정렬 변경 테스트를 추가한다.

```ts
it('changes displayed order when sort mode changes', async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 작은주문\n곶감 2세트\n2026-07-05\n픽업');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

  await user.clear(screen.getByLabelText('주문/문의 원문'));
  await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 큰주문\n곶감 20세트\n2026-07-06\n픽업');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

  expect(screen.getByText('작은주문')).toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('정렬'), 'quantityDesc');

  const orderButtons = screen.getAllByRole('button').map((button) => button.textContent ?? '').join('\n');
  expect(orderButtons.indexOf('큰주문')).toBeLessThan(orderButtons.indexOf('작은주문'));
});
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- src/components/OrderList.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 9: 커밋**

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: add order list sort controls"
```

---

### Task 4: 상세 변경 요청 편집

**Files:**
- Modify: `src/components/OrderDetail.tsx`
- Modify: `src/components/OrderDetail.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: 실패 테스트 작성**

`src/components/OrderDetail.test.tsx`에 테스트를 추가한다.

```ts
it('shows unconfirmed change request in the confirmation summary', () => {
  render(
    <OrderDetail
      order={baseOrder({ changeRequestNote: '수령 시간을 오후 3시로 변경', changeRequestConfirmed: false })}
      settings={DEFAULT_SETTINGS}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  const reviewBox = screen.getByLabelText('확인 필요 사유');

  expect(within(reviewBox).getByText('변경 요청 확인 필요')).toBeInTheDocument();
});

it('edits change request note and confirmation state', async () => {
  const onChange = vi.fn();

  render(
    <OrderDetail
      order={baseOrder({ changeRequestNote: '', changeRequestConfirmed: false })}
      settings={DEFAULT_SETTINGS}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );

  await userEvent.type(screen.getByLabelText('변경 요청'), '픽업 시간을 오후 3시로 변경');

  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      changeRequestNote: '픽업 시간을 오후 3시로 변경',
      changeRequestConfirmed: false,
    }),
  );
});

it('allows confirming an existing change request', async () => {
  const onChange = vi.fn();

  render(
    <OrderDetail
      order={baseOrder({ changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: false })}
      settings={DEFAULT_SETTINGS}
      onChange={onChange}
      onClose={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('checkbox', { name: '변경 요청 확인됨' }));

  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      changeRequestNote: '픽업 시간을 오후 3시로 변경',
      changeRequestConfirmed: true,
    }),
  );
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/components/OrderDetail.test.tsx`

Expected: FAIL because change request UI is not implemented.

- [ ] **Step 3: 상세 변경 요청 핸들러 구현**

`src/components/OrderDetail.tsx`에 핸들러를 추가한다.

```ts
function handleChangeRequestNoteChange(changeRequestNote: string) {
  if (!order) {
    return;
  }

  publish({
    ...order,
    changeRequestNote,
    changeRequestConfirmed: changeRequestNote.trim() ? order.changeRequestConfirmed : false,
  });
}

function handleChangeRequestConfirmedChange(changeRequestConfirmed: boolean) {
  if (!order || !order.changeRequestNote.trim()) {
    return;
  }

  publish({ ...order, changeRequestConfirmed });
}
```

summary 계산을 추가한다.

```ts
const hasUnconfirmedChangeRequest = order.changeRequestNote.trim() !== '' && !order.changeRequestConfirmed;
const shouldShowReviewBox = infoReasonsToShow.length > 0 || checkReasons.length > 0 || hasUnconfirmedChangeRequest;
```

- [ ] **Step 4: 확인 요약에 변경 요청 항목 추가**

기존 review box 조건을 `shouldShowReviewBox`로 바꾸고, box 안에 다음 section을 추가한다.

```tsx
{hasUnconfirmedChangeRequest ? (
  <section className="reasonGroup">
    <h3>변경 요청 확인 필요</h3>
    <ul>
      <li>변경 요청</li>
    </ul>
  </section>
) : null}
```

- [ ] **Step 5: 변경 요청 섹션 추가**

원문 textarea보다 위, 주문 정보 편집 grid보다 앞에 다음 섹션을 배치한다.

```tsx
<section className="changeRequestSection" aria-label="변경 요청">
  <label className="fieldBlock spanAll">
    변경 요청
    <textarea
      value={order.changeRequestNote}
      rows={3}
      onChange={(event) => handleChangeRequestNoteChange(event.target.value)}
    />
  </label>
  <label className={`checkLine ${order.changeRequestNote.trim() ? '' : 'disabled'}`}>
    <input
      type="checkbox"
      checked={order.changeRequestConfirmed}
      disabled={!order.changeRequestNote.trim()}
      onChange={(event) => handleChangeRequestConfirmedChange(event.target.checked)}
    />
    변경 요청 확인됨
  </label>
</section>
```

- [ ] **Step 6: 원문 영역을 하단으로 이동**

현재 `주문/문의 원문` field block을 `fieldGrid` 뒤로 옮긴다. 동작은 그대로 유지한다.

- [ ] **Step 7: CSS 추가**

`src/App.css`에 추가한다.

```css
.changeRequestSection {
  display: grid;
  gap: 12px;
  border: 1px solid #e3d6bf;
  border-radius: 8px;
  background: #fffaf0;
  padding: 14px;
}

.checkLine {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2d2a32;
  font-weight: 700;
}

.checkLine.disabled {
  color: #8e8171;
}

.checkLine input {
  width: 18px;
  height: 18px;
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- src/components/OrderDetail.test.tsx`

Expected: PASS.

- [ ] **Step 9: 커밋**

```bash
git add src/components/OrderDetail.tsx src/components/OrderDetail.test.tsx src/App.css
git commit -m "feat: add simple change request editing"
```

---

### Task 5: 통합 검증과 마감

**Files:**
- No planned source edits. Only commit a fix if a verification command exposes a concrete defect in files changed by Tasks 1-4.

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: production build 실행**

Run: `npm run build`

Expected: PASS with `tsc -b && vite build`.

- [ ] **Step 3: 수동 실행 서버 시작**

Run: `npm run dev -- --port 5173`

Expected: Vite prints a local URL using `127.0.0.1:5173`. If the port is busy, use `npm run dev -- --port 5174`.

- [ ] **Step 4: 데스크톱 수동 검증**

Browser path: `http://127.0.0.1:5173`

Check:

- 주문 수집에서 원문을 저장하면 목록에 표시된다.
- 기본 정렬은 `희망일 빠른 순`이다.
- `최근 등록순`과 `수량 많은 순` 선택이 목록 순서를 바꾼다.
- 상세에서 변경 요청을 입력하면 목록에 `변경 확인 필요`가 보인다.
- 상세에서 `변경 요청 확인됨`을 체크하면 목록 배지가 사라진다.
- 상태 select에는 `신규`, `확인 필요`, `제작 준비`, `발송 완료`만 있다.

- [ ] **Step 5: 모바일 폭 수동 검증**

Browser devtools or Playwright viewport: 390px wide.

Check:

- 목록 헤더에서 정렬 select와 카드/목록 토글이 겹치지 않는다.
- 주문 카드의 배지가 줄바꿈되어도 고객명/상품/희망일을 가리지 않는다.
- 상세 모달에서 변경 요청 textarea와 checkbox를 터치하기 쉽다.

- [ ] **Step 6: 최종 상태 확인**

Run: `git status --short`

Expected: clean working tree after commits.
