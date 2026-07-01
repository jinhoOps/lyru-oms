import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, EMPTY_ORDER_FIELDS, type CapturedOrder } from './orderTypes';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadOrders()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips orders and settings', () => {
    const order: CapturedOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: '1',
      source: '카카오톡 채널',
      rawText: '성함: 김리루',
      status: '수집',
      menuMatches: [],
      quantityCandidates: [],
      parsedDate: null,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: [],
      warningLevel: 'none',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };

    saveOrders([
      order,
    ]);
    const settings = {
      ...DEFAULT_SETTINGS,
      quantityRules: {
        bulkRealUnitThreshold: 48,
        minimumOrderRules: [
          { unitCount: 2, minimumSets: 6 },
          { unitCount: 4, minimumSets: 3 },
        ],
      },
    };

    saveSettings(settings);

    expect(loadOrders()).toEqual([order]);
    expect(loadSettings()).toEqual(settings);
  });

  it('hydrates legacy orders with new parser metadata defaults', () => {
    const legacyOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: 'legacy',
      source: '카카오톡 채널',
      rawText: '대추야자 9구 5세트',
      status: '수집',
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: [],
      warningLevel: 'none',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };

    localStorage.setItem('lyru-oms.orders.v1', JSON.stringify([legacyOrder]));

    expect(loadOrders()).toEqual([
      {
        ...legacyOrder,
        menuMatches: [],
        quantityCandidates: [],
        parsedDate: null,
      },
    ]);
  });

  it('loads stored orders with new-shape review reasons', () => {
    const order: CapturedOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: 'review-reason',
      source: '카카오톡 채널',
      rawText: '배송 요청 확인 필요',
      status: '확인필요',
      menuMatches: [],
      quantityCandidates: [],
      parsedDate: null,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: [
        {
          kind: '확인필요',
          group: 'check',
          code: 'delivery-check',
          field: 'address',
          label: '배송 확인',
          detail: '주소 확인 필요',
          message: '배송 정보 확인이 필요합니다.',
        },
      ],
      warningLevel: 'attention',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };

    localStorage.setItem('lyru-oms.orders.v1', JSON.stringify([order]));

    expect(loadOrders()).toEqual([order]);
  });

  it('discards stored orders with malformed review reason metadata', () => {
    const malformedOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: 'malformed-review-reason',
      source: '카카오톡 채널',
      rawText: '연락처 없음',
      status: '확인필요',
      menuMatches: [],
      quantityCandidates: [],
      parsedDate: null,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: ['phone'],
      reviewReasons: [
        {
          kind: '정보 부족',
          field: 'phone',
          message: '연락처 정보가 비어 있어요.',
        },
      ],
      warningLevel: 'attention',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };

    localStorage.setItem('lyru-oms.orders.v1', JSON.stringify([malformedOrder]));

    expect(loadOrders()).toEqual([]);
  });

  it('discards malformed order entries from stored arrays', () => {
    const validOrder: CapturedOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: '1',
      source: '카카오톡 채널',
      rawText: '성함: 김리루',
      status: '수집',
      menuMatches: [],
      quantityCandidates: [],
      parsedDate: null,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: [],
      warningLevel: 'none',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };
    const partialOrder = {
      id: '2',
      source: '카카오톡 채널',
      rawText: '성함: 박리루',
      status: '수집',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };

    localStorage.setItem(
      'lyru-oms.orders.v1',
      JSON.stringify([
        validOrder,
        null,
        [],
        'not an order',
        { ...validOrder, id: 1 },
        { ...validOrder, source: '문자' },
        { ...validOrder, status: '배송완료' },
        { ...validOrder, createdAt: null },
        partialOrder,
      ]),
    );

    expect(loadOrders()).toEqual([validOrder]);
  });

  it('discards stored orders with invalid fulfillment type while keeping valid values', () => {
    const baseOrder: CapturedOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: '1',
      source: '카카오톡 채널',
      rawText: '성함: 김리루',
      status: '수집',
      menuMatches: [],
      quantityCandidates: [],
      parsedDate: null,
      manuallyEditedFields: [],
      reparseDifferences: [],
      missingFields: [],
      reviewReasons: [],
      warningLevel: 'none',
      createdAt: '2026-06-30T09:00:00.000Z',
      updatedAt: '2026-06-30T09:00:00.000Z',
    };
    const emptyFulfillmentOrder = { ...baseOrder, id: 'empty', fulfillmentType: '' };
    const pickupOrder = { ...baseOrder, id: 'pickup', fulfillmentType: '픽업' };
    const deliveryOrder = { ...baseOrder, id: 'delivery', fulfillmentType: '택배' };

    localStorage.setItem(
      'lyru-oms.orders.v1',
      JSON.stringify([
        emptyFulfillmentOrder,
        pickupOrder,
        deliveryOrder,
        { ...baseOrder, id: 'visit', fulfillmentType: '방문' },
        { ...baseOrder, id: 'invalid', fulfillmentType: 'invalid' },
      ]),
    );

    expect(loadOrders()).toEqual([emptyFulfillmentOrder, pickupOrder, deliveryOrder]);
  });

  it('falls back per malformed settings field', () => {
    localStorage.setItem(
      'lyru-oms.settings.v1',
      JSON.stringify({
        requiredFields: ['customerName', 'unknownField'],
        conditionalRequiredFields: {
          address: { field: 'fulfillmentType', equals: '방문' },
          pickupTime: { field: 'desiredDateTime', equals: '픽업' },
          phone: { field: 'fulfillmentType', equals: '픽업' },
        },
        quantityRules: {
          bulkRealUnitThreshold: Number.NaN,
          minimumOrderRules: [{ unitCount: 0, minimumSets: 2 }],
        },
      }),
    );

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('hydrates legacy bulk threshold settings into real-unit quantity rules', () => {
    localStorage.setItem(
      'lyru-oms.settings.v1',
      JSON.stringify({
        requiredFields: ['orderItems', 'quantity'],
        conditionalRequiredFields: {
          address: { field: 'fulfillmentType', equals: '택배' },
        },
        bulkQuantityThreshold: 7,
      }),
    );

    expect(loadSettings()).toEqual({
      requiredFields: ['orderItems', 'quantity'],
      conditionalRequiredFields: {
        address: { field: 'fulfillmentType', equals: '택배' },
      },
      quantityRules: DEFAULT_SETTINGS.quantityRules,
    });
  });

  it('keeps valid settings fields while defaulting malformed fields independently', () => {
    localStorage.setItem(
      'lyru-oms.settings.v1',
      JSON.stringify({
        requiredFields: ['customerName', 'phone'],
        conditionalRequiredFields: {
          address: { field: 'fulfillmentType', equals: '택배' },
        },
        quantityRules: {
          bulkRealUnitThreshold: 64.8,
          minimumOrderRules: [
            { unitCount: 2.9, minimumSets: 5.8 },
            { unitCount: 4, minimumSets: 2 },
          ],
        },
      }),
    );

    expect(loadSettings()).toEqual({
      requiredFields: ['customerName', 'phone'],
      conditionalRequiredFields: {
        address: { field: 'fulfillmentType', equals: '택배' },
      },
      quantityRules: {
        bulkRealUnitThreshold: 64,
        minimumOrderRules: [
          { unitCount: 2, minimumSets: 5 },
          { unitCount: 4, minimumSets: 2 },
        ],
      },
    });
  });

  it('falls back to default quantity rules for non-finite minimum order values', () => {
    localStorage.setItem(
      'lyru-oms.settings.v1',
      `{
        "requiredFields": ["orderItems", "quantity"],
        "conditionalRequiredFields": {
          "address": { "field": "fulfillmentType", "equals": "택배" }
        },
        "quantityRules": {
          "bulkRealUnitThreshold": 64,
          "minimumOrderRules": [
            { "unitCount": 1e999, "minimumSets": 2 }
          ]
        }
      }`,
    );

    expect(loadSettings()).toEqual({
      requiredFields: ['orderItems', 'quantity'],
      conditionalRequiredFields: {
        address: { field: 'fulfillmentType', equals: '택배' },
      },
      quantityRules: {
        bulkRealUnitThreshold: 64,
        minimumOrderRules: DEFAULT_SETTINGS.quantityRules.minimumOrderRules,
      },
    });
  });

  it('returns fresh default settings objects', () => {
    const settings = loadSettings();

    (settings.requiredFields as string[]).push('ownerMemo');
    settings.conditionalRequiredFields.address = { field: 'fulfillmentType', equals: '픽업' };

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults and does not throw when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(loadOrders()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveOrders([])).not.toThrow();
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});
