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
