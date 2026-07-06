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
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
    const submittedRawText = rawText;
    const baseOrder: CapturedOrder = {
      id: createOrderId(),
      source,
      rawText: submittedRawText,
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
        setRawText((currentRawText) => (currentRawText === submittedRawText ? '' : currentRawText));
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
