import { describe, expect, it } from 'vitest';
import type { CapturedOrder } from './orderTypes';
import { EMPTY_ORDER_FIELDS } from './orderTypes';
import { getPureProductionQuantity } from './orderQuantity';

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

describe('getPureProductionQuantity', () => {
  it('multiplies one known menu unit count by one set quantity', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBe(12);
  });

  it('uses piece quantity directly when the quantity candidate unit is 개', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [{ value: 12, unit: '개', rawText: '12개' }],
        }),
      ),
    ).toBe(12);
  });

  it('returns null when menu is ambiguous', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [
            { menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'family' },
            { menuId: 'roll-4', label: '곶감말이 4구', unitCount: 4, confidence: 'family' },
          ],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBeNull();
  });

  it('returns null when quantity is ambiguous', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [
            { value: 6, unit: '세트', rawText: '6세트' },
            { value: 12, unit: '개', rawText: '12개' },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('returns null when quantity is missing', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'roll-2', label: '곶감말이 2구', unitCount: 2, confidence: 'exact' }],
          quantityCandidates: [],
        }),
      ),
    ).toBeNull();
  });

  it('returns null when set quantity has no menu match', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBeNull();
  });

  it('returns null when set quantity has no known menu unit count', () => {
    expect(
      getPureProductionQuantity(
        order({
          menuMatches: [{ menuId: 'custom', label: '맞춤 구성', unitCount: null, confidence: 'exact' }],
          quantityCandidates: [{ value: 6, unit: '세트', rawText: '6세트' }],
        }),
      ),
    ).toBeNull();
  });
});
