import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';
import {
  clearLocalOrderData,
  loadRecentOrderCache,
  loadSavedOrderDraft,
  saveOrderDraft,
  saveRecentOrderCache,
} from './localDraftCache';

const createOrder = (overrides: Partial<CapturedOrder> = {}): CapturedOrder => ({
  id: 'order-1',
  source: '카카오톡 채널',
  rawText: '성함: 테스트고객\n곶감 1세트\n2026-07-06\n픽업',
  ...EMPTY_ORDER_FIELDS,
  customerName: '테스트고객',
  orderItems: '곶감',
  quantity: '1세트',
  fulfillmentType: '픽업',
  desiredDateTime: '2026-07-06',
  menuMatches: [{ menuId: 'menu-1', label: '곶감', unitCount: 4, confidence: 'exact' }],
  quantityCandidates: [{ value: 1, unit: '세트', rawText: '1세트' }],
  parsedDate: null,
  manuallyEditedFields: ['customerName'],
  reparseDifferences: [{ field: 'quantity', extractedValue: '2세트' }],
  missingFields: ['phone'],
  reviewReasons: [
    {
      kind: '정보 부족',
      group: 'info',
      code: 'missing-field',
      field: 'phone',
      label: '연락처',
      message: '연락처가 비어 있어요.',
    },
  ],
  warningLevel: 'attention',
  status: '확인 필요',
  createdAt: '2026-07-06T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
  ...overrides,
});

describe('localDraftCache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('saves and loads a minimal order draft without review-only payloads', () => {
    saveOrderDraft(createOrder({ customerName: '임시고객', ownerMemo: '포장 확인' }));

    expect(loadSavedOrderDraft()).toEqual({
      savedAt: '2026-07-06T12:00:00.000Z',
      rawText: '성함: 테스트고객\n곶감 1세트\n2026-07-06\n픽업',
      source: '카카오톡 채널',
      fields: expect.objectContaining({
        customerName: '임시고객',
        ownerMemo: '포장 확인',
        status: '확인 필요',
      }),
    });

    const stored = JSON.parse(localStorage.getItem('lyru-oms.orderDraft.v1') ?? '{}');
    expect(stored).not.toHaveProperty('order');
    expect(stored).not.toHaveProperty('reviewReasons');
    expect(stored).not.toHaveProperty('menuMatches');
    expect(stored.fields).not.toHaveProperty('reviewReasons');
    expect(stored.fields).not.toHaveProperty('menuMatches');
  });

  it('caches date-window orders plus the 30 most recently updated orders and sorts by updatedAt desc', () => {
    const orders = [
      createOrder({
        id: 'date-window-old',
        desiredDateTime: '2026-06-22',
        updatedAt: '2026-06-20T00:00:00.000Z',
      }),
      createOrder({
        id: 'date-window-future',
        desiredDateTime: '2026-08-20',
        updatedAt: '2026-06-19T00:00:00.000Z',
      }),
      createOrder({
        id: 'outside-window',
        desiredDateTime: '2026-08-21',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      createOrder({
        id: 'undated-recent',
        desiredDateTime: '',
        updatedAt: '2026-07-07T00:00:00.000Z',
      }),
      createOrder({
        id: 'undated-old',
        desiredDateTime: '',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
      ...Array.from({ length: 30 }, (_, index) =>
        createOrder({
          id: `recent-${index}`,
          desiredDateTime: '2026-12-31',
          updatedAt: `2026-07-${String(6 - Math.floor(index / 24)).padStart(2, '0')}T${String(23 - (index % 24)).padStart(
            2,
            '0',
          )}:00:00.000Z`,
        }),
      ),
    ];

    saveRecentOrderCache('workspace-1', orders);

    const cachedOrders = loadRecentOrderCache('workspace-1');
    expect(cachedOrders.map((order) => order.id)).toEqual([
      'undated-recent',
      'recent-0',
      'recent-1',
      'recent-2',
      'recent-3',
      'recent-4',
      'recent-5',
      'recent-6',
      'recent-7',
      'recent-8',
      'recent-9',
      'recent-10',
      'recent-11',
      'recent-12',
      'recent-13',
      'recent-14',
      'recent-15',
      'recent-16',
      'recent-17',
      'recent-18',
      'recent-19',
      'recent-20',
      'recent-21',
      'recent-22',
      'recent-23',
      'recent-24',
      'recent-25',
      'recent-26',
      'recent-27',
      'recent-28',
      'date-window-old',
      'date-window-future',
    ]);
    expect(cachedOrders).toHaveLength(32);
    expect(cachedOrders.find((order) => order.id === 'outside-window')).toBeUndefined();
    expect(cachedOrders.find((order) => order.id === 'undated-old')).toBeUndefined();

    const stored = JSON.parse(localStorage.getItem('lyru-oms.recentOrderCache.v1') ?? '{}');
    expect(stored.workspaceId).toBe('workspace-1');
    expect(stored.cachedAt).toBe('2026-07-06T12:00:00.000Z');
    expect(stored.orders).toHaveLength(32);
  });

  it('returns an empty cache after the 24 hour TTL expires', () => {
    saveRecentOrderCache('workspace-1', [createOrder()]);

    vi.setSystemTime(new Date('2026-07-07T12:00:00.001Z'));

    expect(loadRecentOrderCache('workspace-1')).toEqual([]);
  });

  it('returns an empty cache when the stored workspace does not match', () => {
    saveRecentOrderCache('workspace-1', [createOrder()]);

    expect(loadRecentOrderCache('workspace-2')).toEqual([]);
  });

  it('clears both draft and recent-order cache', () => {
    saveOrderDraft(createOrder());
    saveRecentOrderCache('workspace-1', [createOrder()]);

    clearLocalOrderData();

    expect(loadSavedOrderDraft()).toBeNull();
    expect(loadRecentOrderCache('workspace-1')).toEqual([]);
  });

  it('does not throw when localStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked get');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked set');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked remove');
    });

    expect(() => saveOrderDraft(createOrder())).not.toThrow();
    expect(() => saveRecentOrderCache('workspace-1', [createOrder()])).not.toThrow();
    expect(loadSavedOrderDraft()).toBeNull();
    expect(loadRecentOrderCache('workspace-1')).toEqual([]);
    expect(() => clearLocalOrderData()).not.toThrow();
  });
});
