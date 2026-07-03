# Order List Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `달력형 보기` order-list mode that shows visible orders from registration date through desired date.

**Architecture:** Keep the public `OrderList` API unchanged. Add local date-range helpers and a calendar renderer inside `src/components/OrderList.tsx`, using es-toolkit for grouping and chronological sorting of derived display data.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, es-toolkit.

---

## File Structure

- Modify `src/components/OrderList.test.tsx`: add failing tests for calendar view persistence, valid date ranges, unresolved dates, and source-filtered empty state.
- Modify `src/components/OrderList.tsx`: add `calendar` view mode, date derivation helpers, es-toolkit imports, and calendar timeline rendering.
- Modify `src/App.css`: add compact, mobile-safe calendar timeline styles.

## Task 1: Lock Calendar View Behavior With Tests

**Files:**
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Add calendar test fixtures and tests**

Append these tests inside the existing `describe('OrderList', () => { ... })` block, before the closing `});`:

```tsx
  it('persists calendar view mode changes', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('calendar');

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('radio', { name: '달력형 보기' })).toBeChecked();
  });

  it('shows an order from registration date through desired date in calendar view', () => {
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'calendar-range',
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
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(screen.getByRole('heading', { name: '7월 1일' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '7월 2일' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '7월 3일' })).toBeInTheDocument();
    expect(screen.getByText('등록')).toBeInTheDocument();
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    expect(screen.getByText('마감')).toBeInTheDocument();
    expect(screen.getAllByText('곶감단지 · 2세트')).toHaveLength(3);
  });

  it('keeps orders with missing desired dates in the unresolved calendar group', () => {
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'calendar-unresolved',
          customerName: '최확인',
          orderItems: '화과자',
          quantity: '4개',
          desiredDateTime: '',
          parsedDate: null,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(screen.getByRole('heading', { name: '날짜 확인 필요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /화과자 · 4개/ })).toBeInTheDocument();
  });

  it('keeps filtered-out empty state before rendering calendar view', () => {
    renderOrderList({ orders: [], totalOrderCount: 1, sourceFilter: '네이버 스마트스토어' });

    expect(screen.getByText('선택한 채널의 주문이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '날짜 확인 필요' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: FAIL because `달력형 보기` is not present yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/components/OrderList.test.tsx
git commit -m "test: lock order list calendar view behavior"
```

## Task 2: Add Calendar Data Derivation and Rendering

**Files:**
- Modify: `src/components/OrderList.tsx`

- [ ] **Step 1: Add es-toolkit imports and calendar view mode**

Change imports and view mode declarations:

```tsx
import { groupBy, sortBy } from 'es-toolkit';
import { type FocusEvent, useMemo, useState } from 'react';
```

```tsx
type OrderListViewMode = 'card' | 'list' | 'calendar';
```

```tsx
const viewOptions: Array<{ mode: OrderListViewMode; label: string }> = [
  { mode: 'list', label: '목록형 보기' },
  { mode: 'card', label: '카드형 보기' },
  { mode: 'calendar', label: '달력형 보기' },
];
```

Update stored mode hydration:

```tsx
return stored === 'card' || stored === 'list' || stored === 'calendar' ? stored : 'list';
```

- [ ] **Step 2: Add calendar helper types and date utilities above `OrderList`**

Add after `getDisplayDate`:

```tsx
type CalendarMarkerKind = 'start' | 'middle' | 'end' | 'invalid';

interface CalendarRangeItem {
  order: CapturedOrder;
  startDate: string;
  endDate: string;
  invalidRange: boolean;
}

interface CalendarMarker {
  order: CapturedOrder;
  isoDate: string;
  kind: CalendarMarkerKind;
}

interface CalendarDateEntry {
  isoDate: string;
  markers: CalendarMarker[];
}

const DAY_MS = 86_400_000;

const getKoreaIsoDate = (isoDateTime: string) => {
  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};

const parseIsoDateOnly = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
};

const addDays = (isoDate: string, dayCount: number) => {
  const time = parseIsoDateOnly(isoDate);

  if (time === null) {
    return isoDate;
  }

  return new Date(time + dayCount * DAY_MS).toISOString().slice(0, 10);
};

const expandDateRange = (startDate: string, endDate: string) => {
  const startTime = parseIsoDateOnly(startDate);
  const endTime = parseIsoDateOnly(endDate);

  if (startTime === null || endTime === null || endTime < startTime) {
    return [startDate];
  }

  const dates: string[] = [];

  for (let time = startTime; time <= endTime; time += DAY_MS) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }

  return dates;
};

const formatCalendarDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);

  if (!year || !month || !day) {
    return isoDate;
  }

  return `${month}월 ${day}일`;
};

const getDesiredIsoDate = (order: CapturedOrder) => {
  const parsed = getDisplayDate(order);

  if (!parsed || parsed.isRelative || !parsed.isoDate) {
    return null;
  }

  return parsed.isoDate;
};

const buildCalendarRangeItem = (order: CapturedOrder): CalendarRangeItem | null => {
  const startDate = getKoreaIsoDate(order.createdAt);
  const endDate = getDesiredIsoDate(order);

  if (!startDate || !endDate) {
    return null;
  }

  return {
    order,
    startDate,
    endDate,
    invalidRange: endDate < startDate,
  };
};

const getCalendarMarkerLabel = (kind: CalendarMarkerKind) => {
  if (kind === 'start') {
    return '등록';
  }

  if (kind === 'end') {
    return '마감';
  }

  if (kind === 'invalid') {
    return '날짜 확인';
  }

  return '진행 중';
};
```

- [ ] **Step 3: Add calendar derivation inside `OrderList`**

Add after state declarations:

```tsx
  const calendarData = useMemo(() => {
    const rangeItems = orders.flatMap((order) => {
      const item = buildCalendarRangeItem(order);

      return item ? [item] : [];
    });
    const rangeOrderIds = new Set(rangeItems.map((item) => item.order.id));
    const unresolvedOrders = orders.filter((order) => !rangeOrderIds.has(order.id));
    const markers = rangeItems.flatMap((item) =>
      expandDateRange(item.startDate, item.endDate).map((isoDate) => {
        const kind: CalendarMarkerKind = item.invalidRange
          ? 'invalid'
          : isoDate === item.startDate
            ? 'start'
            : isoDate === item.endDate
              ? 'end'
              : 'middle';

        return {
          order: item.order,
          isoDate,
          kind,
        };
      }),
    );
    const markersByDate = groupBy(markers, (marker) => marker.isoDate);
    const entries = sortBy(
      Object.entries(markersByDate).map(([isoDate, dateMarkers]) => ({
        isoDate,
        markers: dateMarkers,
      })),
      [(entry) => entry.isoDate],
    );

    return { entries, unresolvedOrders };
  }, [orders]);
```

- [ ] **Step 4: Render calendar mode before the existing list/card return body**

Add this branch after the empty-state branch and before the final `return`:

```tsx
  if (viewMode === 'calendar') {
    return (
      <section className="orderListPanel" aria-label="주문 목록">
        {header}
        <div className="orderCalendar" aria-label="등록일부터 희망일까지 주문 일정">
          {calendarData.entries.map((entry) => (
            <section key={entry.isoDate} className="calendarDateRow" aria-labelledby={`calendar-date-${entry.isoDate}`}>
              <div className="calendarDateHeader">
                <h3 id={`calendar-date-${entry.isoDate}`}>{formatCalendarDateLabel(entry.isoDate)}</h3>
                <span>{entry.markers.length}건</span>
              </div>
              <div className="calendarMarkerList">
                {entry.markers.map((marker) => (
                  <button
                    key={`${entry.isoDate}-${marker.order.id}-${marker.kind}`}
                    type="button"
                    className={`calendarOrderChip ${marker.kind}`}
                    onClick={() => onSelect(marker.order.id)}
                  >
                    <span className="calendarMarkerKind">{getCalendarMarkerLabel(marker.kind)}</span>
                    <strong>{summarizeOrder(marker.order)}</strong>
                    <span>{fallback(marker.order.customerName, '고객명 미정')}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {calendarData.unresolvedOrders.length > 0 ? (
            <section className="calendarUnresolved" aria-labelledby="calendar-unresolved-title">
              <h3 id="calendar-unresolved-title">날짜 확인 필요</h3>
              <div className="calendarMarkerList">
                {calendarData.unresolvedOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="calendarOrderChip unresolved"
                    onClick={() => onSelect(order.id)}
                  >
                    <span className="calendarMarkerKind">확인</span>
                    <strong>{summarizeOrder(order)}</strong>
                    <span>{fallback(order.customerName, '고객명 미정')}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    );
  }
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: PASS for `OrderList.test.tsx`.

- [ ] **Step 6: Commit implementation**

```bash
git add src/components/OrderList.tsx
git commit -m "feat: add order list calendar view"
```

## Task 3: Add Calendar Timeline Styles

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add calendar styles near the order list styles**

Add after `.orderList.compact { ... }`:

```css
.orderCalendar {
  display: grid;
  gap: 8px;
}

.calendarDateRow,
.calendarUnresolved {
  display: grid;
  gap: 8px;
  border: 1px solid #eee3d2;
  border-radius: 8px;
  background: #fffdf9;
  padding: 10px;
}

.calendarDateHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #5b4322;
}

.calendarDateHeader h3,
.calendarUnresolved h3 {
  margin: 0;
  color: #1b2430;
  font-size: 14px;
  line-height: 1.25;
}

.calendarDateHeader span {
  flex: 0 0 auto;
  color: #746552;
  font-size: 12px;
}

.calendarMarkerList {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.calendarOrderChip {
  display: grid;
  min-width: min(100%, 168px);
  max-width: 100%;
  gap: 2px;
  border: 1px solid #e4d7c5;
  border-radius: 8px;
  background: #fffaf2;
  color: #1b2430;
  padding: 7px 8px;
  text-align: left;
}

.calendarOrderChip.middle {
  background: #fbfaf7;
  color: #4b5563;
}

.calendarOrderChip.end {
  border-color: #c9a45f;
  background: #fff7df;
}

.calendarOrderChip.invalid,
.calendarOrderChip.unresolved {
  border-color: #d2beb4;
  background: #fff7f2;
}

.calendarOrderChip strong,
.calendarOrderChip span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.calendarOrderChip strong {
  font-size: 13px;
}

.calendarOrderChip > span:not(.calendarMarkerKind) {
  color: #746552;
  font-size: 12px;
}

.calendarMarkerKind {
  width: fit-content;
  border-radius: 999px;
  background: #f0e4d2;
  color: #5b4322;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
}

.calendarOrderChip.end .calendarMarkerKind {
  background: #c9a45f;
  color: #fffaf2;
}

.calendarOrderChip.invalid .calendarMarkerKind,
.calendarOrderChip.unresolved .calendarMarkerKind {
  background: #7a3d2f;
  color: #fffaf2;
}
```

- [ ] **Step 2: Add mobile width guard inside the existing mobile media query**

Inside the existing mobile media query, add:

```css
  .calendarMarkerList {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .calendarOrderChip {
    width: 100%;
  }
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit styles**

```bash
git add src/App.css
git commit -m "style: add order calendar timeline"
```

## Task 4: Verification and PR Update

**Files:**
- No new source files.

- [ ] **Step 1: Run full tests**

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

Expected: build completes without TypeScript or Vite errors.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms/.worktrees/es-toolkit-refactor diff --check
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms/.worktrees/es-toolkit-refactor status --short --branch
```

Expected: no whitespace errors; branch is ahead of origin only by the new calendar commits.

- [ ] **Step 4: Push PR branch**

Run:

```bash
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms/.worktrees/es-toolkit-refactor push
```

Expected: branch `es-toolkit-refactor` updates PR #3.

## Self-Review

- Spec coverage: Tasks cover view-menu addition, calendar timeline rendering, unresolved dates, es-toolkit data derivation, mobile styling, and verification.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: `OrderListViewMode`, `CalendarMarkerKind`, `CalendarRangeItem`, `CalendarMarker`, and `CalendarDateEntry` are defined before use. Existing `OrderList` props remain unchanged.
