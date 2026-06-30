import { DEFAULT_SETTINGS, type CapturedOrder, type OrderSettings } from './orderTypes';

const ORDERS_STORAGE_KEY = 'lyru-oms.orders.v1';
const SETTINGS_STORAGE_KEY = 'lyru-oms.settings.v1';

const parseStoredJson = (value: string | null): unknown => {
  if (value === null) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const loadOrders = (): CapturedOrder[] => {
  const storedOrders = parseStoredJson(localStorage.getItem(ORDERS_STORAGE_KEY));

  return Array.isArray(storedOrders) ? (storedOrders as CapturedOrder[]) : [];
};

export const saveOrders = (orders: CapturedOrder[]): void => {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
};

export const loadSettings = (): OrderSettings => {
  const storedSettings = parseStoredJson(localStorage.getItem(SETTINGS_STORAGE_KEY));

  if (storedSettings === undefined || typeof storedSettings !== 'object' || Array.isArray(storedSettings)) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...(storedSettings as Partial<OrderSettings>),
  };
};

export const saveSettings = (settings: OrderSettings): void => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};
