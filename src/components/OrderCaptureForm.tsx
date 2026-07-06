import { type FormEvent, useMemo, useRef, useState } from 'react';
import {
  EMPTY_ORDER_FIELDS,
  type CapturedOrder,
  type OrderSettings,
  type OrderSource,
} from '../domain/orderTypes';
import { hasSimilarRawText, parseRawText } from '../domain/parser';
import { evaluateOrder } from '../domain/reviewRules';

interface OrderCaptureFormProps {
  existingRawTexts: string[];
  settings: OrderSettings;
  source: OrderSource;
  onSave: (order: CapturedOrder) => void | boolean | Promise<void | boolean>;
}

const createOrderId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function OrderCaptureForm({ existingRawTexts, settings, source, onSave }: OrderCaptureFormProps) {
  const [rawText, setRawText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const parsed = useMemo(() => parseRawText(rawText), [rawText]);
  const isDuplicate = rawText.trim() !== '' && hasSimilarRawText(rawText, existingRawTexts);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isSavingRef.current || !rawText.trim()) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    const now = new Date().toISOString();
    const baseOrder: CapturedOrder = {
      id: createOrderId(),
      source,
      rawText,
      ...EMPTY_ORDER_FIELDS,
      ...parsed,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: isDuplicate
        ? [
            {
              kind: '중복 가능성',
              group: 'check',
              code: 'duplicate-raw-text',
              label: '중복 가능성',
              message: '비슷한 원문이 이미 있어요.',
              detail: '저장된 주문/문의 원문과 비슷합니다.',
            },
          ]
        : [],
      warningLevel: 'none',
      status: '신규',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const saved = await onSave(evaluateOrder(baseOrder, settings));
      if (saved !== false) {
        setRawText('');
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <form className="captureForm" onSubmit={handleSubmit}>
      <label>
        주문/문의 원문
        <span className="inputHelp">네이버 스마트스토어 같은 경우는 API 개발하면 자동으로 주문목록 추가 가능해요.</span>
        <textarea
          aria-label="주문/문의 원문"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={8}
        />
      </label>
      {isDuplicate ? <p className="softWarning">비슷한 원문이 이미 있어요. 그래도 저장할 수 있습니다.</p> : null}
      <div className="previewGrid" aria-label="추출 결과 미리보기">
        <span>주문 내용: {parsed.orderItems || '-'}</span>
        <span>수량: {parsed.quantity || '-'}</span>
        <span>선물 용도: {parsed.purpose || '-'}</span>
        <span>수령 방식: {parsed.fulfillmentType || '-'}</span>
      </div>
      <button type="submit" disabled={isSaving || !rawText.trim()}>
        {isSaving ? '저장 중' : '저장'}
      </button>
    </form>
  );
}
