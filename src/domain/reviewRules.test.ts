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
    status: '신규',
    createdAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('evaluateOrder', () => {
  it('marks missing required fields and automatically sets 확인 필요', () => {
    const evaluated = evaluateOrder(order({ customerName: '김리루' }), DEFAULT_SETTINGS);
    expect(evaluated.status).toBe('확인 필요');
    expect(evaluated.warningLevel).toBe('attention');
    expect(evaluated.missingFields).toContain('orderItems');
  });

  it('requires address for delivery but does not require pickup time for pickup', () => {
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
    expect(delivery.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: '확인필요',
          group: 'check',
          code: 'delivery-check',
          label: '택배 가능 여부',
        }),
      ]),
    );

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

  it('does not revert 제작 준비 even when settings would flag it', () => {
    const evaluated = evaluateOrder(
      order({ status: '제작 준비', quantity: '10' }),
      { ...DEFAULT_SETTINGS, quantityRules: { ...DEFAULT_SETTINGS.quantityRules, bulkRealUnitThreshold: 5 } },
    );
    expect(evaluated.status).toBe('제작 준비');
    expect(evaluated.reviewReasons.some((reason) => reason.kind === '정보 부족')).toBe(true);
  });

  it('does not revert 제작 준비 when a check reason exists', () => {
    const evaluated = evaluateOrder(
      order({
        status: '제작 준비',
        customerName: '김리루',
        phone: '010',
        orderItems: '곶감밀푀유',
        quantity: '1세트',
        desiredDateTime: '7월 3일',
        fulfillmentType: '택배',
        address: '서울시 중구',
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'delivery-check',
        }),
      ]),
    );
    expect(evaluated.status).toBe('제작 준비');
  });

  it('preserves existing duplicate review reasons while recalculating derived reasons', () => {
    const duplicateReason = {
      kind: '중복 가능성' as const,
      message: '비슷한 원문이 이미 있어요.',
    } as CapturedOrder['reviewReasons'][number];

    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        reviewReasons: [duplicateReason],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toContainEqual({
      kind: '중복 가능성',
      group: 'check',
      code: 'duplicate-raw-text',
      label: '중복 가능성',
      message: '비슷한 원문이 이미 있어요.',
    });
    expect(evaluated.reviewReasons.some((reason) => reason.kind === '정보 부족')).toBe(true);
  });

  it('canonicalizes stored duplicate reasons with conflicting shape', () => {
    const duplicateReason = {
      kind: '확인필요',
      group: 'info',
      code: 'duplicate-raw-text',
      label: '이전 라벨',
      field: 'orderItems',
      detail: '저장된 상세',
      message: '이미 비슷한 원문이 있습니다.',
    } satisfies CapturedOrder['reviewReasons'][number];

    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        reviewReasons: [duplicateReason],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toContainEqual({
      kind: '중복 가능성',
      group: 'check',
      code: 'duplicate-raw-text',
      label: '중복 가능성',
      field: 'orderItems',
      detail: '저장된 상세',
      message: '이미 비슷한 원문이 있습니다.',
    });
  });

  it('preserves duplicate raw text reasons while regenerating missing field reasons', () => {
    const evaluated = evaluateOrder(
      order({
        orderItems: '',
        quantity: '',
        desiredDateTime: '2026-07-08',
        fulfillmentType: '픽업',
        reviewReasons: [
          {
            kind: '중복 가능성',
            group: 'check',
            code: 'duplicate-raw-text',
            label: '중복 가능성',
            message: '비슷한 원문이 이미 있습니다.',
          },
          {
            kind: '정보 부족',
            group: 'info',
            code: 'missing-field',
            field: 'address',
            label: '택배 주소',
            message: '택배 주소',
          },
        ],
      }),
      DEFAULT_SETTINGS,
    );

    const missingFieldReasons = evaluated.reviewReasons.filter((reason) => reason.code === 'missing-field');

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: '중복 가능성', code: 'duplicate-raw-text' }),
        expect.objectContaining({ kind: '정보 부족', group: 'info', field: 'orderItems' }),
        expect.objectContaining({ kind: '정보 부족', group: 'info', field: 'quantity' }),
      ]),
    );
    expect(missingFieldReasons.map((reason) => reason.field)).toEqual(['orderItems', 'quantity']);
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing-field', field: 'address' })]),
    );
    expect(evaluated.status).toBe('확인 필요');
  });

  it('flags real-unit bulk orders at 40구 or more', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '화과자 9구',
        quantity: '5세트',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'wagashi-9',
            label: '화과자 9구',
            unitCount: 9,
            confidence: 'exact',
          },
        ],
        quantityCandidates: [{ value: 5, unit: '세트', rawText: '5세트' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: '확인필요',
          group: 'check',
          code: 'bulk-real-unit',
          field: 'quantity',
          label: '대량 기준 가능성',
        }),
      ]),
    );
    expect(evaluated.status).toBe('확인 필요');
  });

  it('uses piece quantities as pure production quantity for bulk checks', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '화과자 9구',
        quantity: '5개',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'wagashi-9',
            label: '화과자 9구',
            unitCount: 9,
            confidence: 'exact',
          },
        ],
        quantityCandidates: [{ value: 5, unit: '개', rawText: '5개' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'bulk-real-unit',
        }),
      ]),
    );
  });

  it('flags bulk piece quantities even when menu unit count is unknown', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '맞춤 구성',
        quantity: '45개',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'custom',
            label: '맞춤 구성',
            unitCount: null,
            confidence: 'exact',
          },
        ],
        quantityCandidates: [{ value: 45, unit: '개', rawText: '45개' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: '확인필요',
          group: 'check',
          code: 'bulk-real-unit',
          field: 'quantity',
          label: '대량 기준 가능성',
          detail: '45개 = 45개',
        }),
      ]),
    );
    expect(evaluated.status).toBe('확인 필요');
  });

  it('flags minimum order rules for shared 2구 and 4구 products', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '화과자 2구',
        quantity: '3세트',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'wagashi-2',
            label: '화과자 2구',
            unitCount: 2,
            confidence: 'exact',
          },
        ],
        quantityCandidates: [{ value: 3, unit: '세트', rawText: '3세트' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: '확인필요',
          group: 'check',
          code: 'minimum-order',
          field: 'quantity',
          label: '최소 주문 조건 확인',
        }),
      ]),
    );
  });

  it('keeps quantity business rule reasons explicit', () => {
    const evaluated = evaluateOrder(
      order({
        orderItems: '화과자 4구',
        quantity: '1세트',
        desiredDateTime: '2026-07-08',
        fulfillmentType: '픽업',
        menuMatches: [{ menuId: 'hwagwaja-4', label: '화과자 4구', unitCount: 4, confidence: 'exact' }],
        quantityCandidates: [{ value: 1, unit: '세트', rawText: '1세트' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        {
          kind: '확인필요',
          group: 'check',
          code: 'minimum-order',
          field: 'quantity',
          label: '최소 주문 조건 확인',
          detail: '4구 상품은 최소 2세트 기준입니다. 현재 1세트입니다.',
          message: '최소 주문 조건을 확인해야 합니다.',
        },
      ]),
    );
  });

  it('groups ambiguous menu and quantity candidates as concise check items', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '대추야자',
        quantity: '3세트 5개',
        purpose: '답례품',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'dates-wood-9',
            label: '대추야자 오동나무 9구 세트',
            unitCount: 9,
            confidence: 'family',
          },
          {
            menuId: 'dates-basic-9',
            label: '대추야자 9구 세트',
            unitCount: 9,
            confidence: 'family',
          },
        ],
        quantityCandidates: [
          { value: 3, unit: '세트', rawText: '3세트' },
          { value: 5, unit: '개', rawText: '5개' },
        ],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group: 'check',
          code: 'event-purpose',
          label: '행사/답례품 주문',
        }),
        expect.objectContaining({
          group: 'check',
          code: 'ambiguous-menu',
          label: '비슷한 메뉴 여러 개',
        }),
        expect.objectContaining({
          group: 'check',
          code: 'ambiguous-quantity',
          label: '수량 예측 여러 개',
        }),
      ]),
    );
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'bulk-real-unit',
        }),
      ]),
    );
  });

  it('flags relative dates with the original expression in detail', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '곶감밀푀유',
        quantity: '1세트',
        desiredDateTime: '다음 주 금요일',
        fulfillmentType: '픽업',
        parsedDate: {
          isoDate: '2026-07-10',
          timeText: '',
          originalText: '다음 주 금요일',
          isRelative: true,
        },
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        {
          kind: '확인필요',
          group: 'check',
          code: 'relative-date',
          field: 'desiredDateTime',
          label: '날짜 확인 필요',
          detail: '원문 표현: 다음 주 금요일',
          message: '날짜 표현을 확인해야 합니다.',
        },
      ]),
    );
  });

  it('does not sum multiple quantity candidates for bulk checks', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '화과자 9구',
        quantity: '3세트 2세트',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'wagashi-9',
            label: '화과자 9구',
            unitCount: 9,
            confidence: 'exact',
          },
        ],
        quantityCandidates: [
          { value: 3, unit: '세트', rawText: '3세트' },
          { value: 2, unit: '세트', rawText: '2세트' },
        ],
      }),
      { ...DEFAULT_SETTINGS, quantityRules: { ...DEFAULT_SETTINGS.quantityRules, bulkRealUnitThreshold: 40 } },
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        {
          kind: '확인필요',
          group: 'check',
          code: 'ambiguous-quantity',
          field: 'quantity',
          label: '수량 예측 여러 개',
          message: '수량으로 볼 수 있는 표현이 여러 개라 확인이 필요합니다.',
        },
      ]),
    );
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'bulk-real-unit',
        }),
      ]),
    );
  });

  it('skips minimum and bulk checks when multiple menu matches include unknown units', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '화과자',
        quantity: '5세트',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'wagashi-9',
            label: '화과자 9구',
            unitCount: 9,
            confidence: 'family',
          },
          {
            menuId: 'wagashi-custom',
            label: '화과자 맞춤 구성',
            unitCount: null,
            confidence: 'family',
          },
        ],
        quantityCandidates: [{ value: 5, unit: '세트', rawText: '5세트' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ambiguous-menu',
          label: '비슷한 메뉴 여러 개',
        }),
      ]),
    );
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'bulk-real-unit',
        }),
      ]),
    );
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'minimum-order',
        }),
      ]),
    );
  });

  it('skips minimum checks when multiple menu matches share one known unit count', () => {
    const evaluated = evaluateOrder(
      order({
        customerName: '김리루',
        phone: '010',
        orderItems: '화과자 2구',
        quantity: '3세트',
        desiredDateTime: '7월 3일',
        fulfillmentType: '픽업',
        menuMatches: [
          {
            menuId: 'wagashi-2-a',
            label: '화과자 2구 기본',
            unitCount: 2,
            confidence: 'family',
          },
          {
            menuId: 'wagashi-2-b',
            label: '화과자 2구 보자기',
            unitCount: 2,
            confidence: 'family',
          },
        ],
        quantityCandidates: [{ value: 3, unit: '세트', rawText: '3세트' }],
      }),
      DEFAULT_SETTINGS,
    );

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ambiguous-menu',
          label: '비슷한 메뉴 여러 개',
        }),
      ]),
    );
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'minimum-order',
        }),
      ]),
    );
    expect(evaluated.reviewReasons).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'bulk-real-unit',
        }),
      ]),
    );
  });

  it('uses concise labels for missing required fields', () => {
    const evaluated = evaluateOrder(order({ customerName: '김리루' }), DEFAULT_SETTINGS);

    expect(evaluated.reviewReasons).toEqual(
      expect.arrayContaining([
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'orderItems',
          label: '주문 내용',
          message: '주문 내용',
        },
      ]),
    );
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
