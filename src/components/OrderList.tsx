import { useState } from 'react';
import { formatDday, parseExplicitDate } from '../domain/dateDisplay';
import { FIELD_DEFINITIONS, type CapturedOrder } from '../domain/orderTypes';

interface OrderListProps {
  orders: CapturedOrder[];
  selectedId: string | null;
  onSelect: (orderId: string) => void;
}

const fallback = (value: string, label: string) => (value.trim() ? value : label);

const summarizeOrder = (order: CapturedOrder) => {
  const item = fallback(order.orderItems, '주문 내용 미정');
  const quantity = order.quantity.trim() ? order.quantity : '수량 미정';

  return `${item} · ${quantity}`;
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
    summaries.push(`채워야 할 정보 ${infoCount}개`);
  }

  if (checkCount > 0) {
    summaries.push(`확인할 내용 ${checkCount}개`);
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

export function OrderList({ orders, selectedId, onSelect }: OrderListProps) {
  const [expandedRawTextIds, setExpandedRawTextIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  function toggleRawText(orderId: string) {
    setExpandedRawTextIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  }

  if (orders.length === 0) {
    return (
      <section className="orderListPanel" aria-label="주문 목록">
        <div className="sectionHeader">
          <h2>주문 목록</h2>
          <p>주문을 빠르게 훑고 선택합니다.</p>
        </div>
        <p className="emptyState">아직 저장된 주문이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="orderListPanel" aria-label="주문 목록">
      <div className="listHeader">
        <div className="sectionHeader">
          <h2>주문 목록</h2>
          <p>주문을 빠르게 훑고 선택합니다.</p>
        </div>
        <div className="listHeaderActions">
          <span>{orders.length}건</span>
          <div className="viewToggle" aria-label="주문 목록 보기 방식">
            <button
              type="button"
              className={viewMode === 'card' ? 'active' : ''}
              aria-label="카드형 보기"
              title="카드형 보기"
              aria-pressed={viewMode === 'card'}
              onClick={() => setViewMode('card')}
            >
              <span className="cardIcon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              aria-label="목록형 보기"
              title="목록형 보기"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              <span className="listIcon" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className={viewMode === 'list' ? 'orderList compact' : 'orderList'}>
        {orders.map((order) => {
          const isExpanded = expandedRawTextIds.includes(order.id);
          const hasCustomerRequest = order.customerRequestNote.trim() !== '';
          const hasOwnerMemo = order.ownerMemo.trim() !== '';
          const dday = formatDday(getDisplayDate(order));
          const reasonSummaries = summarizeReviewReasonGroups(order);

          return (
            <article
              key={order.id}
              className={`orderRow ${selectedId === order.id ? 'selected' : ''} ${
                order.warningLevel === 'attention' ? 'attention' : ''
              }`}
            >
              {viewMode === 'list' ? (
                <button type="button" className="orderRowMain compactRow" onClick={() => onSelect(order.id)}>
                  <span className="compactLine">
                    <span className="statusPill">{order.status}</span>
                    <span className="ddayBadge" title={dday.title}>
                      {dday.label}
                    </span>
                    <strong>{summarizeOrder(order)}</strong>
                  </span>
                  <span className="compactLine mutedText">
                    {fallback(order.desiredDateTime, '희망일 미정')} · {fallback(order.fulfillmentType, '수령 방식 없음')}
                  </span>
                  {reasonSummaries.length > 0 ? (
                    <span className="compactLine reasonSummaryLine">
                      {reasonSummaries.map((summary) => (
                        <span key={summary} className="reasonSummaryPill">
                          {summary}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              ) : (
                <button type="button" className="orderRowMain" onClick={() => onSelect(order.id)}>
                  <span className="rowTopline">
                    <span className="sourcePill">{order.source}</span>
                    <span className="statusPill">{order.status}</span>
                    <span className="ddayBadge" title={dday.title}>
                      {dday.label}
                    </span>
                    <span className="registeredAt">{formatRegisteredAt(order.createdAt)}</span>
                  </span>
                  <strong>{fallback(order.customerName, '고객명 미정')}</strong>
                  <span>{summarizeOrder(order)}</span>
                  <span className="mutedText">
                    {fallback(order.desiredDateTime, '희망일 미정')} · {fallback(order.fulfillmentType, '수령 방식 없음')}
                  </span>
                  <span className="flagLine">
                    {reasonSummaries.map((summary) => (
                      <span key={summary} className="reasonSummaryPill">
                        {summary}
                      </span>
                    ))}
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
