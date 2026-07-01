import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';
import { evaluateOrder, mergeParsedFields } from './reviewRules';

function order(overrides: Partial<CapturedOrder>): CapturedOrder {
  return {
    id: 'order-1',
    source: '카카오톡 채널',
    rawText: '성함: 김리루',
    ...EMPTY_ORDER_FIELDS,
    menuMatches: [],
    quantityCandidates: [],
    parsedDate: null,
    manuallyEditedFields: [],
    reparseDifferences: [],
    missingFields: [],
    reviewReasons: [],
    warningLevel: 'none',
    status: '수집',
    createdAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateOrder', () => {
  it('marks missing required fields and automatically sets 확인필요', () => {
    const evaluated = evaluateOrder(order({ customerName: '김리루' }), DEFAULT_SETTINGS);
    expect(evaluated.status).toBe('확인필요');
    expect(evaluated.warningLevel).toBe('attention');
    expect(evaluated.missingFields).toContain('orderItems');
  });

  it('requires address only for 택배', () => {
    const delivery = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '곶감밀푀유',
        quantity: '1',
        desiredDateTime: '7월 3일',
        fulfillmentType: '택배',
      }),
      DEFAULT_SETTINGS,
    );
    expect(delivery.missingFields).toContain('address');
    expect(delivery.missingFields).not.toContain('pickupTime');

    const pickup = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '곶감밀푀유',
        quantity: '1',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
      }),
      DEFAULT_SETTINGS,
    );
    expect(pickup.missingFields).not.toContain('pickupTime');
    expect(pickup.missingFields).not.toContain('address');
  });

  it('does not revert 정리 완료 even when settings would flag it', () => {
    const evaluated = evaluateOrder(
      order({ status: '정리 완료', quantity: '10' }),
      { ...DEFAULT_SETTINGS, quantityRules: { ...DEFAULT_SETTINGS.quantityRules, bulkRealUnitThreshold: 5 } },
    );
    expect(evaluated.status).toBe('정리 완료');
    expect(evaluated.reviewReasons.some((reason) => reason.message.includes('대량'))).toBe(true);
  });

  it('preserves existing duplicate review reasons while recalculating derived reasons', () => {
    const duplicateReason = {
      kind: '중복 가능성' as const,
      group: 'check' as const,
      code: 'duplicate-raw-text' as const,
      label: '중복 가능성',
      message: '비슷한 원문이 이미 있어요.',
    };

    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        reviewReasons: [duplicateReason],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toContainEqual(duplicateReason);
    expect(evaluated.reviewReasons.some((reason) => reason.kind === '정보 부족')).toBe(true);
  });

  it.each(['3개 + 3개', '2세트 3개씩', '5'])(
    'flags bulk orders when summed quantity reaches the threshold: %s',
    (quantity) => {
      const evaluated = evaluateOrder(
        order({
          customerName: '김리루',
          phone: '010',
          orderItems: '곶감밀푀유',
          quantity,
          desiredDateTime: '7월 3일',
          fulfillmentType: '픽업',
          pickupTime: '14:00',
        }),
        { ...DEFAULT_SETTINGS, quantityRules: { ...DEFAULT_SETTINGS.quantityRules, bulkRealUnitThreshold: 5 } },
      );

      expect(evaluated.reviewReasons).toContainEqual({
        kind: '확인필요',
        group: 'check',
        code: 'bulk-real-unit',
        field: 'quantity',
        label: '대량 주문',
        message: '대량 주문 수량이라 생산 가능 여부 확인이 필요합니다.',
      });
      expect(evaluated.status).toBe('확인필요');
    },
  );
});

describe('mergeParsedFields', () => {
  it('keeps manually edited fields and records neutral reparse differences', () => {
    const merged = mergeParsedFields(
      order({ phone: '010-9999-9999', manuallyEditedFields: ['phone'] }),
      { ...EMPTY_ORDER_FIELDS, phone: '010-1111-2222' },
    );

    expect(merged.phone).toBe('010-9999-9999');
    expect(merged.reparseDifferences).toEqual([{ field: 'phone', extractedValue: '010-1111-2222' }]);
  });

  it('updates parser metadata on reparse even when editable fields are protected', () => {
    const merged = mergeParsedFields(
      order({
        orderItems: '수동 입력 상품',
        manuallyEditedFields: ['orderItems'],
        menuMatches: [],
        quantityCandidates: [],
        parsedDate: null,
      }),
      {
        orderItems: '대추야자 9구',
        menuMatches: [
          {
            menuId: 'dates-wood-9',
            label: '대추야자 오동나무 9구 세트',
            unitCount: 9,
            confidence: 'family',
          },
        ],
        quantityCandidates: [{ value: 5, unit: '세트', rawText: '5세트' }],
        parsedDate: {
          isoDate: '2026-06-15',
          timeText: '14:00',
          originalText: '2026-06-15 14:00',
          isRelative: false,
        },
      } as Parameters<typeof mergeParsedFields>[1],
    );

    expect(merged.orderItems).toBe('수동 입력 상품');
    expect(merged.menuMatches.map((match) => match.menuId)).toEqual(['dates-wood-9']);
    expect(merged.quantityCandidates).toEqual([{ value: 5, unit: '세트', rawText: '5세트' }]);
    expect(merged.parsedDate).toEqual({
      isoDate: '2026-06-15',
      timeText: '14:00',
      originalText: '2026-06-15 14:00',
      isRelative: false,
    });
  });
});
