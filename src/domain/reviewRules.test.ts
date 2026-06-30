import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';
import { evaluateOrder, mergeParsedFields } from './reviewRules';

function order(overrides: Partial<CapturedOrder>): CapturedOrder {
  return {
    id: 'order-1',
    source: '카카오톡 채널',
    rawText: '성함: 김리루',
    ...EMPTY_ORDER_FIELDS,
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
    expect(evaluated.missingFields).toContain('phone');
  });

  it('requires address only for 택배 and pickup time only for 픽업', () => {
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
    expect(pickup.missingFields).toContain('pickupTime');
    expect(pickup.missingFields).not.toContain('address');
  });

  it('does not revert 정리 완료 even when settings would flag it', () => {
    const evaluated = evaluateOrder(order({ status: '정리 완료', quantity: '10' }), DEFAULT_SETTINGS);
    expect(evaluated.status).toBe('정리 완료');
    expect(evaluated.reviewReasons.some((reason) => reason.message.includes('대량'))).toBe(true);
  });

  it('preserves existing duplicate review reasons while recalculating derived reasons', () => {
    const duplicateReason = { kind: '중복 가능성' as const, message: '비슷한 원문이 이미 있어요.' };

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
        DEFAULT_SETTINGS,
      );

      expect(evaluated.reviewReasons).toContainEqual({
        kind: '확인필요',
        field: 'quantity',
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
});
