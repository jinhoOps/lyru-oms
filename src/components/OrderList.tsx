import { useState } from 'react';
import { FIELD_DEFINITIONS, type CapturedOrder } from '../domain/orderTypes';

interface OrderListProps {
  orders: CapturedOrder[];
  selectedId: string | null;
  onSelect: (orderId: string) => void;
}

const fallback = (value: string, label: string) => (value.trim() ? value : label);

const summarizeOrder = (order: CapturedOrder) => {
  const item = fallback(order.orderItems, '주문 내용 미정');
  const quantity = order.quantity.trim() ? `${order.quantity}개` : '수량 미정';

  return `${item} · ${quantity}`;
};

const formatRegisteredAt = (isoDate: string) => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '등록일 미정';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `등록 ${year}-${month}-${day} ${hours}:${minutes}`;
};

export function OrderList({ orders, selectedId, onSelect }: OrderListProps) {
  const [expandedRawTextIds, setExpandedRawTextIds] = useState<string[]>([]);

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
          <p>확인할 주문을 고릅니다.</p>
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
          <p>확인할 주문을 고릅니다.</p>
        </div>
        <span>{orders.length}건</span>
      </div>
      <div className="orderList">
        {orders.map((order) => {
          const isExpanded = expandedRawTextIds.includes(order.id);
          const hasCustomerRequest = order.customerRequestNote.trim() !== '';
          const hasOwnerMemo = order.ownerMemo.trim() !== '';

          return (
            <article
              key={order.id}
              className={`orderRow ${selectedId === order.id ? 'selected' : ''} ${
                order.warningLevel === 'attention' ? 'attention' : ''
              }`}
            >
              <button type="button" className="orderRowMain" onClick={() => onSelect(order.id)}>
                <span className="rowTopline">
                  <span className="sourcePill">{order.source}</span>
                  <span className="statusPill">{order.status}</span>
                  <span className="registeredAt">{formatRegisteredAt(order.createdAt)}</span>
                </span>
                <strong>{fallback(order.customerName, '고객명 미정')}</strong>
                <span>{summarizeOrder(order)}</span>
                <span className="mutedText">
                  {fallback(order.desiredDateTime, '희망일 미정')} · {fallback(order.fulfillmentType, '수령 방식 없음')}
                </span>
                <span className="flagLine">
                  {hasCustomerRequest ? <span className="flagOn">고객 요청 있음</span> : null}
                  {hasOwnerMemo ? <span className="flagOn">내부 메모 있음</span> : null}
                </span>
              </button>

              {order.missingFields.length > 0 ? (
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
