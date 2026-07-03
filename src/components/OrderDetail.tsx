import { useEffect, useRef, useState } from 'react';
import { groupBy, keyBy } from 'es-toolkit';
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
import { evaluateOrder } from '../domain/reviewRules';
import { DesiredDateTimePicker } from './DesiredDateTimePicker';
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
  const infoReasonsByField = keyBy(
    infoReasons.filter((reason): reason is ReviewReason & { field: OrderFieldKey } => Boolean(reason.field)),
    (reason) => reason.field,
  );
  const supplementalMissingFields = missingFields.filter((field) => !infoReasonsByField[field]);

  return [...infoReasons, ...buildFallbackMissingReasons(supplementalMissingFields)];
};

export function OrderDetail({ order, settings, onChange, onClose }: OrderDetailProps) {
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const [isChangeRequestOpen, setIsChangeRequestOpen] = useState(() => Boolean(order?.changeRequestNote.trim()));
  const [rawTextCopied, setRawTextCopied] = useState(false);

  useEffect(() => {
    setIsChangeRequestOpen(Boolean(order?.changeRequestNote.trim()));
    setRawTextCopied(false);
  }, [order?.id]);

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

  function handleDesiredDateTimeApply(nextValue: { desiredDateTime: string; pickupTime: string }) {
    if (!order) {
      return;
    }

    const dateTextForParsing = nextValue.pickupTime
      ? `${nextValue.desiredDateTime} ${nextValue.pickupTime}`
      : nextValue.desiredDateTime;
    const editedFields = new Set<OrderFieldKey>(order.manuallyEditedFields);
    editedFields.add('desiredDateTime');

    if (order.fulfillmentType === '픽업' || nextValue.pickupTime !== order.pickupTime) {
      editedFields.add('pickupTime');
    }

    publish({
      ...order,
      desiredDateTime: nextValue.desiredDateTime,
      pickupTime: nextValue.pickupTime,
      parsedDate: parseExplicitDate(dateTextForParsing),
      manuallyEditedFields: [...editedFields],
    });
  }

  function handleStatusChange(status: OrderStatus) {
    if (!order) {
      return;
    }

    publish({ ...order, status });
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

  function handleCustomerTitleClick() {
    customerNameInputRef.current?.focus();
  }

  async function handleRawTextCopy() {
    const rawText = order?.rawText;

    if (rawText === undefined) {
      return;
    }

    try {
      await navigator.clipboard?.writeText(rawText);
      setRawTextCopied(true);
    } catch {
      setRawTextCopied(false);
    }
  }

  const differenceByField = keyBy(order.reparseDifferences, (difference) => difference.field);
  const reasonsByGroup = groupBy(order.reviewReasons, (reason) => reason.group);
  const infoReasons = reasonsByGroup.info ?? [];
  const checkReasons = reasonsByGroup.check ?? [];
  const infoReasonsToShow = mergeInfoReasonsWithMissingFields(infoReasons, order.missingFields);
  const hasUnconfirmedChangeRequest = order.changeRequestNote.trim() !== '' && !order.changeRequestConfirmed;
  const shouldShowReviewBox = infoReasonsToShow.length > 0 || checkReasons.length > 0 || hasUnconfirmedChangeRequest;
  const visibleEditableFields = editableFields.filter((field) => {
    if (field === 'pickupTime') {
      return false;
    }

    if (order.fulfillmentType === '픽업') {
      return field !== 'address';
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
        <div className="detailHeaderTop">
          <div>
            <p className="eyebrow">{order.source}</p>
            <h2>
              <button
                type="button"
                className="detailTitleButton"
                aria-label="고객명 입력으로 이동"
                onClick={handleCustomerTitleClick}
              >
                {order.customerName || '고객명 미정'}
              </button>
            </h2>
            <p className="sectionHelp">추출된 값을 확인하고 수정합니다.</p>
          </div>
          <button type="button" className="iconButton detailCloseButton" aria-label="주문 상세 닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="detailHeaderControls">
          <label className="statusSelect">
            상태
            <select value={order.status} onChange={(event) => handleStatusChange(event.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`changeRequestButton ${hasUnconfirmedChangeRequest ? 'attention' : ''}`}
            aria-expanded={isChangeRequestOpen}
            onClick={() => setIsChangeRequestOpen((current) => !current)}
          >
            {order.changeRequestNote.trim() ? '추가/변경 요청 보기' : '+ 추가/변경 요청'}
            {hasUnconfirmedChangeRequest ? <span>반영 확인 필요</span> : null}
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
              <h3>추가/변경 요청 확인 필요</h3>
              <ul>
                <li>추가/변경 요청</li>
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {isChangeRequestOpen ? (
        <section className="changeRequestSection" aria-label="추가/변경 요청 편집">
          <div className="changeRequestIntro">
            <h3>추가/변경 요청</h3>
            <p>고객이 나중에 추가하거나 바꿔달라고 한 내용을 적어둡니다.</p>
          </div>
          <label className="fieldBlock spanAll">
            <span>요청 내용</span>
            <textarea
              aria-label="추가/변경 요청 내용"
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
            반영 확인
          </label>
        </section>
      ) : null}

      <div className="fieldGrid">
        {visibleEditableFields.map((field) => {
          const difference = differenceByField[field];
          const isTextarea = multilineFields.has(field);

          if (field === 'desiredDateTime') {
            return (
              <div key={field} className="fieldBlock">
                <span>
                  {FIELD_DEFINITIONS[field].label}
                  {difference ? <ReparseHint extractedValue={difference.extractedValue} /> : null}
                </span>
                <DesiredDateTimePicker
                  desiredDateTime={order.desiredDateTime}
                  pickupTime={order.pickupTime}
                  includeTime={order.fulfillmentType === '픽업'}
                  onApply={handleDesiredDateTimeApply}
                />
              </div>
            );
          }

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
                <input
                  ref={field === 'customerName' ? customerNameInputRef : undefined}
                  value={order[field]}
                  onChange={(event) => handleFieldChange(field, event.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>

      <section className="rawTextCopySection" aria-label="주문 원문 보관">
        <div className="rawTextDetailHeader">
          <h3>주문/문의 원문</h3>
          <button type="button" className="secondaryButton" aria-label="주문/문의 원문 복사" onClick={handleRawTextCopy}>
            {rawTextCopied ? '복사됨' : '복사'}
          </button>
        </div>
        <textarea value={order.rawText} rows={7} readOnly aria-label="주문/문의 원문" />
      </section>
      </div>
      </section>
    </div>
  );
}
