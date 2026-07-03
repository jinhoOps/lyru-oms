import { type FocusEvent, useState } from 'react';
import { formatDday, parseExplicitDate } from '../domain/dateDisplay';
import { FIELD_DEFINITIONS, ORDER_SOURCES, type CapturedOrder, type OrderSource } from '../domain/orderTypes';
import type { OrderSortMode } from '../domain/orderSorting';

export type OrderSourceFilter = '전체' | OrderSource;
type OrderListViewMode = 'card' | 'list';

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

const sortOptions: Array<{ mode: OrderSortMode; label: string }> = [
  { mode: 'desiredDate', label: '희망일 빠른 순' },
  { mode: 'recent', label: '최근 등록순' },
  { mode: 'quantityDesc', label: '수량 많은 순' },
];

const viewOptions: Array<{ mode: OrderListViewMode; label: string }> = [
  { mode: 'list', label: '목록형 보기' },
  { mode: 'card', label: '카드형 보기' },
];

const fallback = (value: string, label: string) => (value.trim() ? value : label);

const loadOrderListViewMode = (): OrderListViewMode => {
  try {
    if (typeof localStorage === 'undefined') {
      return 'list';
    }

    const stored = localStorage.getItem(ORDER_LIST_VIEW_MODE_KEY);
    return stored === 'card' || stored === 'list' ? stored : 'list';
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  function setViewMode(mode: OrderListViewMode) {
    setViewModeState(mode);
    saveOrderListViewMode(mode);
    setViewMenuOpen(false);
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
          <label className="headerSelectControl">
            주문 목록 채널
            <select value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value as OrderSourceFilter)}>
              <option value="전체">전체</option>
              {ORDER_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondaryButton compactTextButton clearListButton"
            disabled={totalOrderCount === 0}
            onClick={onClearOrders}
          >
            전체 삭제
          </button>
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
