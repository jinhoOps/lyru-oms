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
    saveSettings({ ...DEFAULT_SETTINGS, bulkQuantityThreshold: 7 });

    expect(loadOrders()).toEqual([order]);
    expect(loadSettings().bulkQuantityThreshold).toBe(7);
  });

  it('discards malformed order entries from stored arrays', () => {
    const validOrder: CapturedOrder = {
      ...EMPTY_ORDER_FIELDS,
      id: '1',
      source: '카카오톡 채널',
      rawText: '성함: 김리루',
      status: '수집',
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
        bulkQuantityThreshold: Number.NaN,
      }),
    );

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid settings fields while defaulting malformed fields independently', () => {
    localStorage.setItem(
      'lyru-oms.settings.v1',
      JSON.stringify({
        requiredFields: ['customerName', 'phone'],
        conditionalRequiredFields: {
          address: { field: 'fulfillmentType', equals: '택배' },
          pickupTime: { field: 'desiredDateTime', equals: '픽업' },
        },
        bulkQuantityThreshold: 12,
      }),
    );

    expect(loadSettings()).toEqual({
      requiredFields: ['customerName', 'phone'],
      conditionalRequiredFields: {
        address: { field: 'fulfillmentType', equals: '택배' },
        pickupTime: { field: 'fulfillmentType', equals: '픽업' },
      },
      bulkQuantityThreshold: 12,
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
