import { groupBy, sortBy } from 'es-toolkit';
import { type FocusEvent, useMemo, useState } from 'react';
import { formatDday, parseExplicitDate } from '../domain/dateDisplay';
import { FIELD_DEFINITIONS, ORDER_SOURCES, type CapturedOrder, type OrderSource } from '../domain/orderTypes';
import type { OrderSortMode } from '../domain/orderSorting';

export type OrderSourceFilter = '전체' | OrderSource;
type OrderListViewMode = 'card' | 'list' | 'calendar';
type CalendarRangeMode = 'day' | 'twoWeek' | 'month';

interface OrderListProps {
  orders: CapturedOrder[];
  totalOrderCount: number;
  selectedId: string | null;
  sortMode: OrderSortMode;
  sourceFilter: OrderSourceFilter;
  onSortModeChange: (mode: OrderSortMode) => void;
  onSourceFilterChange: (source: OrderSourceFilter) => void;
  onSelect: (orderId: string) => void;
  onClearOrders: () => void;
}

const ORDER_LIST_VIEW_MODE_KEY = 'lyru-oms.orderList.viewMode.v1';
const ORDER_LIST_CALENDAR_MODE_KEY = 'lyru-oms.orderList.calendarMode.v1';

const sortOptions: Array<{ mode: OrderSortMode; label: string }> = [
  { mode: 'desiredDate', label: '희망일 빠른 순' },
  { mode: 'recent', label: '최근 등록순' },
  { mode: 'quantityDesc', label: '수량 많은 순' },
];

const viewOptions: Array<{ mode: OrderListViewMode; label: string }> = [
  { mode: 'list', label: '목록형 보기' },
  { mode: 'card', label: '카드형 보기' },
  { mode: 'calendar', label: '달력형 보기' },
];

const calendarRangeOptions: Array<{ mode: CalendarRangeMode; label: string }> = [
  { mode: 'day', label: '일별' },
  { mode: 'twoWeek', label: '2주' },
  { mode: 'month', label: '월별' },
];

const sourceOptions: OrderSourceFilter[] = ['전체', ...ORDER_SOURCES];

const fallback = (value: string, label: string) => (value.trim() ? value : label);

const loadOrderListViewMode = (): OrderListViewMode => {
  try {
    if (typeof localStorage === 'undefined') {
      return 'list';
    }

    const stored = localStorage.getItem(ORDER_LIST_VIEW_MODE_KEY);
    return stored === 'card' || stored === 'list' || stored === 'calendar' ? stored : 'list';
  } catch {
    return 'list';
  }
};

const saveOrderListViewMode = (mode: OrderListViewMode) => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(ORDER_LIST_VIEW_MODE_KEY, mode);
  } catch {
    // Ignore blocked storage; the in-memory state still updates.
  }
};

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

const summarizeOrder = (order: CapturedOrder) => {
  const item = fallback(order.orderItems, '주문 내용 미정');
  const quantity = order.quantity.trim() ? order.quantity : '수량 미정';

  return `${item} · ${quantity}`;
};

const closeMenuAfterFocusLeaves = (event: FocusEvent<HTMLDivElement>, closeMenu: () => void) => {
  const menuWrap = event.currentTarget;
  const nextFocus = event.relatedTarget;

  if (nextFocus instanceof Node) {
    if (!menuWrap.contains(nextFocus)) {
      closeMenu();
    }

    return;
  }

  window.setTimeout(() => {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof Node) || !menuWrap.contains(activeElement)) {
      closeMenu();
    }
  }, 0);
};

const getOrderStatusClass = (status: CapturedOrder['status']) => {
  switch (status) {
    case '확인 필요':
      return 'status-needs-review';
    case '제작 준비':
      return 'status-production-ready';
    case '발송 완료':
      return 'status-shipped';
    case '신규':
    default:
      return 'status-new';
  }
};

const summarizeReviewReasonGroups = (order: CapturedOrder) => {
  const infoReasonFields = new Set(
    order.reviewReasons.filter((reason) => reason.group === 'info' && reason.field).map((reason) => reason.field),
  );
  const supplementalMissingFields = order.missingFields.filter((field) => !infoReasonFields.has(field));
  const infoCount =
    order.reviewReasons.filter((reason) => reason.group === 'info').length + supplementalMissingFields.length;
  const checkCount = order.reviewReasons.filter((reason) => reason.group === 'check').length;
  const summaries: string[] = [];

  if (infoCount > 0) {
    summaries.push(`정보 ${infoCount}개`);
  }

  if (checkCount > 0) {
    summaries.push(`확인 ${checkCount}개`);
  }

  return summaries;
};

const formatRegisteredAt = (isoDate: string) => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '등록일 미정';
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hours = getPart('hour');
  const minutes = getPart('minute');

  return `등록 ${year}-${month}-${day} ${hours}:${minutes}`;
};

const getDisplayDate = (order: CapturedOrder) => {
  const parsedDesiredDate = order.desiredDateTime.trim() ? parseExplicitDate(order.desiredDateTime) : null;

  return parsedDesiredDate ?? order.parsedDate;
};

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
  const [, month, day] = isoDate.split('-').map(Number);

  if (!month || !day) {
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

export function OrderList({
  orders,
  totalOrderCount,
  selectedId,
  sortMode,
  sourceFilter,
  onSortModeChange,
  onSourceFilterChange,
  onSelect,
  onClearOrders,
}: OrderListProps) {
  const [expandedRawTextIds, setExpandedRawTextIds] = useState<string[]>([]);
  const [viewMode, setViewModeState] = useState<OrderListViewMode>(() => loadOrderListViewMode());
  const [calendarRangeMode, setCalendarRangeModeState] = useState<CalendarRangeMode>(() => loadCalendarRangeMode());
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
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

  function setViewMode(mode: OrderListViewMode) {
    setViewModeState(mode);
    saveOrderListViewMode(mode);
    setViewMenuOpen(false);
  }

  function setCalendarRangeMode(mode: CalendarRangeMode) {
    setCalendarRangeModeState(mode);
    saveCalendarRangeMode(mode);
  }

  function toggleRawText(orderId: string) {
    setExpandedRawTextIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  }

  function chooseSortMode(mode: OrderSortMode) {
    onSortModeChange(mode);
    setSortMenuOpen(false);
  }

  function chooseSourceFilter(source: OrderSourceFilter) {
    onSourceFilterChange(source);
    setSourceMenuOpen(false);
  }

  function clearOrdersFromActionMenu() {
    setActionMenuOpen(false);
    onClearOrders();
  }

  const header = (
    <div className="listHeader">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitleLine">
            <h2>주문 목록</h2>
            <span className="orderCount">{orders.length}건</span>
          </div>
          <p>주문을 빠르게 훑고 선택합니다.</p>
        </div>
        <div className="sectionHeaderActions listHeaderActions">
          <div
            className="sortMenuWrap"
            onBlur={(event) => closeMenuAfterFocusLeaves(event, () => setSortMenuOpen(false))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSortMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="secondaryButton compactTextButton sortButton"
              aria-expanded={sortMenuOpen}
              onClick={() => {
                setViewMenuOpen(false);
                setActionMenuOpen(false);
                setSourceMenuOpen(false);
                setSortMenuOpen((open) => !open);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSortMenuOpen(false);
                }
              }}
            >
              정렬
            </button>
            {sortMenuOpen ? (
              <div className="sortMenu" role="radiogroup" aria-label="정렬 방식">
                {sortOptions.map((option) => (
                  <label key={option.mode} className="sortMenuOption">
                    <input
                      type="radio"
                      name="order-sort-mode"
                      checked={sortMode === option.mode}
                      onChange={() => chooseSortMode(option.mode)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div
            className="viewMenuWrap"
            onBlur={(event) => closeMenuAfterFocusLeaves(event, () => setViewMenuOpen(false))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setViewMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="secondaryButton compactTextButton viewButton"
              aria-expanded={viewMenuOpen}
              onClick={() => {
                setSortMenuOpen(false);
                setActionMenuOpen(false);
                setSourceMenuOpen(false);
                setViewMenuOpen((open) => !open);
              }}
            >
              보기
            </button>
            {viewMenuOpen ? (
              <div className="sortMenu viewMenu" role="radiogroup" aria-label="보기 방식">
                {viewOptions.map((option) => (
                  <label key={option.mode} className="sortMenuOption">
                    <input
                      type="radio"
                      name="order-view-mode"
                      checked={viewMode === option.mode}
                      onChange={() => setViewMode(option.mode)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div
            className="actionMenuWrap"
            onBlur={(event) => closeMenuAfterFocusLeaves(event, () => setActionMenuOpen(false))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setActionMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="secondaryButton compactTextButton actionButton"
              aria-expanded={actionMenuOpen}
              onClick={() => {
                setSortMenuOpen(false);
                setViewMenuOpen(false);
                setSourceMenuOpen(false);
                setActionMenuOpen((open) => !open);
              }}
            >
              작업
            </button>
            {actionMenuOpen ? (
              <div className="sortMenu actionMenu" role="menu" aria-label="주문 목록 작업">
                <button
                  type="button"
                  className="actionMenuItem danger"
                  role="menuitem"
                  disabled={totalOrderCount === 0}
                  onClick={clearOrdersFromActionMenu}
                >
                  전체 삭제
                </button>
              </div>
            ) : null}
          </div>
          <div
            className="sourceMenuWrap"
            onBlur={(event) => closeMenuAfterFocusLeaves(event, () => setSourceMenuOpen(false))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSourceMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="secondaryButton compactTextButton sourceButton"
              aria-expanded={sourceMenuOpen}
              onClick={() => {
                setSortMenuOpen(false);
                setViewMenuOpen(false);
                setActionMenuOpen(false);
                setSourceMenuOpen((open) => !open);
              }}
            >
              채널: {sourceFilter}
            </button>
            {sourceMenuOpen ? (
              <div className="sortMenu sourceMenu" role="radiogroup" aria-label="주문 목록 채널">
                {sourceOptions.map((source) => (
                  <label key={source} className="sortMenuOption">
                    <input
                      type="radio"
                      name="order-source-filter"
                      checked={sourceFilter === source}
                      onChange={() => chooseSourceFilter(source)}
                    />
                    <span>{source}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (orders.length === 0) {
    return (
      <section className="orderListPanel" aria-label="주문 목록">
        {header}
        <p className="emptyState">
          {totalOrderCount === 0 ? '아직 저장된 주문이 없습니다.' : '선택한 채널의 주문이 없습니다.'}
        </p>
      </section>
    );
  }

  if (viewMode === 'calendar') {
    return (
      <section className="orderListPanel" aria-label="주문 목록">
        {header}
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
        <div
          className="orderCalendar"
          role="grid"
          aria-label={calendarRangeMode === 'month' ? '월별 주문 달력' : '주문 달력'}
        >
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

  return (
    <section className="orderListPanel" aria-label="주문 목록">
      {header}
      <div className={viewMode === 'list' ? 'orderList compact' : 'orderList'}>
        {orders.map((order) => {
          const isExpanded = expandedRawTextIds.includes(order.id);
          const hasCustomerRequest = order.customerRequestNote.trim() !== '';
          const hasOwnerMemo = order.ownerMemo.trim() !== '';
          const hasUnconfirmedChangeRequest = order.changeRequestNote.trim() !== '' && !order.changeRequestConfirmed;
          const dday = formatDday(getDisplayDate(order));
          const reasonSummaries = summarizeReviewReasonGroups(order);
          const statusClass = getOrderStatusClass(order.status);

          return (
            <article
              key={order.id}
              className={`orderRow ${statusClass} ${selectedId === order.id ? 'selected' : ''} ${
                order.warningLevel === 'attention' ? 'attention' : ''
              }`}
            >
              {viewMode === 'list' ? (
                <button type="button" className="orderRowMain compactRow" onClick={() => onSelect(order.id)}>
                  <span className="compactLine badgeLine">
                    <span className={`statusPill ${statusClass}`}>{order.status}</span>
                    <span className="ddayBadge" title={dday.title}>
                      {dday.label}
                    </span>
                    {hasUnconfirmedChangeRequest ? <span className="changeRequestPill">변경 확인 필요</span> : null}
                    {reasonSummaries.map((summary) => (
                      <span key={summary} className="reasonSummaryPill">
                        {summary}
                      </span>
                    ))}
                  </span>
                  <strong className="orderSummaryText">{summarizeOrder(order)}</strong>
                  <span className="compactLine mutedText">
                    {fallback(order.customerName, '고객명 미정')} · {fallback(order.desiredDateTime, '희망일 미정')} ·{' '}
                    {fallback(order.fulfillmentType, '수령 방식 없음')}
                  </span>
                </button>
              ) : (
                <button type="button" className="orderRowMain" onClick={() => onSelect(order.id)}>
                  <span className="rowTopline">
                    <span className="sourcePill">{order.source}</span>
                    <span className={`statusPill ${statusClass}`}>{order.status}</span>
                    <span className="ddayBadge" title={dday.title}>
                      {dday.label}
                    </span>
                    {reasonSummaries.map((summary) => (
                      <span key={summary} className="reasonSummaryPill">
                        {summary}
                      </span>
                    ))}
                    {hasUnconfirmedChangeRequest ? <span className="changeRequestPill">변경 확인 필요</span> : null}
                    <span className="registeredAt">{formatRegisteredAt(order.createdAt)}</span>
                  </span>
                  <strong className="orderSummaryText">{summarizeOrder(order)}</strong>
                  <span className="mutedText">
                    {fallback(order.customerName, '고객명 미정')} · {fallback(order.desiredDateTime, '희망일 미정')} ·{' '}
                    {fallback(order.fulfillmentType, '수령 방식 없음')}
                  </span>
                  <span className="flagLine">
                    {hasCustomerRequest ? <span className="flagOn">고객 요청 있음</span> : null}
                    {hasOwnerMemo ? <span className="flagOn">내부 메모 있음</span> : null}
                  </span>
                </button>
              )}

              {viewMode === 'card' && order.missingFields.length > 0 ? (
                <div className="rawTextArea">
                  <p>
                    부족 항목:{' '}
                    {order.missingFields.map((field) => FIELD_DEFINITIONS[field].label).join(', ')}
                  </p>
                  <button type="button" className="linkButton" onClick={() => toggleRawText(order.id)}>
                    {isExpanded ? '원문 닫기' : '원문 보기'}
                  </button>
                  {isExpanded ? <pre>{order.rawText}</pre> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
