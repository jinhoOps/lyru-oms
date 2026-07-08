import { parseExplicitDate } from './dateDisplay';
import type { CapturedOrder } from './orderTypes';

export type OrderSortMode = 'desiredDate' | 'recent' | 'quantityDesc';

const toTime = (isoDate: string) => {
  const time = new Date(isoDate).getTime();

  return Number.isFinite(time) ? time : null;
};

const getRecentTime = (order: CapturedOrder) => toTime(order.createdAt) ?? 0;

const getSafeTimeText = (timeText: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(timeText) ? timeText : '00:00');

const getDesiredDateTime = (order: CapturedOrder) => {
  const parsed = order.desiredDateTime.trim() ? parseExplicitDate(order.desiredDateTime) : order.parsedDate;

  if (!parsed || parsed.isRelative || !parsed.isoDate) {
    return null;
  }

  return toTime(`${parsed.isoDate}T${getSafeTimeText(parsed.timeText)}:00.000+09:00`);
};

export const getComparableQuantity = (order: CapturedOrder): number | null => {
  if (order.quantityCandidates.length > 0) {
    return Math.max(...order.quantityCandidates.map((candidate) => candidate.value));
  }

  const numericMatches = [...order.quantity.matchAll(/\d+/g)].map((match) => Number(match[0]));

  if (numericMatches.length === 0) {
    return null;
  }

  return Math.max(...numericMatches);
};

type SortKey = number | null;

const compareNullableKeys = (aKey: SortKey, bKey: SortKey, direction: 'asc' | 'desc') => {
  if (aKey !== null && bKey !== null && aKey !== bKey) {
    return direction === 'asc' ? aKey - bKey : bKey - aKey;
  }

  if (aKey !== null && bKey === null) {
    return -1;
  }

  if (aKey === null && bKey !== null) {
    return 1;
  }

  return 0;
};

const getSortKey = (order: CapturedOrder, mode: Exclude<OrderSortMode, 'recent'>) => {
  if (mode === 'quantityDesc') {
    return getComparableQuantity(order);
  }

  return getDesiredDateTime(order);
};

type KeyedOrder = {
  order: CapturedOrder;
  recentTime: number;
  key: SortKey;
};

const createKeyedOrder = (order: CapturedOrder, mode: OrderSortMode): KeyedOrder => ({
  order,
  recentTime: getRecentTime(order),
  key: mode === 'recent' ? null : getSortKey(order, mode),
});

const compareRecentTimes = (a: KeyedOrder, b: KeyedOrder) => b.recentTime - a.recentTime;

export const sortOrders = (orders: CapturedOrder[], mode: OrderSortMode): CapturedOrder[] => {
  const keyedOrders = orders.map((order) => createKeyedOrder(order, mode));

  if (mode === 'recent') {
    return keyedOrders.sort(compareRecentTimes).map((item) => item.order);
  }

  const direction = mode === 'quantityDesc' ? 'desc' : 'asc';

  keyedOrders.sort((a, b) => compareNullableKeys(a.key, b.key, direction) || compareRecentTimes(a, b));

  return keyedOrders.map((item) => item.order);
};
