# 주문 운영 UX 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주문 목록과 상세 화면을 더 빠르게 훑고 수정할 수 있도록 고객명 편집 진입, 원문 복사 전용, 변경 요청 버튼, 목록 기본 보기/필터/정렬 UX를 정리한다.

**Architecture:** 기존 React 컴포넌트 경계를 유지한다. `App`은 주문 수집 출처, 목록 출처 필터, 정렬 상태를 소유하고 `OrderList`는 보기 방식 persistence와 정렬 메뉴 열림 상태만 소유한다. `OrderDetail`은 상세 모달 안의 포커스, 원문 복사, 변경 요청 접힘 상태를 소유한다.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS Modules가 아닌 단일 `src/App.css`, 브라우저 `localStorage`와 `navigator.clipboard`.

---

## 전제

- 구현은 새 isolated worktree에서 시작한다. 예: `order-operations-ux-refinement`.
- 기준 브랜치는 `main`이며 현재 설계 커밋 `dd721d4 docs: design order operations ux refinement` 이후 상태를 사용한다.
- 구현 전 관련 스킬은 `superpowers:using-git-worktrees`, 구현 중에는 `superpowers:executing-plans` 또는 `superpowers:subagent-driven-development`, 완료 전에는 `superpowers:verification-before-completion`을 사용한다.

## 파일 구조

- Modify: `src/domain/parser.ts`
  - 수량 예측 문자열에서 사용자 노출 문구를 `후보`에서 `(예측)`으로 바꾼다.
- Modify: `src/domain/parser.test.ts`
  - 새 수량 문구를 검증한다.
- Modify: `src/domain/reviewRules.ts`
  - 확인 사유 라벨 `수량 후보 여러 개`를 `수량 예측 여러 개`로 바꾼다.
- Modify: `src/domain/reviewRules.test.ts`
  - 새 확인 사유 라벨을 검증한다.
- Modify: `src/components/OrderCaptureForm.tsx`
  - `source` 내부 상태를 제거하고 `source` prop을 받는다.
  - 출처 select는 폼 내부에서 제거한다.
- Modify: `src/components/OrderCaptureForm.test.tsx`
  - 필수 props를 추가하고 출처 이동 이후 저장 동작을 검증한다.
- Modify: `src/App.tsx`
  - `captureSource`, `sourceFilter`, `sortMode`를 소유한다.
  - 주문 수집 `sectionHeader` 우측에 출처 선택을 배치한다.
  - 출처 필터를 적용한 뒤 정렬해서 `OrderList`에 넘긴다.
- Modify: `src/App.test.tsx`
  - 출처 선택 저장, 출처 필터, 정렬 메뉴 흐름을 통합 검증한다.
- Modify: `src/components/OrderList.tsx`
  - 기본 목록형 보기와 localStorage persistence를 구현한다.
  - 주문 수/출처 필터/정렬 메뉴/보기 토글을 header action으로 배치한다.
  - 기존 정렬 select를 버튼+메뉴로 바꾼다.
- Modify: `src/components/OrderList.test.tsx`
  - 기본 목록형 보기, persistence, 출처 필터 콜백, 정렬 메뉴를 검증한다.
- Modify: `src/components/OrderDetail.tsx`
  - 고객명 타이틀 클릭 시 고객명 입력으로 포커스 이동.
  - 원문은 readOnly와 복사 버튼만 제공.
  - 변경 요청은 헤더 버튼으로 열고 닫는다.
- Modify: `src/components/OrderDetail.test.tsx`
  - 고객명 포커스, 원문 readOnly/복사, 변경 요청 버튼을 검증한다.
- Modify: `src/App.css`
  - `sectionHeader` 우측 액션, 목록 헤더, 정렬 메뉴, 상세 필드 한 줄 레이아웃, 변경 요청 접힘 섹션, raw text 복사 UI를 스타일링한다.

---

### Task 1: 사용자 노출 문구 `후보`를 `(예측)`으로 교체

**Files:**
- Modify: `src/domain/parser.ts`
- Modify: `src/domain/parser.test.ts`
- Modify: `src/domain/reviewRules.ts`
- Modify: `src/domain/reviewRules.test.ts`

- [ ] **Step 1: parser 실패 테스트를 먼저 수정한다**

`src/domain/parser.test.ts`의 상담형 수량 테스트 기대값을 아래처럼 바꾼다.

```ts
expect(parsed.quantity).toBe('180개 / 20개 (예측)');
```

- [ ] **Step 2: reviewRules 실패 테스트를 먼저 수정한다**

`src/domain/reviewRules.test.ts`에서 기존 `수량 후보 여러 개` 기대값을 모두 `수량 예측 여러 개`로 바꾼다.

```ts
expect(evaluated.reviewReasons).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      label: '수량 예측 여러 개',
    }),
  ]),
);
```

- [ ] **Step 3: 실패를 확인한다**

Run:

```bash
npm test -- parser reviewRules
```

Expected:

- `parser.test.ts`는 기존 출력 `180개 / 20개 후보` 때문에 실패한다.
- `reviewRules.test.ts`는 기존 라벨 `수량 후보 여러 개` 때문에 실패한다.

- [ ] **Step 4: parser 문구를 바꾼다**

`src/domain/parser.ts`의 `summarizeQuantityCandidates` 반환값을 아래처럼 바꾼다.

```ts
const summarizeQuantityCandidates = (candidates: readonly QuantityCandidate[]) => {
  if (candidates.length === 0) {
    return '';
  }

  if (candidates.length === 1) {
    return candidates[0].rawText;
  }

  return `${candidates.map((candidate) => candidate.rawText).join(' / ')} (예측)`;
};
```

- [ ] **Step 5: reviewRules 라벨을 바꾼다**

`src/domain/reviewRules.ts`에서 `createCheckReasons` 안의 quantity candidates 라벨을 아래처럼 바꾼다.

```ts
reviewReasons.push(
  createCheckReason('ambiguous-quantity', '수량 예측 여러 개', '수량으로 보이는 값이 여러 개 있어요.', {
    detail: order.quantityCandidates.map((candidate) => candidate.rawText).join(', '),
  }),
);
```

- [ ] **Step 6: 관련 테스트 통과를 확인한다**

Run:

```bash
npm test -- parser reviewRules
```

Expected:

- `src/domain/parser.test.ts` 통과.
- `src/domain/reviewRules.test.ts` 통과.

- [ ] **Step 7: 커밋한다**

```bash
git add src/domain/parser.ts src/domain/parser.test.ts src/domain/reviewRules.ts src/domain/reviewRules.test.ts
git commit -m "fix: clarify predicted quantity wording"
```

---

### Task 2: 주문 수집 출처를 App 헤더 액션으로 이동하고 목록 출처 필터를 추가

**Files:**
- Modify: `src/components/OrderCaptureForm.tsx`
- Modify: `src/components/OrderCaptureForm.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: OrderCaptureForm props 테스트를 먼저 정리한다**

`src/components/OrderCaptureForm.test.tsx`의 render 호출에 `source`를 추가한다. 테스트 helper가 없으면 파일 상단에 아래 helper를 만든다.

```ts
const renderOrderCaptureForm = (overrides: Partial<React.ComponentProps<typeof OrderCaptureForm>> = {}) =>
  render(
    <OrderCaptureForm
      existingRawTexts={[]}
      settings={DEFAULT_SETTINGS}
      source="카카오톡 채널"
      onSave={vi.fn()}
      {...overrides}
    />,
  );
```

기존 저장 테스트에는 선택된 출처가 저장되는지 확인하는 assertion을 넣는다.

```ts
const onSave = vi.fn();
renderOrderCaptureForm({ source: '네이버 스마트스토어', onSave });

fireEvent.change(screen.getByLabelText('주문/문의 원문'), {
  target: { value: '성함: 김리루\n곶감 1세트\n2026-07-03\n픽업' },
});
fireEvent.click(screen.getByRole('button', { name: '저장' }));

expect(onSave).toHaveBeenCalledWith(
  expect.objectContaining({
    source: '네이버 스마트스토어',
  }),
);
```

- [ ] **Step 2: OrderCaptureForm props 변경으로 실패를 확인한다**

Run:

```bash
npm test -- OrderCaptureForm
```

Expected:

- 아직 `source` prop이 없거나 내부 select가 남아 있어 테스트가 실패한다.

- [ ] **Step 3: OrderCaptureForm을 controlled source로 바꾼다**

`src/components/OrderCaptureForm.tsx`에서 `useState<OrderSource>` import/상태를 제거하고 props를 확장한다.

```ts
interface OrderCaptureFormProps {
  existingRawTexts: string[];
  settings: OrderSettings;
  source: OrderSource;
  onSave: (order: CapturedOrder) => void;
}

export function OrderCaptureForm({ existingRawTexts, settings, source, onSave }: OrderCaptureFormProps) {
  const [rawText, setRawText] = useState('');
```

폼 내부의 출처 `<label>` 블록은 제거한다. 최종 props는 아래 구조를 유지한다.

```ts
interface OrderCaptureFormProps {
  existingRawTexts: string[];
  settings: OrderSettings;
  source: OrderSource;
  onSave: (order: CapturedOrder) => void;
}
```

출처 변경 함수는 `OrderCaptureForm`으로 넘기지 않고 `App`의 헤더 select에서만 사용한다.

- [ ] **Step 4: App에 captureSource와 sourceFilter 상태를 추가한다**

`src/App.tsx` import를 확장한다.

```ts
import {
  ORDER_SOURCES,
  type CapturedOrder,
  type OrderSettings,
  type OrderSource,
} from './domain/orderTypes';
```

상태와 필터링을 추가한다.

```ts
type OrderSourceFilter = '전체' | OrderSource;

const [captureSource, setCaptureSource] = useState<OrderSource>('카카오톡 채널');
const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('전체');

const filteredOrders = useMemo(
  () => (sourceFilter === '전체' ? orders : orders.filter((order) => order.source === sourceFilter)),
  [orders, sourceFilter],
);
const displayOrders = useMemo(() => sortOrders(filteredOrders, sortMode), [filteredOrders, sortMode]);
```

`OrderCaptureForm` 호출을 바꾼다.

```tsx
<OrderCaptureForm
  existingRawTexts={orders.map((order) => order.rawText)}
  settings={settings}
  source={captureSource}
  onSave={handleSaveOrder}
/>
```

`주문 수집` sectionHeader 오른쪽에 출처 select를 추가한다.

```tsx
<div className="sectionHeader">
  <div>
    <h2>주문 수집</h2>
    <p>원문을 붙여넣고 저장합니다.</p>
  </div>
  <div className="sectionHeaderActions">
    <label className="headerSelectControl">
      출처
      <select value={captureSource} onChange={(event) => setCaptureSource(event.target.value as OrderSource)}>
        {ORDER_SOURCES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  </div>
</div>
```

- [ ] **Step 5: OrderList props에 출처 필터를 추가한다**

`src/components/OrderList.tsx` props를 확장한다.

```ts
import { FIELD_DEFINITIONS, ORDER_SOURCES, type CapturedOrder, type OrderSource } from '../domain/orderTypes';

export type OrderSourceFilter = '전체' | OrderSource;

interface OrderListProps {
  orders: CapturedOrder[];
  totalOrderCount: number;
  selectedId: string | null;
  sortMode: OrderSortMode;
  sourceFilter: OrderSourceFilter;
  onSortModeChange: (mode: OrderSortMode) => void;
  onSourceFilterChange: (source: OrderSourceFilter) => void;
  onSelect: (orderId: string) => void;
}
```

비어 있는 상태도 필터 결과와 전체 무주문을 구분한다.

```tsx
{orders.length === 0 ? (
  <p className="emptyState">
    {totalOrderCount === 0 ? '아직 저장된 주문이 없습니다.' : '선택한 출처의 주문이 없습니다.'}
  </p>
) : null}
```

- [ ] **Step 6: App에서 OrderList 호출을 갱신한다**

```tsx
<OrderList
  orders={displayOrders}
  totalOrderCount={orders.length}
  selectedId={selectedId}
  sortMode={sortMode}
  sourceFilter={sourceFilter}
  onSortModeChange={setSortMode}
  onSourceFilterChange={setSourceFilter}
  onSelect={setSelectedId}
/>
```

- [ ] **Step 7: App 통합 테스트를 추가한다**

`src/App.test.tsx`에 출처 저장과 필터 테스트를 추가한다.

```ts
it('saves orders with the source selected from the capture header and filters the order list by source', async () => {
  const user = userEvent.setup();

  render(<App />);

  await user.selectOptions(screen.getByLabelText('출처'), '네이버 스마트스토어');
  await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 스마트고객\n곶감 2세트\n2026-07-05\n픽업');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

  await user.selectOptions(screen.getByLabelText('출처'), '카카오톡 채널');
  await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 카카오고객\n곶감 1세트\n2026-07-06\n픽업');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

  await user.selectOptions(screen.getByLabelText('주문 목록 출처'), '네이버 스마트스토어');

  expect(screen.getByText('스마트고객')).toBeInTheDocument();
  expect(screen.queryByText('카카오고객')).not.toBeInTheDocument();
  expect(screen.getByText('1건')).toBeInTheDocument();
});
```

구현 시 capture header label과 list header label이 충돌하지 않도록 목록 필터 label은 `주문 목록 출처`로 둔다.

- [ ] **Step 8: 관련 테스트 통과를 확인한다**

Run:

```bash
npm test -- OrderCaptureForm OrderList App
```

Expected:

- 세 테스트 파일이 통과한다.

- [ ] **Step 9: 커밋한다**

```bash
git add src/components/OrderCaptureForm.tsx src/components/OrderCaptureForm.test.tsx src/components/OrderList.tsx src/components/OrderList.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: move source controls into operation headers"
```

---

### Task 3: 주문 목록 기본 보기, persistence, 정렬 메뉴 버튼 구현

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: 목록형 기본 보기 테스트를 바꾼다**

`src/components/OrderList.test.tsx`의 `switches to compact list mode...` 테스트를 기본 목록형 검증으로 바꾼다.

```ts
it('uses compact list mode by default and keeps raw text expansion hidden', () => {
  render(
    <OrderList
      orders={[order]}
      totalOrderCount={1}
      selectedId={null}
      sortMode="desiredDate"
      sourceFilter="전체"
      onSortModeChange={vi.fn()}
      onSourceFilterChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '목록형 보기' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: viewMode localStorage 테스트를 추가한다**

```ts
it('persists order list view mode in localStorage', () => {
  render(
    <OrderList
      orders={[order]}
      totalOrderCount={1}
      selectedId={null}
      sortMode="desiredDate"
      sourceFilter="전체"
      onSortModeChange={vi.fn()}
      onSourceFilterChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '카드형 보기' }));

  expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('card');
});
```

`beforeEach`에 `localStorage.clear()`를 추가한다.

- [ ] **Step 3: 정렬 메뉴 테스트를 바꾼다**

기존 `shows sort controls separately from view controls` 테스트에서 select 변경 대신 버튼과 메뉴를 검증한다.

```ts
fireEvent.click(screen.getByRole('button', { name: '정렬 방식' }));
fireEvent.click(screen.getByRole('menuitemradio', { name: '수량 많은 순' }));

expect(onSortModeChange).toHaveBeenCalledWith('quantityDesc');
expect(screen.queryByRole('menu')).not.toBeInTheDocument();
```

- [ ] **Step 4: 실패를 확인한다**

Run:

```bash
npm test -- OrderList
```

Expected:

- 기본값이 card라 기본 목록형 테스트가 실패한다.
- localStorage 저장이 없어 persistence 테스트가 실패한다.
- 정렬 메뉴 버튼이 없어 정렬 메뉴 테스트가 실패한다.

- [ ] **Step 5: viewMode persistence를 구현한다**

`src/components/OrderList.tsx` 상단에 상수와 helper를 추가한다.

```ts
type OrderListViewMode = 'card' | 'list';

const ORDER_LIST_VIEW_MODE_KEY = 'lyru-oms.orderList.viewMode.v1';

const loadOrderListViewMode = (): OrderListViewMode => {
  if (typeof localStorage === 'undefined') {
    return 'list';
  }

  const stored = localStorage.getItem(ORDER_LIST_VIEW_MODE_KEY);
  return stored === 'card' || stored === 'list' ? stored : 'list';
};

const saveOrderListViewMode = (mode: OrderListViewMode) => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(ORDER_LIST_VIEW_MODE_KEY, mode);
};
```

state 초기값과 setter를 바꾼다.

```ts
const [viewMode, setViewModeState] = useState<OrderListViewMode>(() => loadOrderListViewMode());

function setViewMode(mode: OrderListViewMode) {
  setViewModeState(mode);
  saveOrderListViewMode(mode);
}
```

- [ ] **Step 6: 정렬 메뉴 상태와 선택 핸들러를 구현한다**

```ts
const [sortMenuOpen, setSortMenuOpen] = useState(false);

const sortOptions: Array<{ mode: OrderSortMode; label: string }> = [
  { mode: 'desiredDate', label: '희망일 빠른 순' },
  { mode: 'recent', label: '최근 등록순' },
  { mode: 'quantityDesc', label: '수량 많은 순' },
];

function chooseSortMode(mode: OrderSortMode) {
  onSortModeChange(mode);
  setSortMenuOpen(false);
}
```

정렬 UI는 아래 형태로 구성한다.

```tsx
<div className="sortMenuWrap" onBlur={(event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    setSortMenuOpen(false);
  }
}}>
  <button
    type="button"
    className="iconButton sortButton"
    aria-label="정렬 방식"
    aria-expanded={sortMenuOpen}
    aria-haspopup="menu"
    onClick={() => setSortMenuOpen((open) => !open)}
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        setSortMenuOpen(false);
      }
    }}
  >
    ↕
  </button>
  {sortMenuOpen ? (
    <div className="sortMenu" role="menu" aria-label="정렬 방식">
      {sortOptions.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="menuitemradio"
          aria-checked={sortMode === option.mode}
          onClick={() => chooseSortMode(option.mode)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ) : null}
</div>
```

- [ ] **Step 7: 주문 목록 sectionHeader 우측을 구성한다**

`OrderList` header를 아래 구조로 바꾼다. empty state에서도 같은 header를 렌더한다.

```tsx
<div className="sectionHeader listSectionHeader">
  <div>
    <h2>주문 목록</h2>
    <p>주문을 빠르게 훑고 선택합니다.</p>
  </div>
  <div className="sectionHeaderActions listHeaderActions">
    <span className="orderCount">{orders.length}건</span>
    <label className="headerSelectControl">
      주문 목록 출처
      <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value as OrderSourceFilter)}>
        <option value="전체">전체</option>
        {ORDER_SOURCES.map((source) => (
          <option key={source} value={source}>{source}</option>
        ))}
      </select>
    </label>
    {/* sort menu */}
    {/* view toggle */}
  </div>
</div>
```

- [ ] **Step 8: App 정렬 통합 테스트를 메뉴 방식으로 갱신한다**

`src/App.test.tsx`의 정렬 테스트에서 `selectOptions(screen.getByLabelText('정렬'), 'quantityDesc')`를 아래로 바꾼다.

```ts
await user.click(screen.getByRole('button', { name: '정렬 방식' }));
await user.click(screen.getByRole('menuitemradio', { name: '수량 많은 순' }));
```

- [ ] **Step 9: 관련 테스트 통과를 확인한다**

Run:

```bash
npm test -- OrderList App
```

Expected:

- `OrderList`와 `App` 테스트가 통과한다.

- [ ] **Step 10: 커밋한다**

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx src/App.test.tsx
git commit -m "feat: refine order list controls"
```

---

### Task 4: 상세 모달 고객명 포커스, 원문 복사 전용, 변경 요청 버튼 구현

**Files:**
- Modify: `src/components/OrderDetail.tsx`
- Modify: `src/components/OrderDetail.test.tsx`

- [ ] **Step 1: 고객명 타이틀 포커스 테스트를 추가한다**

`src/components/OrderDetail.test.tsx`에 추가한다.

```ts
it('focuses customer name input from the detail title when customer name is missing', async () => {
  const user = userEvent.setup();

  render(
    <OrderDetail
      order={baseOrder({ customerName: '' })}
      settings={DEFAULT_SETTINGS}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '고객명 입력으로 이동' }));

  expect(screen.getByLabelText('고객명')).toHaveFocus();
});
```

- [ ] **Step 2: raw text readOnly와 복사 테스트를 추가한다**

```ts
it('keeps raw text read-only and copies it from the detail view', async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });

  render(
    <OrderDetail
      order={baseOrder({ rawText: '성함: 김리루\n곶감 1세트' })}
      settings={DEFAULT_SETTINGS}
      onChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  expect(screen.getByLabelText('주문/문의 원문')).toHaveAttribute('readonly');

  await user.click(screen.getByRole('button', { name: '주문/문의 원문 복사' }));

  expect(writeText).toHaveBeenCalledWith('성함: 김리루\n곶감 1세트');
});
```

- [ ] **Step 3: 변경 요청 버튼 테스트를 갱신한다**

기존 변경 요청 테스트들은 버튼을 눌러 섹션을 연 뒤 textarea/checkbox를 찾도록 바꾼다.

```ts
await userEvent.click(screen.getByRole('button', { name: '변경 요청' }));
fireEvent.change(screen.getByLabelText('변경 요청 내용'), { target: { value: '픽업 시간을 오후 3시로 변경' } });
```

새 테스트도 추가한다.

```ts
it('opens change request editor from the header button', async () => {
  const user = userEvent.setup();

  render(<OrderDetail order={baseOrder({ changeRequestNote: '' })} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

  expect(screen.queryByLabelText('변경 요청 내용')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '변경 요청' }));

  expect(screen.getByLabelText('변경 요청 내용')).toBeInTheDocument();
});
```

- [ ] **Step 4: 실패를 확인한다**

Run:

```bash
npm test -- OrderDetail
```

Expected:

- 고객명 title button, raw text copy button, 변경 요청 header button이 없어 실패한다.

- [ ] **Step 5: OrderDetail에 ref와 UI state를 추가한다**

`src/components/OrderDetail.tsx` import를 바꾼다.

```ts
import { useRef, useState } from 'react';
```

컴포넌트 안에 상태와 ref를 추가한다.

```ts
const customerNameInputRef = useRef<HTMLInputElement | null>(null);
const [changeRequestOpen, setChangeRequestOpen] = useState(() => order.changeRequestNote.trim() !== '');
const [rawTextCopied, setRawTextCopied] = useState(false);

function focusCustomerName() {
  customerNameInputRef.current?.focus();
}

async function copyRawText() {
  try {
    await navigator.clipboard?.writeText(order.rawText);
    setRawTextCopied(true);
  } catch {
    setRawTextCopied(false);
  }
}
```

- [ ] **Step 6: 고객명 타이틀을 버튼으로 바꾼다**

기존 `<h2>{order.customerName || '고객명 미정'}</h2>`를 아래로 바꾼다.

```tsx
<h2>
  <button type="button" className="detailTitleButton" aria-label="고객명 입력으로 이동" onClick={focusCustomerName}>
    {order.customerName || '고객명 미정'}
  </button>
</h2>
```

field 렌더링에서 `customerName` input에 ref를 연결한다.

```tsx
<input
  ref={field === 'customerName' ? customerNameInputRef : undefined}
  value={order[field]}
  onChange={(event) => handleFieldChange(field, event.target.value)}
/>
```

- [ ] **Step 7: 변경 요청 버튼과 접힘 섹션을 구현한다**

상세 헤더 action에 버튼을 추가한다.

```tsx
<button
  type="button"
  className={`changeRequestButton ${hasUnconfirmedChangeRequest ? 'attention' : ''}`}
  onClick={() => setChangeRequestOpen((open) => !open)}
>
  변경 요청
  {hasUnconfirmedChangeRequest ? <span>확인 필요</span> : null}
</button>
```

기존 항상 보이던 `changeRequestSection`은 아래처럼 조건부 렌더링한다.

```tsx
{changeRequestOpen ? (
  <section className="changeRequestSection" aria-label="변경 요청 편집">
    <label className="fieldBlock spanAll">
      <span>변경 요청</span>
      <textarea
        aria-label="변경 요청 내용"
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
) : null}
```

- [ ] **Step 8: raw text를 readOnly와 복사 버튼으로 바꾼다**

`handleRawTextChange`, `parseRawText`, `mergeParsedFields` import를 제거한다.

하단 raw text 영역을 아래처럼 바꾼다.

```tsx
<section className="rawTextCopySection" aria-label="주문 원문 보관">
  <div className="rawTextHeader">
    <span>주문/문의 원문</span>
    <button type="button" className="secondaryButton" aria-label="주문/문의 원문 복사" onClick={copyRawText}>
      {rawTextCopied ? '복사됨' : '복사'}
    </button>
  </div>
  <textarea aria-label="주문/문의 원문" value={order.rawText} rows={7} readOnly />
</section>
```

- [ ] **Step 9: 관련 테스트 통과를 확인한다**

Run:

```bash
npm test -- OrderDetail
```

Expected:

- `OrderDetail` 테스트가 통과한다.

- [ ] **Step 10: 커밋한다**

```bash
git add src/components/OrderDetail.tsx src/components/OrderDetail.test.tsx
git commit -m "feat: refine order detail editing"
```

---

### Task 5: CSS 레이아웃과 최종 검증

**Files:**
- Modify: `src/App.css`
- Test: visual/manual verification

- [ ] **Step 1: sectionHeader를 좌우 레이아웃으로 확장한다**

`src/App.css`의 `.sectionHeader`를 아래 구조에 맞춘다.

```css
.sectionHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.sectionHeaderActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.headerSelectControl {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}
```

- [ ] **Step 2: 상세 필드 한 줄 레이아웃을 구현한다**

기존 `.fieldBlock`과 `.fieldBlock span` 스타일을 아래 방향으로 정리한다.

```css
.orderDetailModal {
  --detail-label-width: 9.5rem;
}

.fieldBlock {
  display: grid;
  grid-template-columns: minmax(var(--detail-label-width), var(--detail-label-width)) minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.fieldBlock.spanAll {
  grid-column: 1 / -1;
}

.fieldBlock > span,
.fieldBlock > .fieldLabel {
  min-width: 0;
  white-space: nowrap;
}

.fieldBlock textarea {
  min-height: 5.5rem;
}
```

구현 시 JSX label 안의 label 텍스트는 가능하면 `<span className="fieldLabel">`로 통일한다.

- [ ] **Step 3: sort menu와 detail header button 스타일을 추가한다**

```css
.sortMenuWrap {
  position: relative;
}

.sortMenu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  z-index: 20;
  min-width: 10rem;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 12px 30px rgba(17, 24, 39, 0.12);
}

.sortMenu button {
  width: 100%;
  text-align: left;
}

.detailTitleButton,
.changeRequestButton {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  cursor: pointer;
}

.changeRequestButton.attention span {
  margin-left: 0.4rem;
}
```

- [ ] **Step 4: 모바일 레이아웃을 확정한다**

기존 media query 안에 아래를 추가하거나 병합한다.

```css
@media (max-width: 720px) {
  .sectionHeader {
    flex-direction: column;
    align-items: stretch;
  }

  .sectionHeaderActions {
    justify-content: stretch;
  }

  .headerSelectControl,
  .headerSelectControl select {
    width: 100%;
  }

  .fieldBlock {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}
```

- [ ] **Step 5: 전체 테스트를 실행한다**

Run:

```bash
npm test
```

Expected:

- 14개 테스트 파일 전체 통과.
- 테스트 수는 추가 테스트 때문에 기존 139개보다 늘어난다.

- [ ] **Step 6: production build를 실행한다**

Run:

```bash
npm run build
```

Expected:

- `tsc -b && vite build` 성공.

- [ ] **Step 7: 데스크톱/모바일 수동 확인을 실행한다**

로컬 서버를 띄운다.

```bash
npm run dev -- --host 127.0.0.1
```

확인 항목:

- 데스크톱 상세 모달에서 `사장님 내부 메모` 라벨이 줄바꿈되지 않는다.
- 모바일 폭에서 상세 입력 라벨과 input/textarea가 겹치지 않는다.
- `고객명 미정` 클릭 시 고객명 입력칸에 포커스가 간다.
- 원문은 직접 수정되지 않고 복사 버튼만 동작한다.
- 변경 요청은 헤더 버튼으로 열고 닫힌다.
- 주문 목록은 최초 진입 시 목록형이다.
- 카드형 전환 후 새로고침해도 카드형이 유지된다.
- 출처 필터와 주문 수가 같이 바뀐다.
- 정렬 버튼 메뉴로 `수량 많은 순` 선택이 된다.

- [ ] **Step 8: CSS와 전체 변경을 커밋한다**

```bash
git add src/App.css src/App.tsx src/App.test.tsx src/components/OrderCaptureForm.tsx src/components/OrderCaptureForm.test.tsx src/components/OrderList.tsx src/components/OrderList.test.tsx src/components/OrderDetail.tsx src/components/OrderDetail.test.tsx src/domain/parser.ts src/domain/parser.test.ts src/domain/reviewRules.ts src/domain/reviewRules.test.ts
git commit -m "feat: refine order operations ux"
```

이 커밋은 Task 1-4에서 빠진 CSS와 통합 조정만 포함해야 한다. 이미 각 Task에서 커밋한 파일이 다시 staged 되지 않으면 정상이다.

---

## 최종 완료 기준

- `npm test` 통과.
- `npm run build` 통과.
- 데스크톱/모바일 수동 확인 완료.
- `git status --short`가 clean.
- 구현 브랜치를 PR로 올리거나, 사용자가 원하면 merge 후 worktree를 정리한다.

## 자체 검토

- Spec coverage:
  - 고객명 타이틀 포커스: Task 4.
  - 원문 복사 전용: Task 4.
  - 한 줄 필드 레이아웃: Task 5.
  - 변경 요청 버튼: Task 4.
  - 목록형 기본값과 localStorage: Task 3.
  - sectionHeader 우측 주문 수/출처/정렬/보기: Task 2, Task 3, Task 5.
  - 주문 수집 출처 header 이동: Task 2.
  - 출처 필터: Task 2.
  - 정렬 버튼 메뉴: Task 3.
  - `후보` 문구 교체: Task 1.
- Placeholder scan:
  - 이 계획은 미완성 표식 없이 구현 기준과 테스트 명령을 포함한다.
- Type consistency:
  - `OrderSourceFilter = '전체' | OrderSource`.
  - `OrderListViewMode = 'card' | 'list'`.
  - `sortMode`는 기존 `OrderSortMode` 그대로 사용한다.
