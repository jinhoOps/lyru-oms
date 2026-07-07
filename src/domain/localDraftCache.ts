import { parseExplicitDate } from './dateDisplay';
import type { CapturedOrder, OrderSource, OrderStatus } from './orderTypes';

const ORDER_DRAFT_KEY = 'lyru-oms.orderDraft.v1';
const RECENT_ORDER_CACHE_KEY = 'lyru-oms.recentOrderCache.v1';
const DAY_MS = 86_400_000;
const RECENT_ORDER_LIMIT = 30;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DRAFT_FIELD_KEYS = [
  'customerName',
  'phone',
  'orderItems',
  'quantity',
  'purpose',
  'fulfillmentType',
  'desiredDateTime',
  'pickupTime',
  'address',
  'allergyNote',
  'options',
  'customerRequestNote',
  'ownerMemo',
  'changeRequestNote',
  'changeRequestConfirmed',
  'status',
] as const;

export type SavedOrderDraftFields = Pick<CapturedOrder, (typeof DRAFT_FIELD_KEYS)[number]>;

export interface SavedOrderDraft {
  savedAt: string;
  rawText: string;
  source: OrderSource;
  fields: SavedOrderDraftFields;
}

interface RecentOrderCachePayload {
  workspaceId: string;
  cachedAt: string;
  orders: CapturedOrder[];
}

export interface RecentOrderCacheSnapshot {
  workspaceId: string;
  cachedAt: string;
  orders: CapturedOrder[];
}

const readLocalStorage = (key: string) => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeLocalStorage = (key: string, value: string) => {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Blocked storage should not break the live workspace.
  }
};

const removeLocalStorage = (key: string) => {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Blocked storage should not break sign-out or recovery paths.
  }
};

const parseJson = (value: string | null): unknown => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toDateTime = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};

const getKoreaIsoDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
};

const toUtcDateOnlyTime = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);

  if (!year || !month || !day) {
    return Number.NaN;
  }

  return Date.UTC(year, month - 1, day);
};

const getDraftFields = (order: CapturedOrder): SavedOrderDraftFields => ({
  customerName: order.customerName,
  phone: order.phone,
  orderItems: order.orderItems,
  quantity: order.quantity,
  purpose: order.purpose,
  fulfillmentType: order.fulfillmentType,
  desiredDateTime: order.desiredDateTime,
  pickupTime: order.pickupTime,
  address: order.address,
  allergyNote: order.allergyNote,
  options: order.options,
  customerRequestNote: order.customerRequestNote,
  ownerMemo: order.ownerMemo,
  changeRequestNote: order.changeRequestNote,
  changeRequestConfirmed: order.changeRequestConfirmed,
  status: order.status,
});

const isDraftFields = (value: unknown): value is SavedOrderDraftFields => {
  if (!isRecord(value)) {
    return false;
  }

  return DRAFT_FIELD_KEYS.every((key) =>
    key === 'changeRequestConfirmed'
      ? typeof value[key] === 'boolean'
      : typeof value[key] === 'string',
  );
};

const isSavedOrderDraft = (value: unknown): value is SavedOrderDraft =>
  isRecord(value) &&
  typeof value.savedAt === 'string' &&
  typeof value.rawText === 'string' &&
  typeof value.source === 'string' &&
  isDraftFields(value.fields);

const isCapturedOrder = (value: unknown): value is CapturedOrder =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.rawText === 'string' &&
  typeof value.source === 'string' &&
  typeof value.updatedAt === 'string' &&
  typeof value.desiredDateTime === 'string';

const isRecentOrderCachePayload = (value: unknown): value is RecentOrderCachePayload =>
  isRecord(value) &&
  typeof value.workspaceId === 'string' &&
  typeof value.cachedAt === 'string' &&
  Array.isArray(value.orders);

const isInDesiredShippingWindow = (order: CapturedOrder, now: Date) => {
  const parsedDate = order.parsedDate ?? parseExplicitDate(order.desiredDateTime, now);

  if (!parsedDate || parsedDate.isRelative || !parsedDate.isoDate) {
    return false;
  }

  const todayTime = toUtcDateOnlyTime(getKoreaIsoDate(now));
  const orderDateTime = toUtcDateOnlyTime(parsedDate.isoDate);

  if (!Number.isFinite(todayTime) || !Number.isFinite(orderDateTime)) {
    return false;
  }

  const dayDifference = Math.round((orderDateTime - todayTime) / DAY_MS);
  return dayDifference >= -14 && dayDifference <= 45;
};

const sortByUpdatedDesc = (orders: CapturedOrder[]) =>
  [...orders].sort((left, right) => toDateTime(right.updatedAt) - toDateTime(left.updatedAt));

export const saveOrderDraft = (order: CapturedOrder): void => {
  writeLocalStorage(
    ORDER_DRAFT_KEY,
    JSON.stringify({
      savedAt: new Date().toISOString(),
      rawText: order.rawText,
      source: order.source,
      fields: getDraftFields(order),
    } satisfies SavedOrderDraft),
  );
};

export const loadSavedOrderDraft = (): SavedOrderDraft | null => {
  const parsed = parseJson(readLocalStorage(ORDER_DRAFT_KEY));

  return isSavedOrderDraft(parsed) ? parsed : null;
};

export const saveRecentOrderCache = (workspaceId: string, orders: CapturedOrder[], now = new Date()): void => {
  const selectedOrdersById = new Map<string, CapturedOrder>();

  for (const order of orders) {
    if (isInDesiredShippingWindow(order, now)) {
      selectedOrdersById.set(order.id, order);
    }
  }

  for (const order of sortByUpdatedDesc(orders).slice(0, RECENT_ORDER_LIMIT)) {
    selectedOrdersById.set(order.id, order);
  }

  const payload: RecentOrderCachePayload = {
    workspaceId,
    cachedAt: now.toISOString(),
    orders: sortByUpdatedDesc([...selectedOrdersById.values()]),
  };

  writeLocalStorage(RECENT_ORDER_CACHE_KEY, JSON.stringify(payload));
};

export const loadRecentOrderCacheSnapshot = (
  workspaceId: string,
  now = new Date(),
): RecentOrderCacheSnapshot | null => {
  const parsed = parseJson(readLocalStorage(RECENT_ORDER_CACHE_KEY));

  if (!isRecentOrderCachePayload(parsed)) {
    return null;
  }

  if (parsed.workspaceId !== workspaceId) {
    return null;
  }

  if (now.getTime() - toDateTime(parsed.cachedAt) > CACHE_TTL_MS) {
    return null;
  }

  return {
    workspaceId: parsed.workspaceId,
    cachedAt: parsed.cachedAt,
    orders: sortByUpdatedDesc(parsed.orders.filter(isCapturedOrder)),
  };
};

export const loadRecentOrderCache = (workspaceId: string, now = new Date()): CapturedOrder[] => {
  return loadRecentOrderCacheSnapshot(workspaceId, now)?.orders ?? [];
};

export const clearLocalOrderData = (): void => {
  removeLocalStorage(ORDER_DRAFT_KEY);
  removeLocalStorage(RECENT_ORDER_CACHE_KEY);
};

export const clearSavedOrderDraft = (): void => {
  removeLocalStorage(ORDER_DRAFT_KEY);
};

export const localDraftCacheKeys = {
  orderDraft: ORDER_DRAFT_KEY,
  recentOrderCache: RECENT_ORDER_CACHE_KEY,
} as const;
