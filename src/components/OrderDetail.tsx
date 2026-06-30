import {
  FIELD_DEFINITIONS,
  ORDER_STATUSES,
  type CapturedOrder,
  type OrderFieldKey,
  type OrderSettings,
  type OrderStatus,
} from '../domain/orderTypes';
import { parseRawText } from '../domain/parser';
import { evaluateOrder, mergeParsedFields } from '../domain/reviewRules';
import { ReparseHint } from './ReparseHint';

interface OrderDetailProps {
  order: CapturedOrder | null;
  settings: OrderSettings;
  onChange: (order: CapturedOrder) => void;
}

const editableFields: OrderFieldKey[] = [
  'customerName',
  'phone',
  'orderItems',
  'quantity',
  'purpose',
  'fulfillmentType',
  'desiredDateTime',
  'pickupTime',
  'address',
  'allergyNote',
  'options',
  'customerRequestNote',
  'ownerMemo',
];

const multilineFields = new Set<OrderFieldKey>(['orderItems', 'options', 'customerRequestNote', 'ownerMemo', 'address']);

export function OrderDetail({ order, settings, onChange }: OrderDetailProps) {
  if (!order) {
    return (
      <section className="orderDetailPanel emptyDetail" aria-label="주문 상세">
        <h2>주문을 선택해 주세요</h2>
        <p>목록에서 주문을 누르면 요청사항, 내부 메모, 상태를 확인하고 수정할 수 있습니다.</p>
      </section>
    );
  }

  function publish(nextOrder: CapturedOrder) {
    onChange(evaluateOrder({ ...nextOrder, updatedAt: new Date().toISOString() }, settings));
  }

  function handleFieldChange(field: OrderFieldKey, value: string) {
    if (!order) {
      return;
    }

    const manuallyEditedFields = order.manuallyEditedFields.includes(field)
      ? order.manuallyEditedFields
      : [...order.manuallyEditedFields, field];

    publish({
      ...order,
      [field]: value,
      manuallyEditedFields,
    });
  }

  function handleStatusChange(status: OrderStatus) {
    if (!order) {
      return;
    }

    publish({ ...order, status });
  }

  function handleRawTextChange(rawText: string) {
    if (!order) {
      return;
    }

    const reparsed = mergeParsedFields({ ...order, rawText }, parseRawText(rawText));
    publish(reparsed);
  }

  const differenceByField = new Map(order.reparseDifferences.map((difference) => [difference.field, difference]));

  return (
    <section className="orderDetailPanel" aria-label="주문 상세">
      <div className="detailHeader">
        <div>
          <p className="eyebrow">{order.source}</p>
          <h2>{order.customerName || '고객명 미정'}</h2>
        </div>
        <label className="statusSelect">
          상태
          <select value={order.status} onChange={(event) => handleStatusChange(event.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

      {order.reviewReasons.length > 0 ? (
        <div className="reviewReasonBox" aria-label="확인 필요 사유">
          {order.reviewReasons.map((reason) => (
            <p key={`${reason.kind}-${reason.field ?? reason.message}`}>{reason.message}</p>
          ))}
        </div>
      ) : null}

      <label className="fieldBlock">
        주문/문의 원문
        <textarea value={order.rawText} rows={7} onChange={(event) => handleRawTextChange(event.target.value)} />
      </label>

      <div className="fieldGrid">
        {editableFields.map((field) => {
          const difference = differenceByField.get(field);
          const isTextarea = multilineFields.has(field);

          return (
            <label key={field} className={isTextarea ? 'fieldBlock spanAll' : 'fieldBlock'}>
              <span>
                {FIELD_DEFINITIONS[field].label}
                {difference ? <ReparseHint extractedValue={difference.extractedValue} /> : null}
              </span>
              {field === 'fulfillmentType' ? (
                <select value={order.fulfillmentType} onChange={(event) => handleFieldChange(field, event.target.value)}>
                  <option value="">미정</option>
                  <option value="픽업">픽업</option>
                  <option value="택배">택배</option>
                </select>
              ) : isTextarea ? (
                <textarea
                  value={order[field]}
                  rows={field === 'ownerMemo' ? 4 : 3}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                />
              ) : (
                <input value={order[field]} onChange={(event) => handleFieldChange(field, event.target.value)} />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
