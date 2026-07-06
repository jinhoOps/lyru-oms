# Calendar Range Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `달력형 보기`에 `일별`, `2주`, `월별` 모드를 추가하고, 주문을 날짜별 반복 칩이 아니라 등록일부터 희망일까지 이어지는 기간 표시로 렌더링한다.

**Architecture:** `OrderList` 안의 기존 날짜별 marker 모델을 유효 기간 항목, 미해결 항목, 표시 구간 항목으로 바꾼다. 월별/2주 모드는 일~토 고정 캘린더 그리드와 주 행별 기간 막대를 공유하고, 일별 모드는 오늘 날짜에 걸친 주문을 한 번씩 리스트로 보여준다.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, es-toolkit `groupBy`/`sortBy`

---

## File Structure

- Modify: `src/components/OrderList.tsx`
  - Add `CalendarRangeMode = 'day' | 'twoWeek' | 'month'`.
  - Add separate `localStorage` key `lyru-oms.orderList.calendarMode.v1`.
  - Replace `CalendarMarker`/`expandDateRange` rendering with range item, visible window, week row segment helpers.
  - Render a calendar mode radiogroup above calendar content.
  - Render monthly and 2-week grids from the same segment model.
  - Render daily mode as one row per in-range order.
- Modify: `src/components/OrderList.test.tsx`
  - Replace the old repeated marker expectation.
  - Add focused tests for default monthly mode, 2-week persistence/window, connected range rendering, daily labels, and unresolved orders.
- Modify: `src/App.css`
  - Replace old `.calendarDateRow` chip layout with mode selector, calendar grid, range bars, daily rows, and unresolved styles.
  - Keep mobile-safe fixed 7-column calendar without horizontal overflow.

---

### Task 1: Calendar Mode Preference Tests

**Files:**
- Modify: `src/components/OrderList.test.tsx:125-186`

- [ ] **Step 1: Write failing tests for calendar mode default and persistence**

Replace the current `persists calendar view mode changes`, `shows an order from registration date through desired date in calendar view`, and `keeps orders with missing desired dates in the unresolved calendar group` tests with this block:

```tsx
  it('opens calendar view with monthly mode by default', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('calendar');
    expect(screen.getByRole('radiogroup', { name: '달력 범위' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '월별' })).toBeChecked();
    expect(screen.getByRole('grid', { name: '월별 주문 달력' })).toBeInTheDocument();
  });

  it('persists calendar range mode separately from list view mode', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '2주' }));

    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('calendar');
    expect(localStorage.getItem('lyru-oms.orderList.calendarMode.v1')).toBe('twoWeek');

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '목록형 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(screen.getByRole('radio', { name: '2주' })).toBeChecked();
  });
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: FAIL because `달력 범위`, `월별`, `2주`, and the calendar mode storage key do not exist yet.

- [ ] **Step 3: Add calendar mode state and selector**

In `src/components/OrderList.tsx`, add these near the existing view mode definitions:

```tsx
type CalendarRangeMode = 'day' | 'twoWeek' | 'month';

const ORDER_LIST_CALENDAR_MODE_KEY = 'lyru-oms.orderList.calendarMode.v1';

const calendarRangeOptions: Array<{ mode: CalendarRangeMode; label: string }> = [
  { mode: 'day', label: '일별' },
  { mode: 'twoWeek', label: '2주' },
  { mode: 'month', label: '월별' },
];

const loadCalendarRangeMode = (): CalendarRangeMode => {
  try {
    if (typeof localStorage === 'undefined') {
      return 'month';
    }

    const stored = localStorage.getItem(ORDER_LIST_CALENDAR_MODE_KEY);
    return stored === 'day' || stored === 'twoWeek' || stored === 'month' ? stored : 'month';
  } catch {
    return 'month';
  }
};

const saveCalendarRangeMode = (mode: CalendarRangeMode) => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(ORDER_LIST_CALENDAR_MODE_KEY, mode);
  } catch {
    // Ignore blocked storage; the in-memory state still updates.
  }
};
```

Inside `OrderList`, add state and setter beside `viewMode`:

```tsx
  const [calendarRangeMode, setCalendarRangeModeState] = useState<CalendarRangeMode>(() => loadCalendarRangeMode());

  function setCalendarRangeMode(mode: CalendarRangeMode) {
    setCalendarRangeModeState(mode);
    saveCalendarRangeMode(mode);
  }
```

In the `viewMode === 'calendar'` branch, place this before the calendar body:

```tsx
          <div className="calendarModeControl" role="radiogroup" aria-label="달력 범위">
            {calendarRangeOptions.map((option) => (
              <label key={option.mode} className="calendarModeOption">
                <input
                  type="radio"
                  name="order-calendar-range-mode"
                  checked={calendarRangeMode === option.mode}
                  onChange={() => setCalendarRangeMode(option.mode)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
```

For this task only, add a placeholder grid label in the existing calendar container so the first test can pass after the selector exists:

```tsx
          <div role="grid" aria-label={calendarRangeMode === 'month' ? '월별 주문 달력' : '주문 달력'}>
```

- [ ] **Step 4: Run the focused tests and verify the new preference tests pass**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: The two new tests pass. Existing old calendar tests may still fail until Task 2 replaces marker rendering.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx
git commit -m "feat: add calendar range mode preference"
```

---

### Task 2: Range Data Model and 2-Week Window

**Files:**
- Modify: `src/components/OrderList.tsx:160-326`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Add failing 2-week range and no-repeat tests**

Add these tests after the calendar mode persistence test:

```tsx
  it('shows the current Sunday through next Saturday in two-week calendar mode', () => {
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'));
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'two-week-range',
          customerName: '박기간',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-10',
          parsedDate: null,
          createdAt: '2026-07-05T00:30:00.000Z',
          updatedAt: '2026-07-05T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '2주' }));

    const grid = screen.getByRole('grid', { name: '2주 주문 달력' });
    expect(within(grid).getByText('7월 5일')).toBeInTheDocument();
    expect(within(grid).getByText('7월 18일')).toBeInTheDocument();
    expect(within(grid).queryByText('7월 19일')).not.toBeInTheDocument();
  });

  it('renders a multi-day order as one connected range per visible week instead of repeated daily chips', () => {
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

    const rangeButton = screen.getByRole('button', { name: /곶감단지 · 2세트.*등록.*마감/ });
    expect(rangeButton).toBeInTheDocument();
    expect(screen.getAllByText('곶감단지 · 2세트')).toHaveLength(1);
  });
```

- [ ] **Step 2: Run focused tests and verify these fail**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: FAIL because the 2-week grid and connected range button do not exist, and the old implementation repeats the order summary per date.

- [ ] **Step 3: Replace marker types with range segment types and date helpers**

In `src/components/OrderList.tsx`, replace `CalendarMarkerKind`, `CalendarMarker`, `expandDateRange`, and `getCalendarMarkerLabel` with:

```tsx
interface CalendarRangeItem {
  order: CapturedOrder;
  startDate: string;
  endDate: string;
}

interface CalendarUnresolvedItem {
  order: CapturedOrder;
  reason: 'missing-date' | 'invalid-range';
}

interface CalendarWeekRow {
  id: string;
  dates: string[];
}

interface CalendarRangeSegment {
  order: CapturedOrder;
  rowId: string;
  startDate: string;
  endDate: string;
  startsInView: boolean;
  endsInView: boolean;
  columnStart: number;
  columnEnd: number;
}

const DAY_MS = 86_400_000;

const addDays = (isoDate: string, days: number) => {
  const time = parseIsoDateOnly(isoDate);
  return time === null ? isoDate : new Date(time + days * DAY_MS).toISOString().slice(0, 10);
};

const getTodayKoreaIsoDate = () => getKoreaIsoDate(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10);

const getWeekStartSunday = (isoDate: string) => {
  const time = parseIsoDateOnly(isoDate);
  if (time === null) {
    return isoDate;
  }

  const day = new Date(time).getUTCDay();
  return addDays(isoDate, -day);
};

const buildSequentialDates = (startDate: string, count: number) =>
  Array.from({ length: count }, (_, index) => addDays(startDate, index));

const buildWeekRows = (startDate: string, weekCount: number): CalendarWeekRow[] =>
  Array.from({ length: weekCount }, (_, weekIndex) => {
    const firstDate = addDays(startDate, weekIndex * 7);
    return {
      id: firstDate,
      dates: buildSequentialDates(firstDate, 7),
    };
  });

const buildMonthRows = (today: string): CalendarWeekRow[] => {
  const [year, month] = today.split('-').map(Number);
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const firstVisibleDate = getWeekStartSunday(firstOfMonth);
  const lastVisibleDate = addDays(getWeekStartSunday(lastOfMonth), 6);
  const weekCount = Math.floor(((parseIsoDateOnly(lastVisibleDate) ?? 0) - (parseIsoDateOnly(firstVisibleDate) ?? 0)) / (DAY_MS * 7)) + 1;

  return buildWeekRows(firstVisibleDate, weekCount);
};

const buildTwoWeekRows = (today: string) => buildWeekRows(getWeekStartSunday(today), 2);

const getCalendarWindow = (mode: Exclude<CalendarRangeMode, 'day'>, today: string) => {
  const rows = mode === 'month' ? buildMonthRows(today) : buildTwoWeekRows(today);
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];

  return {
    rows,
    startDate: firstRow.dates[0],
    endDate: lastRow.dates[lastRow.dates.length - 1],
  };
};
```

- [ ] **Step 4: Build range data from orders**

Replace the current `calendarData` `useMemo` with:

```tsx
  const todayIsoDate = getTodayKoreaIsoDate();
  const calendarData = useMemo(() => {
    const rangeItems: CalendarRangeItem[] = [];
    const unresolvedItems: CalendarUnresolvedItem[] = [];

    orders.forEach((order) => {
      const item = buildCalendarRangeItem(order);

      if (!item) {
        unresolvedItems.push({ order, reason: 'missing-date' });
        return;
      }

      if (item.invalidRange) {
        unresolvedItems.push({ order, reason: 'invalid-range' });
        return;
      }

      rangeItems.push({
        order: item.order,
        startDate: item.startDate,
        endDate: item.endDate,
      });
    });

    return {
      rangeItems: sortBy(rangeItems, [(item) => item.startDate, (item) => item.endDate, (item) => item.order.createdAt]),
      unresolvedItems,
    };
  }, [orders]);
```

Then update `CalendarRangeItem` returned by `buildCalendarRangeItem` to keep `invalidRange` internally by introducing:

```tsx
interface CalendarRangeCandidate extends CalendarRangeItem {
  invalidRange: boolean;
}

const buildCalendarRangeItem = (order: CapturedOrder): CalendarRangeCandidate | null => {
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
```

- [ ] **Step 5: Add segment builder**

Add below `getCalendarWindow`:

```tsx
const getDateIndexInRow = (row: CalendarWeekRow, isoDate: string) => row.dates.indexOf(isoDate);

const clampDate = (date: string, min: string, max: string) => {
  if (date < min) {
    return min;
  }

  if (date > max) {
    return max;
  }

  return date;
};

const buildRangeSegments = (
  rangeItems: CalendarRangeItem[],
  rows: CalendarWeekRow[],
  windowStart: string,
  windowEnd: string,
): CalendarRangeSegment[] => {
  const segments = rangeItems.flatMap((item) => {
    if (item.endDate < windowStart || item.startDate > windowEnd) {
      return [];
    }

    const visibleStart = clampDate(item.startDate, windowStart, windowEnd);
    const visibleEnd = clampDate(item.endDate, windowStart, windowEnd);

    return rows.flatMap((row) => {
      const rowStart = row.dates[0];
      const rowEnd = row.dates[row.dates.length - 1];

      if (visibleEnd < rowStart || visibleStart > rowEnd) {
        return [];
      }

      const segmentStart = clampDate(visibleStart, rowStart, rowEnd);
      const segmentEnd = clampDate(visibleEnd, rowStart, rowEnd);
      const startIndex = getDateIndexInRow(row, segmentStart);
      const endIndex = getDateIndexInRow(row, segmentEnd);

      if (startIndex < 0 || endIndex < 0) {
        return [];
      }

      return [
        {
          order: item.order,
          rowId: row.id,
          startDate: segmentStart,
          endDate: segmentEnd,
          startsInView: segmentStart === item.startDate,
          endsInView: segmentEnd === item.endDate,
          columnStart: startIndex + 1,
          columnEnd: endIndex + 2,
        },
      ];
    });
  });

  return sortBy(segments, [(segment) => segment.startDate, (segment) => segment.endDate, (segment) => segment.order.createdAt]);
};
```

- [ ] **Step 6: Render month and 2-week grids from segments**

Inside `viewMode === 'calendar'`, before `return`, compute:

```tsx
    const calendarWindow = calendarRangeMode === 'day' ? null : getCalendarWindow(calendarRangeMode, todayIsoDate);
    const calendarSegments = calendarWindow
      ? buildRangeSegments(calendarData.rangeItems, calendarWindow.rows, calendarWindow.startDate, calendarWindow.endDate)
      : [];
    const segmentsByRow = groupBy(calendarSegments, (segment) => segment.rowId);
```

Replace old `calendarData.entries.map(...)` with:

```tsx
          {calendarWindow ? (
            <div
              className={`calendarGrid ${calendarRangeMode}`}
              role="grid"
              aria-label={calendarRangeMode === 'month' ? '월별 주문 달력' : '2주 주문 달력'}
            >
              <div className="calendarWeekHeader" role="row">
                {['일', '월', '화', '수', '목', '금', '토'].map((dayLabel) => (
                  <span key={dayLabel} role="columnheader">
                    {dayLabel}
                  </span>
                ))}
              </div>
              {calendarWindow.rows.map((row) => (
                <section key={row.id} className="calendarWeekRow" role="row" aria-label={`${formatCalendarDateLabel(row.dates[0])} 주`}>
                  <div className="calendarDayNumbers">
                    {row.dates.map((isoDate) => (
                      <span key={isoDate} className="calendarDayNumber" role="gridcell">
                        {formatCalendarDateLabel(isoDate)}
                      </span>
                    ))}
                  </div>
                  <div className="calendarRangeLayer">
                    {(segmentsByRow[row.id] ?? []).map((segment) => (
                      <button
                        key={`${row.id}-${segment.order.id}-${segment.startDate}-${segment.endDate}`}
                        type="button"
                        className="calendarRangeBar"
                        style={{ gridColumn: `${segment.columnStart} / ${segment.columnEnd}` }}
                        aria-label={`${summarizeOrder(segment.order)} ${formatCalendarDateLabel(segment.startDate)}부터 ${formatCalendarDateLabel(segment.endDate)}까지 ${segment.startsInView ? '등록' : '계속'} ${segment.endsInView ? '마감' : '진행 중'}`}
                        onClick={() => onSelect(segment.order.id)}
                      >
                        <span className="calendarRangeMeta">
                          {segment.startsInView ? '등록' : '계속'}
                          {segment.endsInView ? ' · 마감' : ''}
                        </span>
                        <strong>{summarizeOrder(segment.order)}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: The 2-week and no-repeat tests pass. Daily mode tests do not exist yet.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx
git commit -m "feat: render calendar orders as date ranges"
```

---

### Task 3: Daily Mode and Unresolved Items

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Add failing daily and unresolved tests**

Add these after the 2-week tests:

```tsx
  it('shows today orders once in daily mode with the correct range status', () => {
    vi.setSystemTime(new Date('2026-07-02T03:00:00.000Z'));
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'daily-progress',
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
    fireEvent.click(screen.getByRole('radio', { name: '일별' }));

    expect(screen.getByRole('heading', { name: '7월 2일' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /곶감단지 · 2세트.*진행 중/ })).toBeInTheDocument();
    expect(screen.getAllByText('곶감단지 · 2세트')).toHaveLength(1);
  });

  it('keeps missing and invalid desired dates in the unresolved calendar group', () => {
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
        {
          ...order,
          id: 'calendar-invalid',
          customerName: '문확인',
          orderItems: '양갱',
          quantity: '3개',
          desiredDateTime: '2026-06-29',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    const unresolved = screen.getByRole('region', { name: '날짜 확인 필요' });
    expect(within(unresolved).getByRole('button', { name: /화과자 · 4개.*희망일 확인/ })).toBeInTheDocument();
    expect(within(unresolved).getByRole('button', { name: /양갱 · 3개.*기간 확인/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: FAIL because daily rendering and unresolved reason labels are not implemented.

- [ ] **Step 3: Add daily helpers**

Add these helper functions near `buildRangeSegments`:

```tsx
const getDailyRangeStatus = (item: CalendarRangeItem, today: string) => {
  if (item.startDate === today) {
    return '등록';
  }

  if (item.endDate === today) {
    return '마감';
  }

  return '진행 중';
};

const buildDailyItems = (rangeItems: CalendarRangeItem[], today: string) =>
  sortBy(
    rangeItems.filter((item) => item.startDate <= today && item.endDate >= today),
    [(item) => item.endDate, (item) => item.order.createdAt],
  );

const getUnresolvedReasonLabel = (reason: CalendarUnresolvedItem['reason']) =>
  reason === 'invalid-range' ? '기간 확인' : '희망일 확인';
```

- [ ] **Step 4: Render daily mode**

Inside the calendar branch, compute:

```tsx
    const dailyItems = calendarRangeMode === 'day' ? buildDailyItems(calendarData.rangeItems, todayIsoDate) : [];
```

Then render daily content after `calendarWindow ? ... : null`:

```tsx
          {calendarRangeMode === 'day' ? (
            <section className="calendarDaily" aria-labelledby="calendar-daily-title">
              <div className="calendarDateHeader">
                <h3 id="calendar-daily-title">{formatCalendarDateLabel(todayIsoDate)}</h3>
                <span>{dailyItems.length}건</span>
              </div>
              <div className="calendarDailyList">
                {dailyItems.map((item) => {
                  const status = getDailyRangeStatus(item, todayIsoDate);

                  return (
                    <button
                      key={item.order.id}
                      type="button"
                      className="calendarDailyItem"
                      aria-label={`${summarizeOrder(item.order)} ${status}`}
                      onClick={() => onSelect(item.order.id)}
                    >
                      <span className="calendarRangeMeta">{status}</span>
                      <strong>{summarizeOrder(item.order)}</strong>
                      <span>{fallback(item.order.customerName, '고객명 미정')}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
```

- [ ] **Step 5: Render unresolved items with reason labels**

Replace old unresolved rendering with:

```tsx
          {calendarData.unresolvedItems.length > 0 ? (
            <section className="calendarUnresolved" role="region" aria-labelledby="calendar-unresolved-title">
              <h3 id="calendar-unresolved-title">날짜 확인 필요</h3>
              <div className="calendarMarkerList">
                {calendarData.unresolvedItems.map((item) => (
                  <button
                    key={item.order.id}
                    type="button"
                    className="calendarOrderChip unresolved"
                    aria-label={`${summarizeOrder(item.order)} ${getUnresolvedReasonLabel(item.reason)}`}
                    onClick={() => onSelect(item.order.id)}
                  >
                    <span className="calendarMarkerKind">{getUnresolvedReasonLabel(item.reason)}</span>
                    <strong>{summarizeOrder(item.order)}</strong>
                    <span>{fallback(item.order.customerName, '고객명 미정')}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: PASS for `OrderList.test.tsx`.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx
git commit -m "feat: add daily calendar range mode"
```

---

### Task 4: Calendar CSS and Responsive Layout

**Files:**
- Modify: `src/App.css:623-727`
- Modify: `src/App.css:1001-1054`

- [ ] **Step 1: Replace calendar CSS**

Replace the existing `.orderCalendar` through `.calendarOrderChip.unresolved .calendarMarkerKind` block with:

```css
.orderCalendar {
  display: grid;
  gap: 10px;
}

.calendarModeControl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  border: 1px solid #e1d5c2;
  border-radius: 8px;
  background: #fffdf8;
  padding: 4px;
}

.calendarModeOption {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  color: #5b4322;
  font-size: 13px;
  font-weight: 800;
}

.calendarModeOption:has(input:checked) {
  background: #f2e2ca;
}

.calendarModeOption input {
  width: 14px;
  min-height: 14px;
}

.calendarGrid,
.calendarDaily,
.calendarUnresolved {
  display: grid;
  gap: 8px;
  border: 1px solid #eee3d2;
  border-radius: 8px;
  background: #fffdf9;
  padding: 10px;
}

.calendarWeekHeader,
.calendarDayNumbers,
.calendarRangeLayer {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.calendarWeekHeader {
  color: #746552;
  font-size: 11px;
  font-weight: 900;
  text-align: center;
}

.calendarWeekRow {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.calendarDayNumber {
  min-width: 0;
  border-radius: 6px;
  background: #fbf4e8;
  color: #5b4322;
  padding: 4px 2px;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
  overflow-wrap: anywhere;
}

.calendarRangeLayer {
  align-items: stretch;
}

.calendarRangeBar {
  display: grid;
  min-width: 0;
  gap: 2px;
  border: 1px solid #d7c8ad;
  border-radius: 6px;
  background: #fff7df;
  color: #1b2430;
  padding: 6px 7px;
  text-align: left;
}

.calendarRangeBar strong,
.calendarDailyItem strong,
.calendarOrderChip strong,
.calendarOrderChip span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.calendarRangeBar strong,
.calendarDailyItem strong,
.calendarOrderChip strong {
  font-size: 12px;
}

.calendarRangeMeta,
.calendarMarkerKind {
  width: fit-content;
  border-radius: 999px;
  background: #f0e4d2;
  color: #5b4322;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 800;
}

.calendarDailyList,
.calendarMarkerList {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.calendarDailyItem,
.calendarOrderChip {
  display: grid;
  min-width: 0;
  gap: 2px;
  border: 1px solid #e4d7c5;
  border-radius: 8px;
  background: #fffaf2;
  color: #1b2430;
  padding: 7px 8px;
  text-align: left;
}

.calendarDailyItem > span:not(.calendarRangeMeta),
.calendarOrderChip > span:not(.calendarMarkerKind) {
  color: #746552;
  font-size: 12px;
}

.calendarUnresolved h3 {
  margin: 0;
  color: #1b2430;
  font-size: 14px;
  line-height: 1.25;
}

.calendarOrderChip.unresolved {
  border-color: #d2beb4;
  background: #fff7f2;
}

.calendarOrderChip.unresolved .calendarMarkerKind {
  background: #7a3d2f;
  color: #fffaf2;
}
```

- [ ] **Step 2: Replace mobile calendar CSS**

In the mobile media query near `.calendarOrderChip`, replace that specific rule with:

```css
  .calendarModeControl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .calendarGrid,
  .calendarDaily,
  .calendarUnresolved {
    padding: 8px;
  }

  .calendarWeekHeader,
  .calendarDayNumbers,
  .calendarRangeLayer {
    gap: 3px;
  }

  .calendarDayNumber {
    font-size: 10px;
  }

  .calendarRangeBar {
    padding: 5px 6px;
  }
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- --run src/components/OrderList.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit Task 4**

```bash
git add src/App.css
git commit -m "style: polish calendar range layout"
```

---

### Task 5: Verification and Browser Smoke

**Files:**
- No source changes expected unless verification finds a defect.

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

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Start local dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5175
```

Expected: Vite serves the app at `http://127.0.0.1:5175/`. If port 5175 is occupied, use 5176.

- [ ] **Step 4: Verify desktop and mobile layouts**

Use Playwright or the available browser tool to inspect:

```text
Desktop: 1280 x 900
Mobile: 390 x 844
```

Manual checks:

- `보기 > 달력형 보기` opens monthly mode by default.
- Monthly grid looks like a normal Sunday-Saturday calendar.
- Switching to `2주` shows exactly two Sunday-Saturday rows.
- Switching to `일별` shows one entry per active order.
- Long Korean order text wraps inside the bar or item without horizontal overflow.
- `날짜 확인 필요` remains below the active calendar content.

- [ ] **Step 5: Commit any verification fixes**

If Step 4 required fixes:

```bash
git add src/components/OrderList.tsx src/components/OrderList.test.tsx src/App.css
git commit -m "fix: refine calendar range verification issues"
```

If no fixes are needed, do not create an empty commit.

---

## Self-Review

- Spec coverage:
  - `일별`, `2주`, `월별` modes are covered by Tasks 1-3.
  - Default `월별` and separate persistence are covered by Task 1.
  - 2-week Sunday-Saturday current/next week rule is covered by Task 2.
  - Connected range rendering and no repeated daily chips are covered by Task 2.
  - Daily one-row status labels are covered by Task 3.
  - Missing/relative/invalid dates in `날짜 확인 필요` are covered by Task 3.
  - Mobile no-overflow and desktop/mobile verification are covered by Tasks 4-5.
- Placeholder scan:
  - 금지된 자리표시자 문구나 범위가 불명확한 테스트 지시가 남아 있지 않다.
- Type consistency:
  - `CalendarRangeMode`, `CalendarRangeItem`, `CalendarUnresolvedItem`, `CalendarWeekRow`, and `CalendarRangeSegment` are introduced before use.
  - Storage keys and labels match the tests.
  - The grid aria labels are `월별 주문 달력` and `2주 주문 달력`, matching test queries.
