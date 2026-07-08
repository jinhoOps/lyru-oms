import { describe, expect, it } from 'vitest';
import { EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';
import { sortOrders, type OrderSortMode } from './orderSorting';

const order = (overrides: Partial<CapturedOrder>): CapturedOrder => ({
  ...EMPTY_ORDER_FIELDS,
  id: 'base',
  source: '카카오톡 채널',
  rawText: '성함: 김리루',
  status: '신규',
  menuMatches: [],
  quantityCandidates: [],
  parsedDate: null,
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: [],
  warningLevel: 'none',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const ids = (orders: CapturedOrder[]) => orders.map((item) => item.id);

describe('orderSorting', () => {
  it('sorts by desired date first and falls back to recent registration for unknown dates', () => {
    const orders = [
      order({ id: 'unknown-old', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'later', desiredDateTime: '2026-07-05' }),
      order({ id: 'earlier', desiredDateTime: '2026-07-03' }),
      order({ id: 'unknown-new', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'desiredDate'))).toEqual(['earlier', 'later', 'unknown-new', 'unknown-old']);
  });

  it('falls back to midnight when parsed desired date time text is invalid', () => {
    const orders = [
      order({ id: 'later', desiredDateTime: '2026-07-04' }),
      order({
        id: 'invalid-time-text',
        parsedDate: {
          isoDate: '2026-07-03',
          timeText: '오후 2시',
          originalText: '7월 3일 오후 2시',
          isRelative: false,
        },
      }),
      order({ id: 'earlier', desiredDateTime: '2026-07-02' }),
    ];

    expect(ids(sortOrders(orders, 'desiredDate'))).toEqual(['earlier', 'invalid-time-text', 'later']);
  });

  it('sorts by recent registration', () => {
    const orders = [
      order({ id: 'old', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'new', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'recent'))).toEqual(['new', 'old']);
  });

  it('sorts invalid created dates oldest in recent sorting', () => {
    const orders = [
      order({ id: 'invalid', createdAt: 'not-a-date' }),
      order({ id: 'old', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'new', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'recent'))).toEqual(['new', 'old', 'invalid']);
  });

  it('uses recent registration as a tie-breaker for the same desired date', () => {
    const orders = [
      order({ id: 'old', desiredDateTime: '2026-07-05', createdAt: '2026-07-01T00:00:00.000Z' }),
      order({ id: 'new', desiredDateTime: '2026-07-05', createdAt: '2026-07-02T00:00:00.000Z' }),
    ];

    expect(ids(sortOrders(orders, 'desiredDate'))).toEqual(['new', 'old']);
  });

  it('sorts by largest quantity using parsed candidates before quantity text', () => {
    const orders = [
      order({ id: 'text-12', quantity: '12세트' }),
      order({ id: 'parsed-40', quantity: '5세트', quantityCandidates: [{ value: 40, unit: '개', rawText: '40개' }] }),
      order({ id: 'unknown', quantity: '많이' }),
    ];

    expect(ids(sortOrders(orders, 'quantityDesc'))).toEqual(['parsed-40', 'text-12', 'unknown']);
  });

  it('does not mutate the input array', () => {
    const orders = [order({ id: 'b', desiredDateTime: '2026-07-05' }), order({ id: 'a', desiredDateTime: '2026-07-03' })];

    sortOrders(orders, 'desiredDate' satisfies OrderSortMode);

    expect(ids(orders)).toEqual(['b', 'a']);
  });
});
