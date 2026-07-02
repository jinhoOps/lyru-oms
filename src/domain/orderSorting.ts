import { parseExplicitDate } from './dateDisplay';
import type { CapturedOrder } from './orderTypes';

export type OrderSortMode = 'desiredDate' | 'recent' | 'quantityDesc';

const toTime = (isoDate: string) => {
  const time = new Date(isoDate).getTime();

  return Number.isFinite(time) ? time : 0;
};

const getDesiredDateTime = (order: CapturedOrder) => {
  const parsed = order.desiredDateTime.trim() ? parseExplicitDate(order.desiredDateTime) : order.parsedDate;

  if (!parsed || parsed.isRelative || !parsed.isoDate) {
    return null;
  }

  return toTime(`${parsed.isoDate}T${parsed.timeText || '00:00'}:00.000+09:00`);
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

const compareRecent = (a: CapturedOrder, b: CapturedOrder) => toTime(b.createdAt) - toTime(a.createdAt);

const compareDesiredDate = (a: CapturedOrder, b: CapturedOrder) => {
  const aDate = getDesiredDateTime(a);
  const bDate = getDesiredDateTime(b);

  if (aDate !== null && bDate !== null && aDate !== bDate) {
    return aDate - bDate;
  }

  if (aDate !== null && bDate === null) {
    return -1;
  }

  if (aDate === null && bDate !== null) {
    return 1;
  }

  return compareRecent(a, b);
};

const compareQuantityDesc = (a: CapturedOrder, b: CapturedOrder) => {
  const aQuantity = getComparableQuantity(a);
  const bQuantity = getComparableQuantity(b);

  if (aQuantity !== null && bQuantity !== null && aQuantity !== bQuantity) {
    return bQuantity - aQuantity;
  }

  if (aQuantity !== null && bQuantity === null) {
    return -1;
  }

  if (aQuantity === null && bQuantity !== null) {
    return 1;
  }

  return compareRecent(a, b);
};

export const sortOrders = (orders: CapturedOrder[], mode: OrderSortMode): CapturedOrder[] =>
  [...orders].sort((a, b) => {
    if (mode === 'recent') {
      return compareRecent(a, b);
    }

    if (mode === 'quantityDesc') {
      return compareQuantityDesc(a, b);
    }

    return compareDesiredDate(a, b);
  });
