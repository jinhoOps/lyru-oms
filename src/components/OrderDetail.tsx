import {
  FIELD_DEFINITIONS,
  ORDER_STATUSES,
  type CapturedOrder,
  type OrderFieldKey,
  type OrderSettings,
  type OrderStatus,
  type ReviewReason,
} from '../domain/orderTypes';
import { parseExplicitDate } from '../domain/dateDisplay';
import { parseRawText } from '../domain/parser';
import { evaluateOrder, mergeParsedFields } from '../domain/reviewRules';
import { ReparseHint } from './ReparseHint';

interface OrderDetailProps {
  order: CapturedOrder | null;
  settings: OrderSettings;
  onChange: (order: CapturedOrder) => void;
  onClose: () => void;
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

const buildFallbackMissingReasons = (fields: OrderFieldKey[]): ReviewReason[] =>
  fields.map((field) => ({
    kind: '정보 부족',
    group: 'info',
    code: 'missing-field',
    field,
    label: FIELD_DEFINITIONS[field].label,
    message: `${FIELD_DEFINITIONS[field].label} 정보가 비어 있어요.`,
  }));

const mergeInfoReasonsWithMissingFields = (infoReasons: ReviewReason[], missingFields: OrderFieldKey[]) => {
  const infoReasonFields = new Set(infoReasons.filter((reason) => reason.field).map((reason) => reason.field));
  const supplementalMissingFields = missingFields.filter((field) => !infoReasonFields.has(field));

  return [...infoReasons, ...buildFallbackMissingReasons(supplementalMissingFields)];
};

export function OrderDetail({ order, settings, onChange, onClose }: OrderDetailProps) {
  if (!order) {
    return null;
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
      ...(field === 'desiredDateTime' ? { parsedDate: parseExplicitDate(value) } : {}),
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

  function handleChangeRequestNoteChange(changeRequestNote: string) {
    if (!order) {
      return;
    }

    const nextNote = changeRequestNote.trim();
    const currentNote = order.changeRequestNote.trim();

    publish({
      ...order,
      changeRequestNote,
      changeRequestConfirmed: nextNote !== '' && nextNote === currentNote ? order.changeRequestConfirmed : false,
    });
  }

  function handleChangeRequestConfirmedChange(changeRequestConfirmed: boolean) {
    if (!order || !order.changeRequestNote.trim()) {
      return;
    }

    publish({ ...order, changeRequestConfirmed });
  }

  const differenceByField = new Map(order.reparseDifferences.map((difference) => [difference.field, difference]));
  const infoReasons = order.reviewReasons.filter((reason) => reason.group === 'info');
  const checkReasons = order.reviewReasons.filter((reason) => reason.group === 'check');
  const infoReasonsToShow = mergeInfoReasonsWithMissingFields(infoReasons, order.missingFields);
  const hasUnconfirmedChangeRequest = order.changeRequestNote.trim() !== '' && !order.changeRequestConfirmed;
  const shouldShowReviewBox = infoReasonsToShow.length > 0 || checkReasons.length > 0 || hasUnconfirmedChangeRequest;
  const visibleEditableFields = editableFields.filter((field) => {
    if (order.fulfillmentType === '픽업') {
      return field !== 'address';
    }

    if (order.fulfillmentType === '택배') {
      return field !== 'pickupTime';
    }

    return true;
  });

  return (
    <div className="detailModalBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="orderDetailModal"
        role="dialog"
        aria-modal="true"
        aria-label="주문 상세"
        onMouseDown={(event) => event.stopPropagation()}
      >
      <div className="detailHeader">
        <div>
          <p className="eyebrow">{order.source}</p>
          <h2>{order.customerName || '고객명 미정'}</h2>
          <p className="sectionHelp">추출된 값을 확인하고 수정합니다.</p>
        </div>
        <div className="detailHeaderActions">
          <label className="statusSelect">
            상태
            <select value={order.status} onChange={(event) => handleStatusChange(event.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button type="button" className="iconButton" aria-label="주문 상세 닫기" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="detailModalBody">
      {shouldShowReviewBox ? (
        <div className="reviewReasonBox" aria-label="확인 필요 사유">
          {infoReasonsToShow.length > 0 ? (
            <section className="reasonGroup">
              <h3>채워야 할 정보가 있어요</h3>
              <ul>
                {infoReasonsToShow.map((reason) => (
                  <li key={`${reason.group}-${reason.code}-${reason.field ?? reason.label}`}>
                    {reason.label}
                    {reason.detail ? <span className="reasonDetail">{reason.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {checkReasons.length > 0 ? (
            <section className="reasonGroup">
              <h3>확인할 내용이 있어요</h3>
              <ul>
                {checkReasons.map((reason) => (
                  <li key={`${reason.group}-${reason.code}-${reason.field ?? reason.label}`}>
                    {reason.label}
                    {reason.detail ? <span className="reasonDetail">{reason.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {hasUnconfirmedChangeRequest ? (
            <section className="reasonGroup">
              <h3>변경 요청 확인 필요</h3>
              <ul>
                <li>변경 요청</li>
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="changeRequestSection" aria-label="변경 요청 편집">
        <label className="fieldBlock spanAll">
          변경 요청
          <textarea
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

      <div className="fieldGrid">
        {visibleEditableFields.map((field) => {
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

      <label className="fieldBlock">
        주문/문의 원문
        <textarea value={order.rawText} rows={7} onChange={(event) => handleRawTextChange(event.target.value)} />
      </label>
      </div>
      </section>
    </div>
  );
}
