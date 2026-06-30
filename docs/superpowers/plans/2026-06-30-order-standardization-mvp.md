# Order Standardization MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 Lyru OMS order/inquiry standardization MVP: paste raw messages, extract labeled fields, preserve raw text, flag missing/review-needed items, and let the owner organize each item without losing information.

**Architecture:** Create a Vite + React + TypeScript single-page mobile-first web app. Keep business rules in pure TypeScript modules under `src/domain/` with Vitest coverage, persist MVP data in `localStorage`, and keep UI components focused under `src/components/`.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, `@testing-library/user-event`, CSS modules via plain CSS files, browser `localStorage`.

---

## File Structure

- Create `package.json`, `index.html`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.setup.ts`: project scaffold and test setup.
- Create `src/main.tsx`, `src/App.tsx`, `src/App.css`: app entry and screen composition.
- Create `src/domain/orderTypes.ts`: canonical types, labels, statuses, settings, and constants.
- Create `src/domain/parser.ts`: label/keyword parser and raw-text duplicate detection helpers.
- Create `src/domain/reviewRules.ts`: required-field, review-reason, warning-level, and status transition rules.
- Create `src/domain/storage.ts`: localStorage repository and sample-safe serialization.
- Create `src/domain/orderTypes.test.ts`, `src/domain/parser.test.ts`, `src/domain/reviewRules.test.ts`, `src/domain/storage.test.ts`: fast unit tests for domain rules.
- Create `src/components/QuestionNote.tsx`: collapsible temporary owner-question note.
- Create `src/components/SettingsModal.tsx`: required-field and bulk-quantity settings modal.
- Create `src/components/OrderCaptureForm.tsx`: source/raw-text capture, extracted field editing, save flow.
- Create `src/components/OrderList.tsx`: mobile-first list with warning/reason summaries and raw-text expansion for information-shortage items.
- Create `src/components/OrderDetail.tsx`: detail/edit panel with separated customer request and owner memo areas.
- Create `src/components/ReparseHint.tsx`: neutral dot + hover/touch explanation for reparse differences.
- Create `src/components/*.test.tsx`: component tests for expected user flows.

## Task 1: Scaffold Vite React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lyru-oms",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create Vite config files**

`index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lyru OMS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Create minimal app entry**

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="appShell">
      <header className="appHeader">
        <p className="eyebrow">Lyru OMS</p>
        <h1>주문 수집</h1>
      </header>
    </main>
  );
}
```

`src/App.css`:

```css
:root {
  color: #1b2430;
  background: #f8f6f1;
  font-family:
    Pretendard,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.appShell {
  min-height: 100vh;
  padding: 20px;
}

.appHeader {
  max-width: 1120px;
  margin: 0 auto 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #8a6f3e;
  font-size: 13px;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: 0;
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and install completes without errors.

- [ ] **Step 5: Run scaffold checks**

Run: `npm run test`

Expected: Vitest exits successfully with no tests or a no-test warning depending on Vitest version.

Run: `npm run build`

Expected: TypeScript and Vite build complete.

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts vitest.setup.ts src
git commit -m "chore: scaffold order standardization app"
```

## Task 2: Domain Types and Defaults

**Files:**
- Create: `src/domain/orderTypes.ts`
- Create: `src/domain/orderTypes.test.ts`

- [ ] **Step 1: Write the failing type/default tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  FIELD_DEFINITIONS,
  ORDER_SOURCES,
  ORDER_STATUSES,
} from './orderTypes';

describe('orderTypes defaults', () => {
  it('uses the confirmed three capture statuses', () => {
    expect(ORDER_STATUSES).toEqual(['수집', '확인필요', '정리 완료']);
  });

  it('keeps Phase 1 default required fields and conditional fields', () => {
    expect(DEFAULT_SETTINGS.requiredFields).toEqual([
      'customerName',
      'phone',
      'orderItems',
      'quantity',
      'desiredDateTime',
      'fulfillmentType',
    ]);
    expect(DEFAULT_SETTINGS.conditionalRequiredFields).toEqual({
      address: { field: 'fulfillmentType', equals: '택배' },
      pickupTime: { field: 'fulfillmentType', equals: '픽업' },
    });
    expect(DEFAULT_SETTINGS.bulkQuantityThreshold).toBe(5);
  });

  it('contains source and field labels shown to the owner', () => {
    expect(ORDER_SOURCES).toContain('카카오톡 채널');
    expect(FIELD_DEFINITIONS.customerRequestNote.label).toBe('고객 요청사항');
    expect(FIELD_DEFINITIONS.ownerMemo.label).toBe('사장님 내부 메모');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/domain/orderTypes.test.ts`

Expected: FAIL because `src/domain/orderTypes.ts` does not exist.

- [ ] **Step 3: Implement `orderTypes.ts`**

```ts
export const ORDER_SOURCES = [
  '카카오톡 채널',
  '인스타그램',
  '네이버 톡톡',
  '네이버 스마트스토어',
  '네이버예약',
  '기타',
] as const;

export const ORDER_STATUSES = ['수집', '확인필요', '정리 완료'] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type WarningLevel = 'none' | 'attention';

export type FulfillmentType = '' | '픽업' | '택배';

export type OrderFieldKey =
  | 'customerName'
  | 'phone'
  | 'orderItems'
  | 'quantity'
  | 'purpose'
  | 'fulfillmentType'
  | 'desiredDateTime'
  | 'pickupTime'
  | 'address'
  | 'allergyNote'
  | 'options'
  | 'customerRequestNote'
  | 'ownerMemo';

export type ReviewReasonKind = '정보 부족' | '확인필요' | '중복 가능성';

export interface ReviewReason {
  kind: ReviewReasonKind;
  field?: OrderFieldKey;
  message: string;
}

export interface ConditionalRequiredField {
  field: OrderFieldKey;
  equals: string;
}

export interface OrderSettings {
  requiredFields: OrderFieldKey[];
  conditionalRequiredFields: Partial<Record<OrderFieldKey, ConditionalRequiredField>>;
  bulkQuantityThreshold: number;
}

export interface ReparseDifference {
  field: OrderFieldKey;
  extractedValue: string;
}

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
  manuallyEditedFields: OrderFieldKey[];
  reparseDifferences: ReparseDifference[];
  missingFields: OrderFieldKey[];
  reviewReasons: ReviewReason[];
  warningLevel: WarningLevel;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export const FIELD_DEFINITIONS: Record<OrderFieldKey, { label: string; keywords: string[] }> = {
  customerName: { label: '고객명', keywords: ['성함', '이름', '고객명'] },
  phone: { label: '연락처', keywords: ['연락처', '전화번호', '휴대폰'] },
  orderItems: { label: '주문 내용', keywords: ['주문 내용', '주문상품', '상품'] },
  quantity: { label: '수량', keywords: ['수량', '개수', '주문 수량'] },
  purpose: { label: '선물 용도', keywords: ['선물 용도', '용도'] },
  fulfillmentType: { label: '수령 방식', keywords: ['픽업/택배', '수령 방식', '수령방법'] },
  desiredDateTime: { label: '희망일', keywords: ['픽업 날짜 및 시간', '희망일', '희망 날짜', '배송 날짜'] },
  pickupTime: { label: '픽업 시간', keywords: ['픽업 시간', '방문 시간'] },
  address: { label: '택배 주소', keywords: ['택배 주소', '주소', '배송지'] },
  allergyNote: { label: '알레르기', keywords: ['견과류 알레르기 유무', '알레르기'] },
  options: { label: '추가 옵션', keywords: ['추가 옵션', '보자기/노리개/꽃'] },
  customerRequestNote: { label: '고객 요청사항', keywords: ['요청사항', '기타 요청사항', '메모'] },
  ownerMemo: { label: '사장님 내부 메모', keywords: [] },
};

export const DEFAULT_SETTINGS: OrderSettings = {
  requiredFields: ['customerName', 'phone', 'orderItems', 'quantity', 'desiredDateTime', 'fulfillmentType'],
  conditionalRequiredFields: {
    address: { field: 'fulfillmentType', equals: '택배' },
    pickupTime: { field: 'fulfillmentType', equals: '픽업' },
  },
  bulkQuantityThreshold: 5,
};

export const EMPTY_ORDER_FIELDS = {
  customerName: '',
  phone: '',
  orderItems: '',
  quantity: '',
  purpose: '',
  fulfillmentType: '' as FulfillmentType,
  desiredDateTime: '',
  pickupTime: '',
  address: '',
  allergyNote: '',
  options: '',
  customerRequestNote: '',
  ownerMemo: '',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/domain/orderTypes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit domain defaults**

```bash
git add src/domain/orderTypes.ts src/domain/orderTypes.test.ts
git commit -m "feat: define order standardization domain types"
```

## Task 3: Label Parser and Duplicate Detection

**Files:**
- Create: `src/domain/parser.ts`
- Create: `src/domain/parser.test.ts`

- [ ] **Step 1: Write parser tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseRawText, hasSimilarRawText } from './parser';

describe('parseRawText', () => {
  it('extracts known labels and related keywords', () => {
    const parsed = parseRawText(`성함: 김리루
전화번호: 010-1111-2222
상품: 곶감밀푀유 4구
개수: 5
수령방법: 택배
배송지: 서울시 강남구
요청사항: 선물이라 예쁘게 부탁드려요`);

    expect(parsed.customerName).toBe('김리루');
    expect(parsed.phone).toBe('010-1111-2222');
    expect(parsed.orderItems).toBe('곶감밀푀유 4구');
    expect(parsed.quantity).toBe('5');
    expect(parsed.fulfillmentType).toBe('택배');
    expect(parsed.address).toBe('서울시 강남구');
    expect(parsed.customerRequestNote).toBe('선물이라 예쁘게 부탁드려요');
  });

  it('does not infer values from free sentences', () => {
    const parsed = parseRawText('김리루 고객님이 내일 픽업하고 싶다고 하심');
    expect(parsed.customerName).toBe('');
    expect(parsed.desiredDateTime).toBe('');
    expect(parsed.fulfillmentType).toBe('');
  });
});

describe('hasSimilarRawText', () => {
  it('flags exact or near-exact raw text as duplicate possibility', () => {
    expect(hasSimilarRawText('성함: 김리루\n수량: 5', [' 성함: 김리루 수량: 5 '])).toBe(true);
  });

  it('does not flag unrelated messages', () => {
    expect(hasSimilarRawText('성함: 김리루', ['성함: 박화과'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/domain/parser.test.ts`

Expected: FAIL because `parser.ts` does not exist.

- [ ] **Step 3: Implement `parser.ts`**

```ts
import { EMPTY_ORDER_FIELDS, FIELD_DEFINITIONS, OrderFieldKey } from './orderTypes';

type ParsedFields = typeof EMPTY_ORDER_FIELDS;

const parseableFields = Object.keys(FIELD_DEFINITIONS).filter(
  (field) => field !== 'ownerMemo',
) as OrderFieldKey[];

function normalizeLabel(label: string) {
  return label.replace(/\s+/g, '').toLowerCase();
}

function normalizeRawText(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeFulfillmentType(value: string) {
  if (value.includes('택배')) return '택배';
  if (value.includes('픽업') || value.includes('방문')) return '픽업';
  return '';
}

function parseLine(line: string) {
  const match = line.match(/^([^:：\-\n]+)\s*[:：-]\s*(.+)$/);
  if (!match) return null;
  return { label: normalizeLabel(match[1]), value: match[2].trim() };
}

export function parseRawText(rawText: string): ParsedFields {
  const parsed: ParsedFields = { ...EMPTY_ORDER_FIELDS };

  for (const line of rawText.split(/\r?\n/)) {
    const entry = parseLine(line.trim());
    if (!entry) continue;

    const field = parseableFields.find((candidate) =>
      FIELD_DEFINITIONS[candidate].keywords.some((keyword) => normalizeLabel(keyword) === entry.label),
    );

    if (!field || parsed[field]) continue;

    if (field === 'fulfillmentType') {
      parsed.fulfillmentType = normalizeFulfillmentType(entry.value);
    } else {
      parsed[field] = entry.value;
    }
  }

  return parsed;
}

export function hasSimilarRawText(rawText: string, existingRawTexts: string[]) {
  const normalized = normalizeRawText(rawText);
  if (!normalized) return false;
  return existingRawTexts.some((existing) => normalizeRawText(existing) === normalized);
}
```

- [ ] **Step 4: Run parser tests**

Run: `npm run test -- src/domain/parser.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit parser**

```bash
git add src/domain/parser.ts src/domain/parser.test.ts
git commit -m "feat: parse labeled order text"
```

## Task 4: Review Rules and Status Transitions

**Files:**
- Create: `src/domain/reviewRules.ts`
- Create: `src/domain/reviewRules.test.ts`

- [ ] **Step 1: Write review-rule tests**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, EMPTY_ORDER_FIELDS, CapturedOrder } from './orderTypes';
import { evaluateOrder, mergeParsedFields } from './reviewRules';

function order(overrides: Partial<CapturedOrder>): CapturedOrder {
  return {
    id: 'order-1',
    source: '카카오톡 채널',
    rawText: '성함: 김리루',
    ...EMPTY_ORDER_FIELDS,
    manuallyEditedFields: [],
    reparseDifferences: [],
    missingFields: [],
    reviewReasons: [],
    warningLevel: 'none',
    status: '수집',
    createdAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateOrder', () => {
  it('marks missing required fields and automatically sets 확인필요', () => {
    const evaluated = evaluateOrder(order({ customerName: '김리루' }), DEFAULT_SETTINGS);
    expect(evaluated.status).toBe('확인필요');
    expect(evaluated.warningLevel).toBe('attention');
    expect(evaluated.missingFields).toContain('phone');
  });

  it('requires address only for 택배 and pickup time only for 픽업', () => {
    const delivery = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '곶감밀푀유',
        quantity: '1',
        desiredDateTime: '7월 3일',
        fulfillmentType: '택배',
      }),
      DEFAULT_SETTINGS,
    );
    expect(delivery.missingFields).toContain('address');
    expect(delivery.missingFields).not.toContain('pickupTime');

    const pickup = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '곶감밀푀유',
        quantity: '1',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
      }),
      DEFAULT_SETTINGS,
    );
    expect(pickup.missingFields).toContain('pickupTime');
    expect(pickup.missingFields).not.toContain('address');
  });

  it('does not revert 정리 완료 even when settings would flag it', () => {
    const evaluated = evaluateOrder(order({ status: '정리 완료', quantity: '10' }), DEFAULT_SETTINGS);
    expect(evaluated.status).toBe('정리 완료');
    expect(evaluated.reviewReasons.some((reason) => reason.message.includes('대량'))).toBe(true);
  });
});

describe('mergeParsedFields', () => {
  it('keeps manually edited fields and records neutral reparse differences', () => {
    const merged = mergeParsedFields(
      order({ phone: '010-9999-9999', manuallyEditedFields: ['phone'] }),
      { ...EMPTY_ORDER_FIELDS, phone: '010-1111-2222' },
    );

    expect(merged.phone).toBe('010-9999-9999');
    expect(merged.reparseDifferences).toEqual([{ field: 'phone', extractedValue: '010-1111-2222' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/domain/reviewRules.test.ts`

Expected: FAIL because `reviewRules.ts` does not exist.

- [ ] **Step 3: Implement `reviewRules.ts`**

```ts
import {
  CapturedOrder,
  EMPTY_ORDER_FIELDS,
  FIELD_DEFINITIONS,
  OrderFieldKey,
  OrderSettings,
  ReviewReason,
} from './orderTypes';

type ParsedFields = typeof EMPTY_ORDER_FIELDS;

function hasValue(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

function parseQuantity(quantity: string) {
  const match = quantity.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function evaluateOrder(order: CapturedOrder, settings: OrderSettings): CapturedOrder {
  const missingFields: OrderFieldKey[] = [];
  const reviewReasons: ReviewReason[] = [];

  for (const field of settings.requiredFields) {
    if (!hasValue(order[field])) missingFields.push(field);
  }

  for (const [field, condition] of Object.entries(settings.conditionalRequiredFields) as [
    OrderFieldKey,
    { field: OrderFieldKey; equals: string },
  ][]) {
    if (order[condition.field] === condition.equals && !hasValue(order[field])) {
      missingFields.push(field);
    }
  }

  for (const field of missingFields) {
    reviewReasons.push({
      kind: '정보 부족',
      field,
      message: `${FIELD_DEFINITIONS[field].label} 정보가 비어 있어요.`,
    });
  }

  if (parseQuantity(order.quantity) >= settings.bulkQuantityThreshold) {
    reviewReasons.push({
      kind: '확인필요',
      field: 'quantity',
      message: `수량 ${settings.bulkQuantityThreshold}개 이상이라 미리 확인이 필요해요.`,
    });
  }

  const warningLevel = reviewReasons.length > 0 ? 'attention' : 'none';
  const status = order.status === '정리 완료' ? '정리 완료' : warningLevel === 'attention' ? '확인필요' : order.status;

  return { ...order, missingFields, reviewReasons, warningLevel, status };
}

export function mergeParsedFields(order: CapturedOrder, parsed: ParsedFields): CapturedOrder {
  const next: CapturedOrder = { ...order, reparseDifferences: [] };

  for (const field of Object.keys(parsed) as OrderFieldKey[]) {
    const parsedValue = parsed[field];
    if (!parsedValue) continue;

    if (order.manuallyEditedFields.includes(field)) {
      if (order[field] !== parsedValue) {
        next.reparseDifferences.push({ field, extractedValue: String(parsedValue) });
      }
      continue;
    }

    if (!hasValue(order[field])) {
      (next[field] as string) = parsedValue;
    }
  }

  return next;
}
```

- [ ] **Step 4: Run review-rule tests**

Run: `npm run test -- src/domain/reviewRules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit review rules**

```bash
git add src/domain/reviewRules.ts src/domain/reviewRules.test.ts
git commit -m "feat: evaluate order review status"
```

## Task 5: Local Storage Repository

**Files:**
- Create: `src/domain/storage.ts`
- Create: `src/domain/storage.test.ts`

- [ ] **Step 1: Write storage tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './orderTypes';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadOrders()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips orders and settings', () => {
    saveOrders([{ id: '1', rawText: '성함: 김리루' } as never]);
    saveSettings({ ...DEFAULT_SETTINGS, bulkQuantityThreshold: 7 });

    expect(loadOrders()).toHaveLength(1);
    expect(loadSettings().bulkQuantityThreshold).toBe(7);
  });
});
```

- [ ] **Step 2: Run storage test to verify it fails**

Run: `npm run test -- src/domain/storage.test.ts`

Expected: FAIL because `storage.ts` does not exist.

- [ ] **Step 3: Implement `storage.ts`**

```ts
import { CapturedOrder, DEFAULT_SETTINGS, OrderSettings } from './orderTypes';

const ORDERS_KEY = 'lyru-oms.orders.v1';
const SETTINGS_KEY = 'lyru-oms.settings.v1';

export function loadOrders(): CapturedOrder[] {
  const raw = localStorage.getItem(ORDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CapturedOrder[];
  } catch {
    return [];
  }
}

export function saveOrders(orders: CapturedOrder[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function loadSettings(): OrderSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<OrderSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: OrderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
```

- [ ] **Step 4: Run storage tests**

Run: `npm run test -- src/domain/storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit storage**

```bash
git add src/domain/storage.ts src/domain/storage.test.ts
git commit -m "feat: persist captured orders locally"
```

## Task 6: Capture Screen Components

**Files:**
- Create: `src/components/QuestionNote.tsx`
- Create: `src/components/ReparseHint.tsx`
- Create: `src/components/OrderCaptureForm.tsx`
- Create: `src/components/OrderCaptureForm.test.tsx`

- [ ] **Step 1: Write component tests for capture behavior**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/orderTypes';
import { OrderCaptureForm } from './OrderCaptureForm';

describe('OrderCaptureForm', () => {
  it('saves raw text even when required fields are missing', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await userEvent.selectOptions(screen.getByLabelText('출처'), '카카오톡 채널');
    await userEvent.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      rawText: '성함: 김리루',
      customerName: '김리루',
      status: '확인필요',
    }));
  });

  it('shows duplicate possibility but still allows save', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={['성함: 김리루']} settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await userEvent.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
    expect(screen.getByText('비슷한 원문이 이미 있어요. 그래도 저장할 수 있습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run component test to verify it fails**

Run: `npm run test -- src/components/OrderCaptureForm.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `QuestionNote.tsx`**

```tsx
import { useState } from 'react';

const questions = [
  '몇 개부터 미리 확인해야 하는 큰 주문으로 보시나요?',
  '택배 주문에서 꼭 빠지면 안 되는 정보는 무엇인가요?',
  '픽업 주문에서 꼭 빠지면 안 되는 정보는 무엇인가요?',
  '주문 메시지에서 자주 빠지는 정보는 무엇인가요?',
  '고객님들이 이름, 연락처, 주소 같은 정보를 보통 어떤 표현으로 적어주시나요?',
  '어떤 표현이 있으면 맞춤 요청으로 따로 확인해야 하나요?',
];

export function QuestionNote() {
  const [open, setOpen] = useState(true);

  return (
    <section className="questionNote" aria-label="확인 질문 쪽지">
      <button type="button" className="noteToggle" onClick={() => setOpen((value) => !value)}>
        사장님께 확인할 질문 {open ? '접기' : '보기'}
      </button>
      {open ? (
        <div className="noteBody">
          <p>아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.</p>
          <ul>
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Implement `ReparseHint.tsx`**

```tsx
interface ReparseHintProps {
  extractedValue: string;
}

export function ReparseHint({ extractedValue }: ReparseHintProps) {
  return (
    <span className="reparseHint" tabIndex={0} aria-label={`원문에서는 이렇게 가져왔어요: ${extractedValue}`}>
      <span aria-hidden="true" className="reparseDot" />
      <span className="reparseTooltip">원문에서는 이렇게 가져왔어요: {extractedValue}</span>
    </span>
  );
}
```

- [ ] **Step 5: Implement `OrderCaptureForm.tsx`**

```tsx
import { FormEvent, useMemo, useState } from 'react';
import { EMPTY_ORDER_FIELDS, ORDER_SOURCES, OrderSettings, OrderSource, CapturedOrder } from '../domain/orderTypes';
import { hasSimilarRawText, parseRawText } from '../domain/parser';
import { evaluateOrder } from '../domain/reviewRules';

interface OrderCaptureFormProps {
  existingRawTexts: string[];
  settings: OrderSettings;
  onSave: (order: CapturedOrder) => void;
}

export function OrderCaptureForm({ existingRawTexts, settings, onSave }: OrderCaptureFormProps) {
  const [source, setSource] = useState<OrderSource>('카카오톡 채널');
  const [rawText, setRawText] = useState('');

  const parsed = useMemo(() => parseRawText(rawText), [rawText]);
  const isDuplicate = hasSimilarRawText(rawText, existingRawTexts);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    const baseOrder: CapturedOrder = {
      id: crypto.randomUUID(),
      source,
      rawText,
      ...EMPTY_ORDER_FIELDS,
      ...parsed,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: [],
      warningLevel: 'none',
      status: '수집',
      createdAt: now,
      updatedAt: now,
    };
    onSave(evaluateOrder(baseOrder, settings));
    setRawText('');
  }

  return (
    <form className="captureForm" onSubmit={handleSubmit}>
      <label>
        출처
        <select value={source} onChange={(event) => setSource(event.target.value as OrderSource)}>
          {ORDER_SOURCES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        주문/문의 원문
        <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={8} />
      </label>
      {isDuplicate ? <p className="softWarning">비슷한 원문이 이미 있어요. 그래도 저장할 수 있습니다.</p> : null}
      <div className="previewGrid" aria-label="추출 결과 미리보기">
        <span>고객명: {parsed.customerName || '-'}</span>
        <span>연락처: {parsed.phone || '-'}</span>
        <span>주문 내용: {parsed.orderItems || '-'}</span>
        <span>수량: {parsed.quantity || '-'}</span>
      </div>
      <button type="submit" disabled={!rawText.trim()}>
        저장
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Run capture component tests**

Run: `npm run test -- src/components/OrderCaptureForm.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit capture components**

```bash
git add src/components/QuestionNote.tsx src/components/ReparseHint.tsx src/components/OrderCaptureForm.tsx src/components/OrderCaptureForm.test.tsx
git commit -m "feat: capture raw order messages"
```

## Task 7: Settings, List, and Detail UI

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Create: `src/components/OrderList.tsx`
- Create: `src/components/OrderDetail.tsx`
- Create: `src/components/OrderList.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write list/detail behavior tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_ORDER_FIELDS, CapturedOrder } from '../domain/orderTypes';
import { OrderList } from './OrderList';

const order: CapturedOrder = {
  id: '1',
  source: '카카오톡 채널',
  rawText: '성함: 김리루',
  ...EMPTY_ORDER_FIELDS,
  customerName: '김리루',
  orderItems: '곶감밀푀유',
  quantity: '5',
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: ['phone'],
  reviewReasons: [{ kind: '정보 부족', field: 'phone', message: '연락처 정보가 비어 있어요.' }],
  warningLevel: 'attention',
  status: '확인필요',
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
};

describe('OrderList', () => {
  it('does not show full raw text until expanded for information shortage', async () => {
    render(<OrderList orders={[order]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText('성함: 김리루')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('성함: 김리루')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/OrderList.test.tsx`

Expected: FAIL because `OrderList.tsx` does not exist.

- [ ] **Step 3: Implement `SettingsModal.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { FIELD_DEFINITIONS, OrderFieldKey, OrderSettings } from '../domain/orderTypes';

interface SettingsModalProps {
  settings: OrderSettings;
  open: boolean;
  onClose: () => void;
  onSave: (settings: OrderSettings) => void;
}

const configurableRequiredFields: OrderFieldKey[] = [
  'customerName',
  'phone',
  'orderItems',
  'quantity',
  'desiredDateTime',
  'fulfillmentType',
];

export function SettingsModal({ settings, open, onClose, onSave }: SettingsModalProps) {
  const [requiredFields, setRequiredFields] = useState(settings.requiredFields);
  const [bulkQuantityThreshold, setBulkQuantityThreshold] = useState(settings.bulkQuantityThreshold);

  if (!open) return null;

  function toggle(field: OrderFieldKey) {
    setRequiredFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({ ...settings, requiredFields, bulkQuantityThreshold });
    onClose();
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="필수 항목 관리">
      <form className="settingsModal" onSubmit={handleSubmit}>
        <h2>필수 항목 관리</h2>
        {configurableRequiredFields.map((field) => (
          <label key={field} className="checkRow">
            <input type="checkbox" checked={requiredFields.includes(field)} onChange={() => toggle(field)} />
            {FIELD_DEFINITIONS[field].label}
          </label>
        ))}
        <p className="helperText">택배 주소는 택배일 때만, 픽업 시간은 픽업일 때만 확인합니다.</p>
        <label>
          큰 주문으로 볼 수량
          <input
            type="number"
            min={1}
            value={bulkQuantityThreshold}
            onChange={(event) => setBulkQuantityThreshold(Number(event.target.value))}
          />
        </label>
        <div className="modalActions">
          <button type="button" onClick={onClose}>
            닫기
          </button>
          <button type="submit">저장</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Implement `OrderList.tsx`**

```tsx
import { useState } from 'react';
import { CapturedOrder } from '../domain/orderTypes';

interface OrderListProps {
  orders: CapturedOrder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function OrderList({ orders, selectedId, onSelect }: OrderListProps) {
  const [expandedRawIds, setExpandedRawIds] = useState<string[]>([]);

  function toggleRaw(id: string) {
    setExpandedRawIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <section className="orderList" aria-label="주문 문의 목록">
      {orders.length === 0 ? <p className="emptyState">아직 저장된 주문/문의가 없습니다.</p> : null}
      {orders.map((order) => (
        <article key={order.id} className={order.id === selectedId ? 'orderRow selected' : 'orderRow'}>
          <button type="button" className="orderMain" onClick={() => onSelect(order.id)}>
            <span className="sourcePill">{order.source}</span>
            <strong>{order.customerName || '고객명 없음'}</strong>
            <span>{order.desiredDateTime || '희망일 없음'}</span>
            <span>{order.orderItems || '주문 내용 없음'}</span>
            <span>{order.customerRequestNote ? '고객 요청 있음' : '고객 요청 없음'}</span>
            <span>{order.ownerMemo ? '내부 메모 있음' : '내부 메모 없음'}</span>
            <span className={order.warningLevel === 'attention' ? 'attentionText' : ''}>{order.status}</span>
          </button>
          {order.missingFields.length > 0 ? (
            <button type="button" className="rawToggle" onClick={() => toggleRaw(order.id)}>
              원문 보기
            </button>
          ) : null}
          {expandedRawIds.includes(order.id) ? <pre className="rawPreview">{order.rawText}</pre> : null}
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Implement `OrderDetail.tsx`**

```tsx
import { ChangeEvent } from 'react';
import { CapturedOrder, FIELD_DEFINITIONS, OrderFieldKey } from '../domain/orderTypes';
import { ReparseHint } from './ReparseHint';

interface OrderDetailProps {
  order: CapturedOrder | null;
  onChange: (order: CapturedOrder) => void;
}

const editableFields: OrderFieldKey[] = [
  'customerName',
  'phone',
  'orderItems',
  'quantity',
  'desiredDateTime',
  'fulfillmentType',
  'pickupTime',
  'address',
  'customerRequestNote',
  'ownerMemo',
];

export function OrderDetail({ order, onChange }: OrderDetailProps) {
  if (!order) return <aside className="orderDetail">주문/문의를 선택하세요.</aside>;

  function update(field: OrderFieldKey, value: string) {
    if (!order) return;
    onChange({
      ...order,
      [field]: value,
      manuallyEditedFields: Array.from(new Set([...order.manuallyEditedFields, field])),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <aside className="orderDetail">
      <h2>상세 수정</h2>
      <details>
        <summary>원문</summary>
        <pre className="rawPreview">{order.rawText}</pre>
      </details>
      {editableFields.map((field) => {
        const diff = order.reparseDifferences.find((item) => item.field === field);
        return (
          <label key={field}>
            {FIELD_DEFINITIONS[field].label}
            {diff ? <ReparseHint extractedValue={diff.extractedValue} /> : null}
            <textarea
              value={String(order[field])}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update(field, event.target.value)}
              rows={field === 'customerRequestNote' || field === 'ownerMemo' ? 4 : 2}
            />
          </label>
        );
      })}
      <label>
        상태
        <select value={order.status} onChange={(event) => onChange({ ...order, status: event.target.value as CapturedOrder['status'] })}>
          <option>수집</option>
          <option>확인필요</option>
          <option>정리 완료</option>
        </select>
      </label>
    </aside>
  );
}
```

- [ ] **Step 6: Wire app state in `App.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { OrderCaptureForm } from './components/OrderCaptureForm';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { QuestionNote } from './components/QuestionNote';
import { SettingsModal } from './components/SettingsModal';
import { CapturedOrder } from './domain/orderTypes';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './domain/storage';
import './App.css';

export default function App() {
  const [orders, setOrders] = useState<CapturedOrder[]>(() => loadOrders());
  const [settings, setSettings] = useState(() => loadSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedId) ?? null, [orders, selectedId]);

  function persistOrders(nextOrders: CapturedOrder[]) {
    setOrders(nextOrders);
    saveOrders(nextOrders);
  }

  function addOrder(order: CapturedOrder) {
    persistOrders([order, ...orders]);
    setSelectedId(order.id);
  }

  function updateOrder(order: CapturedOrder) {
    persistOrders(orders.map((item) => (item.id === order.id ? order : item)));
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <div>
          <p className="eyebrow">Lyru OMS</p>
          <h1>주문 수집</h1>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          필수 항목
        </button>
      </header>
      <div className="workspace">
        <section className="captureColumn">
          <QuestionNote />
          <OrderCaptureForm
            existingRawTexts={orders.map((order) => order.rawText)}
            settings={settings}
            onSave={addOrder}
          />
          <OrderList orders={orders} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
        <OrderDetail order={selectedOrder} onChange={updateOrder} />
      </div>
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(nextSettings) => {
          setSettings(nextSettings);
          saveSettings(nextSettings);
        }}
      />
    </main>
  );
}
```

- [ ] **Step 7: Replace `src/App.css` with responsive UI styles**

```css
:root {
  color: #1f2933;
  background: #faf8f3;
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; }
button, input, select, textarea { font: inherit; }
button { cursor: pointer; }

.appShell { min-height: 100vh; padding: 16px; }
.appHeader, .workspace { max-width: 1180px; margin: 0 auto; }
.appHeader { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 14px; }
.eyebrow { margin: 0 0 4px; color: #967238; font-size: 13px; font-weight: 700; }
h1, h2 { margin: 0; letter-spacing: 0; }
h1 { font-size: 27px; }
h2 { font-size: 18px; }
.workspace { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 14px; }
.captureColumn, .orderDetail, .captureForm, .questionNote, .settingsModal { background: #fff; border: 1px solid #e6dfd1; border-radius: 8px; }
.captureColumn { display: grid; gap: 12px; background: transparent; border: 0; }
.captureForm, .orderDetail, .questionNote { padding: 14px; }
label { display: grid; gap: 6px; margin-bottom: 10px; font-size: 14px; font-weight: 700; }
textarea, input, select { width: 100%; border: 1px solid #d8cfbf; border-radius: 6px; padding: 10px; background: #fff; color: #1f2933; }
textarea { resize: vertical; }
button { border: 1px solid #b89b5e; border-radius: 6px; padding: 10px 12px; background: #2a3441; color: #fff; }
.noteToggle, .rawToggle { background: #fff; color: #2a3441; border-color: #d8cfbf; }
.noteBody p { margin: 8px 0; color: #5d6470; }
.softWarning, .attentionText { color: #7f4f13; font-weight: 700; }
.previewGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 12px 0; color: #4b5563; }
.orderList { display: grid; gap: 8px; }
.orderRow { background: #fff; border: 1px solid #e6dfd1; border-radius: 8px; padding: 10px; }
.orderRow.selected { border-color: #b89b5e; }
.orderMain { width: 100%; display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; text-align: left; background: transparent; color: #1f2933; border: 0; padding: 0; }
.sourcePill { display: inline-flex; width: fit-content; padding: 3px 7px; border-radius: 999px; background: #f1eadc; color: #6f5428; font-size: 12px; }
.rawPreview { white-space: pre-wrap; background: #f7f3ea; border-radius: 6px; padding: 10px; color: #374151; }
.orderDetail { align-self: start; position: sticky; top: 12px; }
.reparseHint { position: relative; display: inline-flex; margin-left: 6px; vertical-align: middle; }
.reparseDot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; display: inline-block; }
.reparseTooltip { display: none; position: absolute; z-index: 2; top: 14px; left: 0; width: max-content; max-width: 240px; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #374151; font-size: 12px; font-weight: 500; }
.reparseHint:hover .reparseTooltip, .reparseHint:focus .reparseTooltip { display: block; }
.modalBackdrop { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(31, 41, 51, 0.35); }
.settingsModal { width: min(480px, 100%); padding: 16px; }
.checkRow { display: flex; align-items: center; gap: 8px; }
.checkRow input { width: auto; }
.helperText, .emptyState { color: #6b7280; }
.modalActions { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 760px) {
  .appShell { padding: 12px; }
  .appHeader { align-items: flex-start; }
  .workspace { grid-template-columns: 1fr; }
  .orderDetail { position: static; }
  .previewGrid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 8: Run list tests and full test suite**

Run: `npm run test -- src/components/OrderList.test.tsx`

Expected: PASS.

Run: `npm run test`

Expected: PASS.

- [ ] **Step 9: Commit UI integration**

```bash
git add src/App.tsx src/App.css src/components
git commit -m "feat: build order standardization workspace"
```

## Task 8: Manual Verification and README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add local run instructions to `README.md`**

Append this section:

```md
## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 표시된 로컬 주소를 열면 Phase 1 주문 표준화 MVP를 확인할 수 있습니다.

## Phase 1 확인 흐름

1. 주문 수집 화면 상단의 접이식 쪽지를 확인합니다.
2. 카카오톡/인스타그램/네이버 톡톡 원문을 붙여넣고 저장합니다.
3. 필수 정보가 빠져도 저장되는지 확인합니다.
4. `정보 부족` 또는 `확인필요` 사유가 있으면 상태가 `확인필요`가 되는지 확인합니다.
5. 정보 부족 주문에서만 원문을 펼쳐볼 수 있는지 확인합니다.
6. 고객 요청사항과 사장님 내부 메모가 분리되어 있는지 확인합니다.
```

- [ ] **Step 2: Run final automated checks**

Run: `npm run test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Start dev server for manual verification**

Run: `npm run dev`

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 4: Verify desktop and mobile manually**

Desktop checks:
- Paste:

```text
성함: 김리루
연락처: 010-1111-2222
상품: 곶감밀푀유 4구
개수: 5
수령방법: 택배
배송지: 서울시 강남구
요청사항: 선물이라 예쁘게 부탁드려요
```

Expected:
- Saved order status is `확인필요` because quantity is 5.
- Raw text is not fully visible in the list unless expanded.
- Customer request appears separately from owner memo.

Mobile checks:
- Resize browser to 390px width.
- Confirm capture form, list, and detail stack vertically.
- Confirm reparse hint dot can receive focus/touch and tooltip text fits.

- [ ] **Step 5: Commit docs update**

```bash
git add README.md
git commit -m "docs: add order standardization run notes"
```

## Self-Review

**Spec coverage:**
- Raw text paste/save: Task 6.
- Label/keyword parsing: Task 3.
- Required-field settings and bulk quantity threshold: Tasks 2, 4, 7.
- Information shortage and review-needed split with same warning level: Task 4.
- Auto `확인필요` status but no auto-revert from `정리 완료`: Task 4.
- Manual `확인필요`: Task 7 detail status selector.
- Duplicate raw warning without blocking save: Tasks 3 and 6.
- Manual edit value priority and neutral reparse hint: Tasks 4 and 7.
- Temporary owner-question note: Task 6.
- Customer request and owner memo separation: Task 7.
- Mobile-first layout: Task 7 and Task 8 manual checks.

**Placeholder scan:** No placeholder markers or unspecified test steps remain. Every task has explicit files, commands, and expected outcomes.

**Type consistency:** Status values are consistently `수집`, `확인필요`, `정리 완료`; field keys match `OrderFieldKey`; settings keys match `OrderSettings`.
