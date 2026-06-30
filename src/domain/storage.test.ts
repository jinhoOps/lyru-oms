import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './orderTypes';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadOrders()).toEqual([]);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips orders and settings', () => {
    saveOrders([{ id: '1', rawText: '성함: 김리루' } as never]);
    saveSettings({ ...DEFAULT_SETTINGS, bulkQuantityThreshold: 7 });

    expect(loadOrders()).toHaveLength(1);
    expect(loadSettings().bulkQuantityThreshold).toBe(7);
  });
});
