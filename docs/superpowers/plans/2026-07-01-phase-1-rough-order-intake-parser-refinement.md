# Phase 1 Rough Order Intake Parser Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴 사전 기반 규칙 파서로 Phase 1 주문/문의 원문을 비용 없이 더 잘 정리하고, 화면에는 복잡한 후보 대신 짧은 확인 항목만 보여준다.

**Architecture:** Existing React/Vite app lives in `.worktrees/order-standardization-mvp`. Keep parsing and review logic in small domain modules: catalog data, parser, quantity/date utilities, review rules, and UI formatters. UI components consume structured fields but hide internal candidates by default.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest, Testing Library, localStorage.

---

## Reference

- Spec: `docs/superpowers/specs/2026-07-01-phase-1-rough-order-intake-mvp-design.md`
- App root: `.worktrees/order-standardization-mvp`
- Run commands from: `.worktrees/order-standardization-mvp`

## File Structure

- Create: `.worktrees/order-standardization-mvp/src/domain/menuCatalog.ts`
  - Static menu catalog, purpose parsing hints, compact purpose categories, minimum order rules.
- Create: `.worktrees/order-standardization-mvp/src/domain/menuCatalog.test.ts`
  - Catalog matching and purpose mapping tests.
- Create: `.worktrees/order-standardization-mvp/src/domain/dateDisplay.ts`
  - Explicit date parsing and D-Day display formatting.
- Create: `.worktrees/order-standardization-mvp/src/domain/dateDisplay.test.ts`
  - Date parsing and display tests with fixed `today`.
- Modify: `.worktrees/order-standardization-mvp/src/domain/orderTypes.ts`
  - Add internal menu match candidates, quantity candidates, grouped review reason metadata, and quantity rule settings.
- Modify: `.worktrees/order-standardization-mvp/src/domain/storage.ts`
  - Load old v1 orders/settings safely into the expanded shape.
- Modify: `.worktrees/order-standardization-mvp/src/domain/storage.test.ts`
  - Verify old saved data still loads and new fields round-trip.
- Modify: `.worktrees/order-standardization-mvp/src/domain/parser.ts`
  - Keep label parsing; add consultation-style product, purpose, quantity, fulfillment, and date hints.
- Modify: `.worktrees/order-standardization-mvp/src/domain/parser.test.ts`
  - Replace the old “does not infer values from free sentences” expectation with scoped natural-language parsing tests.
- Modify: `.worktrees/order-standardization-mvp/src/domain/reviewRules.ts`
  - Use grouped reasons, default required fields, minimum order checks, real-unit bulk checks, and pickup-time non-required behavior.
- Modify: `.worktrees/order-standardization-mvp/src/domain/reviewRules.test.ts`
  - Cover grouped info shortage/check items and new quantity rules.
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderCaptureForm.tsx`
  - Preview parsed order content without exposing internal menu candidate arrays.
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderList.tsx`
  - Show D-Day display and compact counts for information shortage/check items.
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderList.test.tsx`
  - Verify compact UI does not expose internal candidates and shows D-Day.
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderDetail.tsx`
  - Split reason groups into “채워야 할 정보가 있어요” and “확인할 내용이 있어요”.
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderDetail.test.tsx`
  - Verify grouped reason text and menu ambiguity wording.
- Modify: `.worktrees/order-standardization-mvp/src/components/SettingsModal.tsx`
  - Rename bulk setting to real-unit quantity rule and remove pickup time from conditional required defaults.
- Modify: `.worktrees/order-standardization-mvp/src/components/SettingsModal.test.tsx`
  - Verify default required fields and quantity rule save behavior.
- Modify: `.worktrees/order-standardization-mvp/src/App.css`
  - Add low-emphasis badges/tooltips for D-Day and ambiguous menu match hints.

## Task 1: Expand Domain Types and Storage Compatibility

**Files:**
- Modify: `.worktrees/order-standardization-mvp/src/domain/orderTypes.ts`
- Modify: `.worktrees/order-standardization-mvp/src/domain/storage.ts`
- Modify: `.worktrees/order-standardization-mvp/src/domain/storage.test.ts`

- [ ] **Step 1: Write failing storage/type tests**

In `.worktrees/order-standardization-mvp/src/domain/storage.test.ts`, update the `round-trips orders and settings` test order fixture to include new fields:

```ts
const order: CapturedOrder = {
  ...EMPTY_ORDER_FIELDS,
  id: '1',
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
```

Add this test:

```ts
it('hydrates legacy orders with new parser metadata defaults', () => {
  const legacyOrder = {
    ...EMPTY_ORDER_FIELDS,
    id: 'legacy',
    source: '카카오톡 채널',
    rawText: '대추야자 9구 5세트',
    status: '수집',
    manuallyEditedFields: [],
    reparseDifferences: [],
    missingFields: [],
    reviewReasons: [],
    warningLevel: 'none',
    createdAt: '2026-06-30T09:00:00.000Z',
    updatedAt: '2026-06-30T09:00:00.000Z',
  };

  localStorage.setItem('lyru-oms.orders.v1', JSON.stringify([legacyOrder]));

  expect(loadOrders()).toEqual([
    {
      ...legacyOrder,
      menuMatches: [],
      quantityCandidates: [],
      parsedDate: null,
    },
  ]);
});
```

Update the `falls back per malformed settings field` test to expect the new default settings shape:

```ts
expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
```

Add this test:

```ts
it('hydrates legacy bulk threshold settings into real-unit quantity rules', () => {
  localStorage.setItem(
    'lyru-oms.settings.v1',
    JSON.stringify({
      requiredFields: ['orderItems', 'quantity'],
      conditionalRequiredFields: {
        address: { field: 'fulfillmentType', equals: '택배' },
      },
      bulkQuantityThreshold: 7,
    }),
  );

  expect(loadSettings()).toEqual({
    requiredFields: ['orderItems', 'quantity'],
    conditionalRequiredFields: {
      address: { field: 'fulfillmentType', equals: '택배' },
    },
    quantityRules: DEFAULT_SETTINGS.quantityRules,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/storage.test.ts
```

Expected: FAIL with TypeScript errors for missing `menuMatches`, `quantityCandidates`, `parsedDate`, and `quantityRules`.

- [ ] **Step 3: Expand `orderTypes.ts`**

In `.worktrees/order-standardization-mvp/src/domain/orderTypes.ts`, add these exported types after `FulfillmentType`:

```ts
export type PurposeCategory = '상견례/인사' | '답례품' | '기념일/행사' | '감사 선물' | '단체/기업' | '기타';
export type ReviewReasonGroup = 'info' | 'check';
export type ReviewReasonCode =
  | 'missing-field'
  | 'duplicate-raw-text'
  | 'event-purpose'
  | 'ambiguous-menu'
  | 'ambiguous-quantity'
  | 'bulk-real-unit'
  | 'minimum-order'
  | 'delivery-check'
  | 'relative-date';

export interface MenuMatch {
  menuId: string;
  label: string;
  unitCount: number | null;
  confidence: 'exact' | 'alias' | 'family';
}

export interface QuantityCandidate {
  value: number;
  unit: '개' | '세트';
  rawText: string;
}

export interface ParsedDateValue {
  isoDate: string;
  timeText: string;
  originalText: string;
  isRelative: boolean;
}

export interface MinimumOrderRule {
  unitCount: number;
  minimumSets: number;
}

export interface QuantityRules {
  bulkRealUnitThreshold: number;
  minimumOrderRules: MinimumOrderRule[];
}
```

Change `ReviewReason` to:

```ts
export interface ReviewReason {
  kind: ReviewReasonKind;
  group: ReviewReasonGroup;
  code: ReviewReasonCode;
  field?: OrderFieldKey;
  label: string;
  detail?: string;
  message: string;
}
```

Change `OrderSettings` to:

```ts
export interface OrderSettings {
  requiredFields: readonly OrderFieldKey[];
  conditionalRequiredFields: Partial<Record<OrderFieldKey, ConditionalRequiredField>>;
  quantityRules: QuantityRules;
}
```

Add new fields to `CapturedOrder` before `manuallyEditedFields`:

```ts
  menuMatches: MenuMatch[];
  quantityCandidates: QuantityCandidate[];
  parsedDate: ParsedDateValue | null;
```

Change `DEFAULT_SETTINGS` to:

```ts
export const DEFAULT_SETTINGS = {
  requiredFields: ['orderItems', 'quantity', 'desiredDateTime', 'fulfillmentType'],
  conditionalRequiredFields: {
    address: { field: 'fulfillmentType', equals: '택배' },
  },
  quantityRules: {
    bulkRealUnitThreshold: 40,
    minimumOrderRules: [
      { unitCount: 2, minimumSets: 5 },
      { unitCount: 4, minimumSets: 2 },
    ],
  },
} as const satisfies OrderSettings;
```

- [ ] **Step 4: Update `storage.ts`**

In `.worktrees/order-standardization-mvp/src/domain/storage.ts`:

Import new types:

```ts
  type MenuMatch,
  type ParsedDateValue,
  type QuantityCandidate,
  type QuantityRules,
```

Replace `cloneDefaultSettings` with:

```ts
const cloneDefaultSettings = (): OrderSettings => ({
  requiredFields: [...DEFAULT_SETTINGS.requiredFields],
  conditionalRequiredFields: {
    address: { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
  },
  quantityRules: {
    bulkRealUnitThreshold: DEFAULT_SETTINGS.quantityRules.bulkRealUnitThreshold,
    minimumOrderRules: DEFAULT_SETTINGS.quantityRules.minimumOrderRules.map((rule) => ({ ...rule })),
  },
});
```

Add validators:

```ts
const isMenuMatchArray = (value: unknown): value is MenuMatch[] =>
  Array.isArray(value) &&
  value.every(
    (match) =>
      isPlainObject(match) &&
      typeof match.menuId === 'string' &&
      typeof match.label === 'string' &&
      (typeof match.unitCount === 'number' || match.unitCount === null) &&
      ['exact', 'alias', 'family'].includes(String(match.confidence)),
  );

const isQuantityCandidateArray = (value: unknown): value is QuantityCandidate[] =>
  Array.isArray(value) &&
  value.every(
    (candidate) =>
      isPlainObject(candidate) &&
      typeof candidate.value === 'number' &&
      Number.isFinite(candidate.value) &&
      ['개', '세트'].includes(String(candidate.unit)) &&
      typeof candidate.rawText === 'string',
  );

const isParsedDateValue = (value: unknown): value is ParsedDateValue | null =>
  value === null ||
  (isPlainObject(value) &&
    typeof value.isoDate === 'string' &&
    typeof value.timeText === 'string' &&
    typeof value.originalText === 'string' &&
    typeof value.isRelative === 'boolean');
```

Relax `isCapturedOrder` by accepting legacy orders and hydrating defaults in `loadOrders`. Replace `isCapturedOrder` with:

```ts
const isStoredOrderBase = (value: unknown): value is CapturedOrder =>
  isPlainObject(value) &&
  typeof value.id === 'string' &&
  typeof value.rawText === 'string' &&
  hasRequiredStringOrderFields(value) &&
  FULFILLMENT_TYPE_VALUES.has(String(value.fulfillmentType)) &&
  ORDER_SOURCE_VALUES.has(String(value.source)) &&
  ORDER_STATUS_VALUES.has(String(value.status)) &&
  WARNING_LEVELS.has(String(value.warningLevel)) &&
  isOrderFieldKeyArray(value.manuallyEditedFields) &&
  isOrderFieldKeyArray(value.missingFields) &&
  isReparseDifferenceArray(value.reparseDifferences) &&
  isReviewReasonArray(value.reviewReasons) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const hydrateStoredOrder = (value: CapturedOrder): CapturedOrder => ({
  ...value,
  menuMatches: isMenuMatchArray((value as Record<string, unknown>).menuMatches)
    ? (value as Record<string, unknown>).menuMatches as MenuMatch[]
    : [],
  quantityCandidates: isQuantityCandidateArray((value as Record<string, unknown>).quantityCandidates)
    ? (value as Record<string, unknown>).quantityCandidates as QuantityCandidate[]
    : [],
  parsedDate: isParsedDateValue((value as Record<string, unknown>).parsedDate)
    ? (value as Record<string, unknown>).parsedDate as ParsedDateValue | null
    : null,
});
```

Update `loadOrders`:

```ts
return Array.isArray(storedOrders) ? storedOrders.filter(isStoredOrderBase).map(hydrateStoredOrder) : [];
```

Replace `parseBulkQuantityThreshold` with:

```ts
const parseQuantityRules = (value: unknown): QuantityRules => {
  const fallback = cloneDefaultSettings().quantityRules;

  if (!isPlainObject(value)) {
    return fallback;
  }

  const bulkRealUnitThreshold =
    typeof value.bulkRealUnitThreshold === 'number' &&
    Number.isFinite(value.bulkRealUnitThreshold) &&
    value.bulkRealUnitThreshold > 0
      ? Math.floor(value.bulkRealUnitThreshold)
      : fallback.bulkRealUnitThreshold;

  const minimumOrderRules =
    Array.isArray(value.minimumOrderRules) &&
    value.minimumOrderRules.every(
      (rule) =>
        isPlainObject(rule) &&
        typeof rule.unitCount === 'number' &&
        typeof rule.minimumSets === 'number' &&
        rule.unitCount > 0 &&
        rule.minimumSets > 0,
    )
      ? value.minimumOrderRules.map((rule) => ({
          unitCount: Math.floor(Number(rule.unitCount)),
          minimumSets: Math.floor(Number(rule.minimumSets)),
        }))
      : fallback.minimumOrderRules;

  return { bulkRealUnitThreshold, minimumOrderRules };
};
```

Update `loadSettings` return:

```ts
return {
  requiredFields: parseRequiredFields(storedSettings.requiredFields),
  conditionalRequiredFields: parseConditionalRequiredFields(storedSettings.conditionalRequiredFields),
  quantityRules: parseQuantityRules(storedSettings.quantityRules),
};
```

Update `parseConditionalRequiredFields` to return only `address`; delete `pickupTime` fallback.

- [ ] **Step 5: Run storage tests to verify pass**

Run:

```bash
npm test -- src/domain/storage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/orderTypes.ts src/domain/storage.ts src/domain/storage.test.ts
git commit -m "feat: expand order parser metadata types"
```

## Task 2: Add Menu Catalog and Purpose Mapping

**Files:**
- Create: `.worktrees/order-standardization-mvp/src/domain/menuCatalog.ts`
- Create: `.worktrees/order-standardization-mvp/src/domain/menuCatalog.test.ts`

- [ ] **Step 1: Write failing catalog tests**

Create `.worktrees/order-standardization-mvp/src/domain/menuCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findMenuMatches, mapPurposeFromText } from './menuCatalog';

describe('findMenuMatches', () => {
  it('matches concrete menu names and keeps unit counts', () => {
    expect(findMenuMatches('대추야자 오동나무 9구 세트 5세트')).toContainEqual({
      menuId: 'dates-wood-9',
      label: '대추야자 오동나무 9구 세트',
      unitCount: 9,
      confidence: 'exact',
    });
  });

  it('returns family matches for ambiguous product text', () => {
    const matches = findMenuMatches('대추야자 2구/9구 180개 구매 의사');

    expect(matches.map((match) => match.menuId)).toEqual([
      'dates-wood-9',
      'dates-handle-10',
      'dates-premium-15',
    ]);
  });

  it('matches shared 2구 and 4구 minimum-order products', () => {
    expect(findMenuMatches('화과자 2구 3세트')).toContainEqual(
      expect.objectContaining({ menuId: 'wagashi-2', unitCount: 2 }),
    );
    expect(findMenuMatches('화과자 4구 1세트')).toContainEqual(
      expect.objectContaining({ menuId: 'wagashi-4', unitCount: 4 }),
    );
  });
});

describe('mapPurposeFromText', () => {
  it.each([
    ['결혼식 답례품 문의', '답례품'],
    ['기업답례품 견적 부탁드립니다', '답례품'],
    ['상견례 선물', '상견례/인사'],
    ['부모님 선물입니다', '감사 선물'],
    ['크리스마스선물 문의', '기념일/행사'],
    ['단체 주문 구매 의사', '단체/기업'],
  ] as const)('maps "%s" to "%s"', (text, expected) => {
    expect(mapPurposeFromText(text)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/menuCatalog.test.ts
```

Expected: FAIL with module not found for `./menuCatalog`.

- [ ] **Step 3: Implement catalog module**

Create `.worktrees/order-standardization-mvp/src/domain/menuCatalog.ts`:

```ts
import type { MenuMatch, PurposeCategory } from './orderTypes';

interface MenuCatalogItem {
  id: string;
  label: string;
  aliases: string[];
  familyKeywords: string[];
  unitCount: number | null;
}

export const MENU_CATALOG: MenuCatalogItem[] = [
  { id: 'meeting-a', label: '상견례세트 A', aliases: ['상견례세트 a', '상견례 세트 a'], familyKeywords: ['상견례세트'], unitCount: null },
  { id: 'meeting-b', label: '상견례세트 B', aliases: ['상견례세트 b', '상견례 세트 b'], familyKeywords: ['상견례세트'], unitCount: null },
  { id: 'meeting-c', label: '상견례세트 C', aliases: ['상견례세트 c', '상견례 세트 c'], familyKeywords: ['상견례세트'], unitCount: null },
  { id: 'wagashi-2', label: '화과자 2구', aliases: ['화과자 2구'], familyKeywords: ['화과자'], unitCount: 2 },
  { id: 'wagashi-4', label: '화과자 4구', aliases: ['화과자 4구'], familyKeywords: ['화과자'], unitCount: 4 },
  { id: 'wagashi-6', label: '화과자 6구', aliases: ['화과자 6구'], familyKeywords: ['화과자'], unitCount: 6 },
  { id: 'wagashi-8', label: '화과자 8구', aliases: ['화과자 8구'], familyKeywords: ['화과자'], unitCount: 8 },
  { id: 'wagashi-9', label: '화과자 9구', aliases: ['화과자 9구'], familyKeywords: ['화과자'], unitCount: 9 },
  { id: 'millefeuille-8', label: '곶감밀푀유 8구', aliases: ['곶감밀푀유 8구', '곶감산도 8구'], familyKeywords: ['곶감밀푀유', '곶감산도'], unitCount: 8 },
  { id: 'millefeuille-9', label: '곶감밀푀유 9구', aliases: ['곶감밀푀유 9구', '곶감산도 9구'], familyKeywords: ['곶감밀푀유', '곶감산도'], unitCount: 9 },
  { id: 'millefeuille-gift', label: '곶감밀푀유 선물세트', aliases: ['곶감밀푀유 선물세트'], familyKeywords: ['곶감밀푀유', '곶감산도'], unitCount: null },
  { id: 'roll-signature', label: '시그니처 곶감말이', aliases: ['시그니처 곶감말이', '곶감말이'], familyKeywords: ['곶감말이'], unitCount: null },
  { id: 'roll-jeonggwa', label: '곶감말이 정과세트', aliases: ['곶감말이 정과세트', '곶감말이정과세트'], familyKeywords: ['곶감말이'], unitCount: null },
  { id: 'roll-wagashi', label: '곶감말이 화과자세트', aliases: ['곶감말이 화과자세트', '곶감말이화과자세트'], familyKeywords: ['곶감말이'], unitCount: null },
  { id: 'roll-danji', label: '곶감말이 단지세트', aliases: ['곶감말이 단지세트'], familyKeywords: ['곶감말이'], unitCount: null },
  { id: 'dates-wood-9', label: '대추야자 오동나무 9구 세트', aliases: ['대추야자 오동나무 9구 세트', '대추야자 9구'], familyKeywords: ['대추야자', '데이츠'], unitCount: 9 },
  { id: 'dates-handle-10', label: '대추야자 10구 세트', aliases: ['대추야자 10구 세트', '대추야자 10구'], familyKeywords: ['대추야자', '데이츠'], unitCount: 10 },
  { id: 'dates-premium-15', label: '대추야자 프리미엄 15구 세트', aliases: ['대추야자 프리미엄 15구 세트', '대추야자 15구'], familyKeywords: ['대추야자', '데이츠'], unitCount: 15 },
  { id: 'oranda-monaka-box', label: '오란다&모나카 올인박스', aliases: ['오란다&모나카 올인박스', '오란다 모나카 올인박스'], familyKeywords: ['오란다', '모나카'], unitCount: null },
  { id: 'monaka-round', label: '모나카견과칩 라운드박스', aliases: ['모나카견과칩 라운드박스'], familyKeywords: ['모나카견과칩', '모나카'], unitCount: null },
  { id: 'ricecake-fusion', label: '퓨전찹쌀떡', aliases: ['퓨전찹쌀떡'], familyKeywords: ['퓨전찹쌀떡', '찹쌀떡'], unitCount: null },
  { id: 'kurikinton-9', label: '밤화과자 9구', aliases: ['밤화과자 9구', '쿠리킨톤 9구'], familyKeywords: ['밤화과자', '쿠리킨톤'], unitCount: 9 },
  { id: 'dacquoise-cake', label: '생화쌀다쿠아즈케이크', aliases: ['생화쌀다쿠아즈케이크', '생화 쌀 다쿠아즈 케이크'], familyKeywords: ['다쿠아즈케이크', '다쿠아즈'], unitCount: null },
  { id: 'wrapping-bojagi', label: '보자기 포장', aliases: ['보자기 포장', '보자기'], familyKeywords: ['보자기'], unitCount: null },
  { id: 'wrapping-norigae', label: '노리개 데코 포장', aliases: ['노리개 데코 포장', '노리개'], familyKeywords: ['노리개'], unitCount: null },
];

const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');

const toMatch = (item: MenuCatalogItem, confidence: MenuMatch['confidence']): MenuMatch => ({
  menuId: item.id,
  label: item.label,
  unitCount: item.unitCount,
  confidence,
});

export const findMenuMatches = (text: string): MenuMatch[] => {
  const normalizedText = normalize(text);
  const exactMatches = MENU_CATALOG.filter((item) =>
    item.aliases.some((alias) => normalizedText.includes(normalize(alias))),
  ).map((item) => toMatch(item, 'exact'));

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const familyMatches = MENU_CATALOG.filter((item) =>
    item.familyKeywords.some((keyword) => normalizedText.includes(normalize(keyword))),
  ).map((item) => toMatch(item, 'family'));

  return familyMatches;
};

const PURPOSE_HINTS: Array<{ category: PurposeCategory; hints: string[] }> = [
  { category: '답례품', hints: ['답례품', '기업답례품', '결혼식', '송파답례품'] },
  { category: '상견례/인사', hints: ['상견례', '첫만남', '인사'] },
  { category: '감사 선물', hints: ['부모님', '스승님', '어버이날'] },
  { category: '기념일/행사', hints: ['집들이', '연말선물', '크리스마스선물', '결혼기념'] },
  { category: '단체/기업', hints: ['단체', '기업', '견적', '구매의사', '구매 의사'] },
];

export const mapPurposeFromText = (text: string): PurposeCategory | '' => {
  const normalizedText = normalize(text);
  const matched = PURPOSE_HINTS.find((entry) =>
    entry.hints.some((hint) => normalizedText.includes(normalize(hint))),
  );

  return matched?.category ?? '';
};
```

- [ ] **Step 4: Run catalog tests**

Run:

```bash
npm test -- src/domain/menuCatalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/menuCatalog.ts src/domain/menuCatalog.test.ts
git commit -m "feat: add menu catalog matching rules"
```

## Task 3: Add Date Parsing and D-Day Display Utilities

**Files:**
- Create: `.worktrees/order-standardization-mvp/src/domain/dateDisplay.ts`
- Create: `.worktrees/order-standardization-mvp/src/domain/dateDisplay.test.ts`

- [ ] **Step 1: Write failing date tests**

Create `.worktrees/order-standardization-mvp/src/domain/dateDisplay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDday, parseExplicitDate } from './dateDisplay';

const today = new Date('2026-07-01T09:00:00+09:00');

describe('parseExplicitDate', () => {
  it.each([
    ['7/5', '2026-07-05', ''],
    ['7월 5일 오후 2시', '2026-07-05', '14:00'],
    ['2026-07-05 11:30', '2026-07-05', '11:30'],
  ] as const)('parses explicit date "%s"', (text, isoDate, timeText) => {
    expect(parseExplicitDate(text, today)).toEqual({
      isoDate,
      timeText,
      originalText: text,
      isRelative: false,
    });
  });

  it('keeps relative date text unconfirmed', () => {
    expect(parseExplicitDate('이번 주 금요일 픽업', today)).toEqual({
      isoDate: '',
      timeText: '',
      originalText: '이번 주 금요일',
      isRelative: true,
    });
  });
});

describe('formatDday', () => {
  it.each([
    [{ isoDate: '2026-07-04', timeText: '', originalText: '7월 4일', isRelative: false }, 'D-3', '2026년 7월 4일'],
    [{ isoDate: '2026-07-01', timeText: '14:00', originalText: '7월 1일 오후 2시', isRelative: false }, '오늘 14:00', '2026년 7월 1일 14:00'],
    [{ isoDate: '2026-07-01', timeText: '', originalText: '7월 1일', isRelative: false }, '오늘', '2026년 7월 1일'],
    [{ isoDate: '2026-06-30', timeText: '', originalText: '6월 30일', isRelative: false }, 'D+1', '2026년 6월 30일'],
    [{ isoDate: '', timeText: '', originalText: '이번 주 금요일', isRelative: true }, '날짜 확인 필요', '원문 표현: 이번 주 금요일'],
  ] as const)('formats %o', (value, label, title) => {
    expect(formatDday(value, today)).toEqual({ label, title });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/dateDisplay.test.ts
```

Expected: FAIL with module not found for `./dateDisplay`.

- [ ] **Step 3: Implement date utilities**

Create `.worktrees/order-standardization-mvp/src/domain/dateDisplay.ts`:

```ts
import type { ParsedDateValue } from './orderTypes';

const RELATIVE_DATE_PATTERNS = [
  /이번\s*주\s*[월화수목금토일]요일/,
  /다음\s*주말/,
  /어버이날\s*전/,
  /결혼식\s*전날/,
  /최대한\s*빨리/,
];

const pad = (value: number) => String(value).padStart(2, '0');

const toIsoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

const normalizeHour = (hourText: string, meridiem: string | undefined) => {
  let hour = Number(hourText);

  if (meridiem?.includes('오후') && hour < 12) {
    hour += 12;
  }

  if (meridiem?.includes('오전') && hour === 12) {
    hour = 0;
  }

  return hour;
};

const parseTime = (text: string): string => {
  const timeMatch = /(오전|오후)?\s*(\d{1,2})(?::|시\s*)?(\d{2})?/.exec(text);

  if (!timeMatch) {
    return '';
  }

  const [, meridiem, hourText, minuteText] = timeMatch;
  const hour = normalizeHour(hourText, meridiem);

  if (hour > 23) {
    return '';
  }

  return `${pad(hour)}:${minuteText ?? '00'}`;
};

export const parseExplicitDate = (text: string, today = new Date()): ParsedDateValue | null => {
  const relativeMatch = RELATIVE_DATE_PATTERNS.map((pattern) => pattern.exec(text)).find(Boolean);

  if (relativeMatch) {
    return {
      isoDate: '',
      timeText: '',
      originalText: relativeMatch[0].trim(),
      isRelative: true,
    };
  }

  const fullDateMatch = /(\d{4})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/.exec(text);

  if (fullDateMatch) {
    const originalText = fullDateMatch[0].trim();
    const rest = text.slice(fullDateMatch.index + fullDateMatch[0].length);

    return {
      isoDate: toIsoDate(Number(fullDateMatch[1]), Number(fullDateMatch[2]), Number(fullDateMatch[3])),
      timeText: parseTime(rest),
      originalText: `${originalText}${rest.match(/^\s*(오전|오후)?\s*\d{1,2}(:|시)?\d{0,2}/)?.[0] ?? ''}`.trim(),
      isRelative: false,
    };
  }

  const monthDayMatch = /(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})\s*(?:일)?/.exec(text);

  if (monthDayMatch) {
    const originalText = monthDayMatch[0].trim();
    const rest = text.slice(monthDayMatch.index + monthDayMatch[0].length);

    return {
      isoDate: toIsoDate(today.getFullYear(), Number(monthDayMatch[1]), Number(monthDayMatch[2])),
      timeText: parseTime(rest),
      originalText: `${originalText}${rest.match(/^\s*(오전|오후)?\s*\d{1,2}(:|시)?\d{0,2}/)?.[0] ?? ''}`.trim(),
      isRelative: false,
    };
  }

  return null;
};

export const formatDday = (value: ParsedDateValue | null, today = new Date()) => {
  if (!value) {
    return { label: '희망일 미정', title: '희망일이 비어 있어요' };
  }

  if (value.isRelative || !value.isoDate) {
    return { label: '날짜 확인 필요', title: `원문 표현: ${value.originalText}` };
  }

  const target = new Date(`${value.isoDate}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86_400_000);
  const [year, month, day] = value.isoDate.split('-').map(Number);
  const title = `${year}년 ${month}월 ${day}일${value.timeText ? ` ${value.timeText}` : ''}`;

  if (diffDays === 0) {
    return { label: value.timeText ? `오늘 ${value.timeText}` : '오늘', title };
  }

  return { label: diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`, title };
};
```

- [ ] **Step 4: Run date tests**

Run:

```bash
npm test -- src/domain/dateDisplay.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dateDisplay.ts src/domain/dateDisplay.test.ts
git commit -m "feat: add d-day date parsing"
```

## Task 4: Upgrade Parser for Menu, Purpose, Quantity, Fulfillment, and Date Hints

**Files:**
- Modify: `.worktrees/order-standardization-mvp/src/domain/parser.ts`
- Modify: `.worktrees/order-standardization-mvp/src/domain/parser.test.ts`

- [ ] **Step 1: Write failing parser tests**

In `.worktrees/order-standardization-mvp/src/domain/parser.test.ts`, replace the `does not infer values from free sentences` test with:

```ts
it('extracts consultation-style purpose, menu matches, quantity candidates, and delivery signal', () => {
  const parsed = parseRawText(`결혼식 답례품
대추야자 2구/9구
180개 / 20개 구매 의사 먼저 밝히려고 합니다!!!
택배 가능할까요?`);

  expect(parsed.purpose).toBe('답례품');
  expect(parsed.orderItems).toBe('대추야자 2구/9구');
  expect(parsed.quantity).toBe('180개 / 20개 후보');
  expect(parsed.quantityCandidates).toEqual([
    { value: 180, unit: '개', rawText: '180개' },
    { value: 20, unit: '개', rawText: '20개' },
  ]);
  expect(parsed.menuMatches.map((match) => match.menuId)).toEqual([
    'dates-wood-9',
    'dates-handle-10',
    'dates-premium-15',
  ]);
  expect(parsed.fulfillmentType).toBe('택배');
});
```

Add:

```ts
it('does not treat product unit counts, prices, delivery fees, or phone numbers as quantity candidates', () => {
  const parsed = parseRawText(`연락처: 010-1111-2222
화과자 9구
45,000원
배송비 5,000원
5세트 주문합니다`);

  expect(parsed.quantityCandidates).toEqual([{ value: 5, unit: '세트', rawText: '5세트' }]);
  expect(parsed.quantity).toBe('5세트');
});

it('keeps relative dates as parsed date metadata without filling desired date', () => {
  const parsed = parseRawText('이번 주 금요일 픽업하고 싶어요');

  expect(parsed.desiredDateTime).toBe('');
  expect(parsed.parsedDate).toEqual({
    isoDate: '',
    timeText: '',
    originalText: '이번 주 금요일',
    isRelative: true,
  });
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run:

```bash
npm test -- src/domain/parser.test.ts
```

Expected: FAIL because `parseRawText` does not return new metadata or scoped natural-language values.

- [ ] **Step 3: Update parser return type and imports**

In `.worktrees/order-standardization-mvp/src/domain/parser.ts`, update imports:

```ts
import {
  EMPTY_ORDER_FIELDS,
  FIELD_DEFINITIONS,
  type FulfillmentType,
  type MenuMatch,
  type OrderFieldKey,
  type ParsedDateValue,
  type QuantityCandidate,
} from './orderTypes';
import { parseExplicitDate } from './dateDisplay';
import { findMenuMatches, mapPurposeFromText } from './menuCatalog';
```

Replace `ParsedOrderFields` with:

```ts
type ParsedOrderFields = {
  -readonly [Field in keyof typeof EMPTY_ORDER_FIELDS]: Field extends 'fulfillmentType' ? FulfillmentType : string;
} & {
  menuMatches: MenuMatch[];
  quantityCandidates: QuantityCandidate[];
  parsedDate: ParsedDateValue | null;
};
```

- [ ] **Step 4: Add quantity extraction helpers**

Add below `normalizeRawTextForExactDuplicate`:

```ts
const normalizeLine = (value: string) => value.normalize('NFKC').trim();

const PRODUCT_UNIT_PATTERN = /\d+\s*(구|개입)/g;
const MONEY_PATTERN = /\d{1,3}(?:,\d{3})+\s*원|\d+\s*원/g;
const PHONE_PATTERN = /01\d[-\s]?\d{3,4}[-\s]?\d{4}/g;

const removeNonQuantityNumbers = (value: string) =>
  value.replace(PHONE_PATTERN, ' ')
    .replace(MONEY_PATTERN, ' ')
    .replace(PRODUCT_UNIT_PATTERN, ' ');

const extractQuantityCandidates = (rawText: string): QuantityCandidate[] => {
  const cleaned = removeNonQuantityNumbers(rawText);
  const matches = [...cleaned.matchAll(/(\d+)\s*(세트|개)/g)];

  return matches.map((match) => ({
    value: Number(match[1]),
    unit: match[2] as '개' | '세트',
    rawText: match[0].replace(/\s+/g, ''),
  }));
};

const formatQuantity = (candidates: QuantityCandidate[]) => {
  if (candidates.length === 0) {
    return '';
  }

  if (candidates.length === 1) {
    return candidates[0].rawText;
  }

  return `${candidates.map((candidate) => candidate.rawText).join(' / ')} 후보`;
};
```

- [ ] **Step 5: Add order item line helper**

Add:

```ts
const findConsultationOrderItemLine = (rawText: string, matches: MenuMatch[]) => {
  if (matches.length === 0) {
    return '';
  }

  return rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .find((line) => matches.some((match) => line.includes(match.label.split(' ')[0]) || match.label.includes(line.split(/\s+/)[0])))
    ?? '';
};
```

- [ ] **Step 6: Merge natural-language hints into `parseRawText`**

In `parseRawText`, initialize:

```ts
const parsed: ParsedOrderFields = {
  ...EMPTY_ORDER_FIELDS,
  menuMatches: [],
  quantityCandidates: [],
  parsedDate: null,
};
```

After the labeled-line loop, add:

```ts
const menuMatches = findMenuMatches(rawText);
const quantityCandidates = extractQuantityCandidates(rawText);
const parsedDate = parseExplicitDate(rawText);
const inferredPurpose = mapPurposeFromText(rawText);

parsed.menuMatches = menuMatches;
parsed.quantityCandidates = quantityCandidates;
parsed.parsedDate = parsedDate;

if (!parsed.orderItems) {
  parsed.orderItems = findConsultationOrderItemLine(rawText, menuMatches);
}

if (!parsed.quantity) {
  parsed.quantity = formatQuantity(quantityCandidates);
}

if (!parsed.purpose && inferredPurpose) {
  parsed.purpose = inferredPurpose;
}

if (!parsed.desiredDateTime && parsedDate && !parsedDate.isRelative) {
  parsed.desiredDateTime = parsedDate.timeText ? `${parsedDate.isoDate} ${parsedDate.timeText}` : parsedDate.isoDate;
}

if (!parsed.fulfillmentType) {
  parsed.fulfillmentType = normalizeFulfillmentType(rawText);
}
```

- [ ] **Step 7: Run parser tests**

Run:

```bash
npm test -- src/domain/parser.test.ts src/domain/menuCatalog.test.ts src/domain/dateDisplay.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/parser.ts src/domain/parser.test.ts
git commit -m "feat: parse consultation order hints"
```

## Task 5: Implement Grouped Review Rules and Quantity Conditions

**Files:**
- Modify: `.worktrees/order-standardization-mvp/src/domain/reviewRules.ts`
- Modify: `.worktrees/order-standardization-mvp/src/domain/reviewRules.test.ts`

- [ ] **Step 1: Write failing review rule tests**

In `.worktrees/order-standardization-mvp/src/domain/reviewRules.test.ts`, update `order()` helper to include:

```ts
menuMatches: [],
quantityCandidates: [],
parsedDate: null,
```

Replace the pickup-time conditional test with:

```ts
it('requires address for delivery but does not require pickup time for pickup', () => {
  const delivery = evaluateOrder(
    order({
      orderItems: '곶감밀푀유',
      quantity: '1세트',
      desiredDateTime: '2026-07-03',
      fulfillmentType: '택배',
    }),
    DEFAULT_SETTINGS,
  );
  expect(delivery.missingFields).toContain('address');
  expect(delivery.reviewReasons).toContainEqual(
    expect.objectContaining({ group: 'check', code: 'delivery-check', label: '택배 가능 여부' }),
  );

  const pickup = evaluateOrder(
    order({
      orderItems: '곶감밀푀유',
      quantity: '1세트',
      desiredDateTime: '2026-07-03',
      fulfillmentType: '픽업',
    }),
    DEFAULT_SETTINGS,
  );
  expect(pickup.missingFields).not.toContain('pickupTime');
  expect(pickup.reviewReasons.some((reason) => reason.field === 'pickupTime')).toBe(false);
});
```

Replace the old bulk summing test with:

```ts
it('flags real-unit bulk orders at 40구 or more', () => {
  const evaluated = evaluateOrder(
    order({
      orderItems: '화과자 9구',
      quantity: '5세트',
      desiredDateTime: '2026-07-03',
      fulfillmentType: '픽업',
      menuMatches: [{ menuId: 'wagashi-9', label: '화과자 9구', unitCount: 9, confidence: 'exact' }],
      quantityCandidates: [{ value: 5, unit: '세트', rawText: '5세트' }],
    }),
    DEFAULT_SETTINGS,
  );

  expect(evaluated.reviewReasons).toContainEqual(
    expect.objectContaining({ group: 'check', code: 'bulk-real-unit', label: '대량 기준 가능성' }),
  );
});
```

Add:

```ts
it('flags minimum order rules for shared 2구 and 4구 products', () => {
  const twoPiece = evaluateOrder(
    order({
      orderItems: '화과자 2구',
      quantity: '3세트',
      desiredDateTime: '2026-07-03',
      fulfillmentType: '픽업',
      menuMatches: [{ menuId: 'wagashi-2', label: '화과자 2구', unitCount: 2, confidence: 'exact' }],
      quantityCandidates: [{ value: 3, unit: '세트', rawText: '3세트' }],
    }),
    DEFAULT_SETTINGS,
  );

  expect(twoPiece.reviewReasons).toContainEqual(
    expect.objectContaining({ group: 'check', code: 'minimum-order', label: '최소 주문 조건 확인' }),
  );
});

it('groups ambiguous menu and quantity candidates as concise check items', () => {
  const evaluated = evaluateOrder(
    order({
      orderItems: '대추야자 2구/9구',
      quantity: '180개 / 20개 후보',
      desiredDateTime: '2026-07-03',
      fulfillmentType: '픽업',
      purpose: '답례품',
      menuMatches: [
        { menuId: 'dates-wood-9', label: '대추야자 오동나무 9구 세트', unitCount: 9, confidence: 'family' },
        { menuId: 'dates-handle-10', label: '대추야자 10구 세트', unitCount: 10, confidence: 'family' },
      ],
      quantityCandidates: [
        { value: 180, unit: '개', rawText: '180개' },
        { value: 20, unit: '개', rawText: '20개' },
      ],
    }),
    DEFAULT_SETTINGS,
  );

  expect(evaluated.reviewReasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ group: 'check', code: 'event-purpose', label: '행사/답례품 주문' }),
      expect.objectContaining({ group: 'check', code: 'ambiguous-menu', label: '비슷한 메뉴 여러 개' }),
      expect.objectContaining({ group: 'check', code: 'ambiguous-quantity', label: '수량 후보 여러 개' }),
    ]),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/reviewRules.test.ts
```

Expected: FAIL because current reasons have only repeated sentence messages and old quantity threshold behavior.

- [ ] **Step 3: Implement grouped reason helpers**

In `.worktrees/order-standardization-mvp/src/domain/reviewRules.ts`, add helper:

```ts
const reason = (input: Omit<ReviewReason, 'message'> & { message?: string }): ReviewReason => ({
  ...input,
  message: input.message ?? input.label,
});
```

Replace missing field mapping with:

```ts
...[...missingFields].map((field) =>
  reason({
    kind: '정보 부족' as const,
    group: 'info',
    code: 'missing-field',
    field,
    label: FIELD_DEFINITIONS[field].label,
  }),
),
```

Update duplicate reason preservation to hydrate old shape:

```ts
...order.reviewReasons
  .filter((item) => item.kind === '중복 가능성')
  .map((item) =>
    reason({
      kind: '중복 가능성',
      group: 'check',
      code: 'duplicate-raw-text',
      label: item.label || '중복 가능성',
      detail: item.detail || item.message,
    }),
  ),
```

- [ ] **Step 4: Add quantity rule helpers**

Add:

```ts
const getSingleSetQuantity = (order: CapturedOrder) => {
  if (order.quantityCandidates.length !== 1) {
    return null;
  }

  return order.quantityCandidates[0].unit === '세트' ? order.quantityCandidates[0].value : order.quantityCandidates[0].value;
};

const getKnownUnitCount = (order: CapturedOrder) => {
  const unitCounts = [...new Set(order.menuMatches.map((match) => match.unitCount).filter((value): value is number => value !== null))];

  return unitCounts.length === 1 ? unitCounts[0] : null;
};

const getRealUnitTotal = (order: CapturedOrder) => {
  const unitCount = getKnownUnitCount(order);
  const quantity = getSingleSetQuantity(order);

  return unitCount !== null && quantity !== null ? unitCount * quantity : null;
};
```

- [ ] **Step 5: Add check reasons in `evaluateOrder`**

After missing reason creation, push:

```ts
if (order.purpose && ['상견례/인사', '답례품', '기념일/행사', '감사 선물', '단체/기업'].includes(order.purpose)) {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'event-purpose', field: 'purpose', label: '행사/답례품 주문' }));
}

if (order.menuMatches.length > 1) {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'ambiguous-menu', field: 'orderItems', label: '비슷한 메뉴 여러 개' }));
}

if (order.quantityCandidates.length > 1) {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'ambiguous-quantity', field: 'quantity', label: '수량 후보 여러 개' }));
}

if (order.fulfillmentType === '택배') {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'delivery-check', field: 'fulfillmentType', label: '택배 가능 여부' }));
}

if (order.parsedDate?.isRelative) {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'relative-date', field: 'desiredDateTime', label: '날짜 확인 필요', detail: `원문 표현: ${order.parsedDate.originalText}` }));
}

const unitCount = getKnownUnitCount(order);
const setQuantity = getSingleSetQuantity(order);
const minimumRule = unitCount === null ? undefined : settings.quantityRules.minimumOrderRules.find((rule) => rule.unitCount === unitCount);

if (minimumRule && setQuantity !== null && setQuantity < minimumRule.minimumSets) {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'minimum-order', field: 'quantity', label: '최소 주문 조건 확인', detail: `${unitCount}구 상품은 ${minimumRule.minimumSets}세트 이상 주문 기준입니다.` }));
}

const realUnitTotal = getRealUnitTotal(order);

if (realUnitTotal !== null && realUnitTotal >= settings.quantityRules.bulkRealUnitThreshold) {
  reviewReasons.push(reason({ kind: '확인필요', group: 'check', code: 'bulk-real-unit', field: 'quantity', label: '대량 기준 가능성', detail: `총 ${realUnitTotal}구로 계산됩니다.` }));
}
```

Delete the old `parseQuantity(order.quantity) >= settings.bulkQuantityThreshold` block.

- [ ] **Step 6: Run review tests**

Run:

```bash
npm test -- src/domain/reviewRules.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/reviewRules.ts src/domain/reviewRules.test.ts
git commit -m "feat: evaluate order review groups"
```

## Task 6: Update Capture, List, and Detail UI for Low-Complexity Display

**Files:**
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderCaptureForm.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderList.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderDetail.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderList.test.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/components/OrderDetail.test.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/App.css`

- [ ] **Step 1: Write failing UI tests**

In `OrderList.test.tsx`, update fixture with new metadata fields:

```ts
menuMatches: [],
quantityCandidates: [],
parsedDate: null,
```

Add:

```ts
it('shows D-Day and grouped review counts without exposing internal candidates', () => {
  render(
    <OrderList
      orders={[
        {
          ...order,
          desiredDateTime: '2026-07-04',
          parsedDate: { isoDate: '2026-07-04', timeText: '', originalText: '7월 4일', isRelative: false },
          menuMatches: [
            { menuId: 'dates-wood-9', label: '대추야자 오동나무 9구 세트', unitCount: 9, confidence: 'family' },
            { menuId: 'dates-handle-10', label: '대추야자 10구 세트', unitCount: 10, confidence: 'family' },
          ],
          quantityCandidates: [
            { value: 180, unit: '개', rawText: '180개' },
            { value: 20, unit: '개', rawText: '20개' },
          ],
          reviewReasons: [
            { kind: '정보 부족', group: 'info', code: 'missing-field', field: 'phone', label: '연락처', message: '연락처' },
            { kind: '확인필요', group: 'check', code: 'ambiguous-menu', field: 'orderItems', label: '비슷한 메뉴 여러 개', message: '비슷한 메뉴 여러 개' },
            { kind: '확인필요', group: 'check', code: 'ambiguous-quantity', field: 'quantity', label: '수량 후보 여러 개', message: '수량 후보 여러 개' },
          ],
        },
      ]}
      selectedId={null}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByText('D-3')).toBeInTheDocument();
  expect(screen.getByTitle('2026년 7월 4일')).toBeInTheDocument();
  expect(screen.getByText('채워야 할 정보 1개')).toBeInTheDocument();
  expect(screen.getByText('확인할 내용 2개')).toBeInTheDocument();
  expect(screen.queryByText('대추야자 오동나무 9구 세트')).not.toBeInTheDocument();
});
```

In `OrderDetail.test.tsx`, update `baseOrder` with new metadata fields, then replace group test expectation with:

```ts
expect(within(reviewBox).getByText('채워야 할 정보가 있어요')).toBeInTheDocument();
expect(within(reviewBox).getByText('연락처')).toBeInTheDocument();
expect(within(reviewBox).getByText('희망일')).toBeInTheDocument();
expect(within(reviewBox).getByText('수령 방식')).toBeInTheDocument();
expect(screen.queryByText('아래 항목이 비어 있습니다.')).not.toBeInTheDocument();
```

Add:

```ts
it('shows concise check items without exposing internal menu candidates by default', () => {
  const order = baseOrder({
    reviewReasons: [
      { kind: '확인필요', group: 'check', code: 'ambiguous-menu', field: 'orderItems', label: '비슷한 메뉴 여러 개', message: '비슷한 메뉴 여러 개' },
      { kind: '확인필요', group: 'check', code: 'delivery-check', field: 'fulfillmentType', label: '택배 가능 여부', message: '택배 가능 여부' },
    ],
    menuMatches: [
      { menuId: 'dates-wood-9', label: '대추야자 오동나무 9구 세트', unitCount: 9, confidence: 'family' },
      { menuId: 'dates-handle-10', label: '대추야자 10구 세트', unitCount: 10, confidence: 'family' },
    ],
  });

  render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

  const reviewBox = screen.getByLabelText('확인 필요 사유');

  expect(within(reviewBox).getByText('확인할 내용이 있어요')).toBeInTheDocument();
  expect(within(reviewBox).getByText('비슷한 메뉴 여러 개')).toBeInTheDocument();
  expect(within(reviewBox).getByText('택배 가능 여부')).toBeInTheDocument();
  expect(screen.queryByText('대추야자 오동나무 9구 세트')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run:

```bash
npm test -- src/components/OrderList.test.tsx src/components/OrderDetail.test.tsx
```

Expected: FAIL because D-Day display and grouped reason headings are not implemented.

- [ ] **Step 3: Update `OrderCaptureForm.tsx` base order**

When creating `baseOrder`, ensure the spread from parsed includes the new metadata:

```ts
const baseOrder: CapturedOrder = {
  id: createOrderId(),
  source,
  rawText,
  ...EMPTY_ORDER_FIELDS,
  ...parsed,
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: isDuplicate
    ? [
        {
          kind: '중복 가능성',
          group: 'check',
          code: 'duplicate-raw-text',
          label: '중복 가능성',
          message: '중복 가능성',
          detail: '비슷한 원문이 이미 있어요.',
        },
      ]
    : [],
  warningLevel: 'none',
  status: '수집',
  createdAt: now,
  updatedAt: now,
};
```

Keep preview simple:

```tsx
<div className="previewGrid" aria-label="추출 결과 미리보기">
  <span>주문 내용: {parsed.orderItems || '-'}</span>
  <span>수량: {parsed.quantity || '-'}</span>
  <span>선물 용도: {parsed.purpose || '-'}</span>
  <span>수령 방식: {parsed.fulfillmentType || '-'}</span>
</div>
```

- [ ] **Step 4: Update `OrderList.tsx`**

Import:

```ts
import { formatDday } from '../domain/dateDisplay';
```

Add helper:

```ts
const countReasons = (order: CapturedOrder, group: 'info' | 'check') =>
  order.reviewReasons.filter((reason) => reason.group === group).length;
```

Update `summarizeOrder` to stop appending `개` unconditionally:

```ts
const summarizeOrder = (order: CapturedOrder) => {
  const item = fallback(order.orderItems, '주문 내용 미정');
  const quantity = order.quantity.trim() ? order.quantity : '수량 미정';

  return `${item} · ${quantity}`;
};
```

Inside each row:

```ts
const dday = formatDday(order.parsedDate);
const infoCount = countReasons(order, 'info');
const checkCount = countReasons(order, 'check');
```

Replace raw desired date text in card and compact mode with:

```tsx
<span className="dateBadge" title={dday.title} tabIndex={0}>{dday.label}</span>
```

Add grouped flags in card mode:

```tsx
{infoCount > 0 ? <span className="flagOn">채워야 할 정보 {infoCount}개</span> : null}
{checkCount > 0 ? <span className="flagOn">확인할 내용 {checkCount}개</span> : null}
```

Remove the old `부족 항목:` list from `rawTextArea`; keep raw text expansion only when `infoCount > 0`.

- [ ] **Step 5: Update `OrderDetail.tsx` reason grouping**

Replace reason grouping logic with:

```ts
const infoReasons = order.reviewReasons.filter((reason) => reason.group === 'info');
const checkReasons = order.reviewReasons.filter((reason) => reason.group === 'check');
```

Replace `reviewReasonBox` contents with:

```tsx
{order.reviewReasons.length > 0 ? (
  <div className="reviewReasonBox" aria-label="확인 필요 사유">
    {infoReasons.length > 0 ? (
      <div>
        <p>채워야 할 정보가 있어요</p>
        <ul>
          {infoReasons.map((reason) => (
            <li key={`${reason.code}-${reason.field ?? reason.label}`}>{reason.label}</li>
          ))}
        </ul>
      </div>
    ) : null}
    {checkReasons.length > 0 ? (
      <div>
        <p>확인할 내용이 있어요</p>
        <ul>
          {checkReasons.map((reason) => (
            <li key={`${reason.code}-${reason.field ?? reason.label}`}>
              {reason.label}
              {reason.detail ? <span className="reasonDetail"> {reason.detail}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
) : null}
```

- [ ] **Step 6: Add CSS**

In `.worktrees/order-standardization-mvp/src/App.css`, add:

```css
.dateBadge {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border: 1px solid #e2d5bf;
  border-radius: 999px;
  background: #fffdf8;
  color: #5b4322;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 800;
}

.reasonDetail {
  color: #746956;
  font-size: 12px;
  font-weight: 500;
}
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
npm test -- src/components/OrderList.test.tsx src/components/OrderDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/OrderCaptureForm.tsx src/components/OrderList.tsx src/components/OrderDetail.tsx src/components/OrderList.test.tsx src/components/OrderDetail.test.tsx src/App.css
git commit -m "feat: show concise order review groups"
```

## Task 7: Update Settings Modal for Required Fields and Real-Unit Quantity Rules

**Files:**
- Modify: `.worktrees/order-standardization-mvp/src/components/SettingsModal.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/components/SettingsModal.test.tsx`
- Modify: `.worktrees/order-standardization-mvp/src/domain/storage.test.ts`

- [ ] **Step 1: Write failing settings tests**

In `SettingsModal.test.tsx`, add or update tests:

```ts
it('shows quiet default required fields and real-unit quantity threshold', () => {
  render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByLabelText('주문 내용')).toBeChecked();
  expect(screen.getByLabelText('수량')).toBeChecked();
  expect(screen.getByLabelText('희망일')).toBeChecked();
  expect(screen.getByLabelText('수령 방식')).toBeChecked();
  expect(screen.getByLabelText('고객명')).not.toBeChecked();
  expect(screen.getByLabelText('연락처')).not.toBeChecked();
  expect(screen.getByLabelText('대량 기준 총 구성 수량')).toHaveValue(40);
  expect(screen.queryByText(/픽업 시간은 픽업 주문일 때만/)).not.toBeInTheDocument();
});

it('saves required fields and real-unit quantity rules', async () => {
  const onSave = vi.fn();

  render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={vi.fn()} onSave={onSave} />);

  await userEvent.clear(screen.getByLabelText('대량 기준 총 구성 수량'));
  await userEvent.type(screen.getByLabelText('대량 기준 총 구성 수량'), '45');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      quantityRules: {
        bulkRealUnitThreshold: 45,
        minimumOrderRules: [
          { unitCount: 2, minimumSets: 5 },
          { unitCount: 4, minimumSets: 2 },
        ],
      },
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/components/SettingsModal.test.tsx
```

Expected: FAIL because modal still uses `bulkQuantityThreshold` and pickup time note.

- [ ] **Step 3: Update `SettingsModal.tsx` state and save**

Replace:

```ts
const [bulkQuantityThreshold, setBulkQuantityThreshold] = useState(String(settings.bulkQuantityThreshold));
```

with:

```ts
const [bulkRealUnitThreshold, setBulkRealUnitThreshold] = useState(String(settings.quantityRules.bulkRealUnitThreshold));
```

In `useEffect`, replace threshold setter:

```ts
setBulkRealUnitThreshold(String(settings.quantityRules.bulkRealUnitThreshold));
```

In `handleSave`, replace parsed threshold logic:

```ts
const parsedThreshold = Number(bulkRealUnitThreshold);
const nextSettings: OrderSettings = {
  requiredFields: [...requiredFields],
  conditionalRequiredFields: {
    address: { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
  },
  quantityRules: {
    bulkRealUnitThreshold:
      Number.isFinite(parsedThreshold) && parsedThreshold > 0
        ? Math.floor(parsedThreshold)
        : settings.quantityRules.bulkRealUnitThreshold,
    minimumOrderRules: DEFAULT_SETTINGS.quantityRules.minimumOrderRules.map((rule) => ({ ...rule })),
  },
};
```

Replace setting input label:

```tsx
<label className="settingInput">
  대량 기준 총 구성 수량
  <input
    type="number"
    min="1"
    inputMode="numeric"
    value={bulkRealUnitThreshold}
    onChange={(event) => setBulkRealUnitThreshold(event.target.value)}
  />
</label>
```

Replace settings note:

```tsx
<p className="settingsNote">택배 주소는 택배 주문일 때만 추가로 확인합니다. 2구 상품은 5세트 이상, 4구 상품은 2세트 이상을 기본 최소 주문 조건으로 봅니다.</p>
```

- [ ] **Step 4: Run settings tests**

Run:

```bash
npm test -- src/components/SettingsModal.test.tsx src/domain/storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/SettingsModal.test.tsx src/domain/storage.test.ts
git commit -m "feat: configure real-unit quantity rules"
```

## Task 8: Full Verification and Polish Pass

**Files:**
- Modify as needed only if tests expose integration issues.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Vitest suites.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript build and Vite build completing.

- [ ] **Step 3: Manual smoke check**

Run:

```bash
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173` and manually enter:

```text
결혼식 답례품
대추야자 2구/9구
180개 / 20개 구매 의사 먼저 밝히려고 합니다!!!
택배 가능할까요?
```

Expected:

- Preview shows `주문 내용: 대추야자 2구/9구`
- Preview shows `수량: 180개 / 20개 후보`
- Saved order status becomes `확인필요`
- List does not show internal menu match names
- Detail shows `확인할 내용이 있어요`
- Detail includes `행사/답례품 주문`, `비슷한 메뉴 여러 개`, `수량 후보 여러 개`, `택배 가능 여부`

Stop the dev server after verification.

- [ ] **Step 4: Commit verification fixes if any**

If Step 1 or Step 2 required fixes:

```bash
git add src
git commit -m "fix: stabilize intake parser refinement"
```

If no fixes were needed, do not create an empty commit.

## Self-Review Checklist

- Spec coverage:
  - Menu catalog and purpose mapping: Task 2.
  - Label plus consultation parsing: Task 4.
  - Quantity candidates and real-unit bulk threshold: Tasks 1, 4, 5, 7.
  - Minimum order rules for 2구 and 4구: Tasks 1, 5, 7.
  - D-Day display and original-date title: Tasks 3, 6.
  - Grouped `채워야 할 정보` and `확인할 내용`: Tasks 5, 6.
  - Low-complexity UI hiding internal menu candidates: Task 6.
  - Manual edit protection: Existing `mergeParsedFields` remains covered by `reviewRules.test.ts`; Task 4 parser metadata must not change that behavior.
  - Storage compatibility: Task 1.
- Placeholder scan: no placeholder tasks; each task contains target files, test snippets, implementation snippets, commands, and expected results.
- Type consistency:
  - `menuMatches`, `quantityCandidates`, and `parsedDate` are added to `CapturedOrder` and parser output.
  - `quantityRules` replaces `bulkQuantityThreshold` in settings.
  - `ReviewReason.group`, `code`, and `label` are required for new reasons and hydrated for duplicate reasons.
