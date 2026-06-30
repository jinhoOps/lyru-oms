import {
  DEFAULT_SETTINGS,
  FIELD_DEFINITIONS,
  EMPTY_ORDER_FIELDS,
  ORDER_SOURCES,
  ORDER_STATUSES,
  type CapturedOrder,
  type ConditionalRequiredField,
  type OrderFieldKey,
  type OrderSettings,
} from './orderTypes';

const ORDERS_STORAGE_KEY = 'lyru-oms.orders.v1';
const SETTINGS_STORAGE_KEY = 'lyru-oms.settings.v1';

const ORDER_FIELD_KEYS = new Set<OrderFieldKey>(Object.keys(FIELD_DEFINITIONS) as OrderFieldKey[]);
const ORDER_SOURCE_VALUES = new Set<string>(ORDER_SOURCES);
const ORDER_STATUS_VALUES = new Set<string>(ORDER_STATUSES);
const FULFILLMENT_TYPE_VALUES = new Set<string>(['', '픽업', '택배']);
const REVIEW_REASON_KINDS = new Set<string>(['정보 부족', '확인필요', '중복 가능성']);
const WARNING_LEVELS = new Set<string>(['none', 'attention']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeGetItem = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
};

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

const cloneDefaultSettings = (): OrderSettings => ({
  requiredFields: [...DEFAULT_SETTINGS.requiredFields],
  conditionalRequiredFields: {
    address: { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
    pickupTime: { ...DEFAULT_SETTINGS.conditionalRequiredFields.pickupTime },
  },
  bulkQuantityThreshold: DEFAULT_SETTINGS.bulkQuantityThreshold,
});

const isOrderFieldKey = (value: unknown): value is OrderFieldKey =>
  typeof value === 'string' && ORDER_FIELD_KEYS.has(value as OrderFieldKey);

const isOrderFieldKeyArray = (value: unknown): value is OrderFieldKey[] =>
  Array.isArray(value) && value.every(isOrderFieldKey);

const hasRequiredStringOrderFields = (value: Record<string, unknown>): boolean =>
  Object.keys(EMPTY_ORDER_FIELDS).every((field) => typeof value[field] === 'string');

const isReparseDifferenceArray = (value: unknown): value is CapturedOrder['reparseDifferences'] =>
  Array.isArray(value) &&
  value.every(
    (difference) =>
      isPlainObject(difference) &&
      isOrderFieldKey(difference.field) &&
      typeof difference.extractedValue === 'string',
  );

const isReviewReasonArray = (value: unknown): value is CapturedOrder['reviewReasons'] =>
  Array.isArray(value) &&
  value.every(
    (reason) =>
      isPlainObject(reason) &&
      typeof reason.kind === 'string' &&
      REVIEW_REASON_KINDS.has(reason.kind) &&
      typeof reason.message === 'string' &&
      (reason.field === undefined || isOrderFieldKey(reason.field)),
  );

const isCapturedOrder = (value: unknown): value is CapturedOrder =>
  isPlainObject(value) &&
  typeof value.id === 'string' &&
  typeof value.rawText === 'string' &&
  hasRequiredStringOrderFields(value) &&
  FULFILLMENT_TYPE_VALUES.has(String(value.fulfillmentType)) &&
  ORDER_SOURCE_VALUES.has(String(value.source)) &&
  ORDER_STATUS_VALUES.has(String(value.status)) &&
  WARNING_LEVELS.has(String(value.warningLevel)) &&
  isOrderFieldKeyArray(value.manuallyEditedFields) &&
  isOrderFieldKeyArray(value.missingFields) &&
  isReparseDifferenceArray(value.reparseDifferences) &&
  isReviewReasonArray(value.reviewReasons) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const parseRequiredFields = (value: unknown): readonly OrderFieldKey[] =>
  Array.isArray(value) && value.every((field): field is OrderFieldKey => ORDER_FIELD_KEYS.has(field as OrderFieldKey))
    ? [...value]
    : [...DEFAULT_SETTINGS.requiredFields];

const isDefaultLikeConditionalField = (
  key: 'address' | 'pickupTime',
  value: unknown,
): value is ConditionalRequiredField =>
  isPlainObject(value) &&
  value.field === 'fulfillmentType' &&
  value.equals === DEFAULT_SETTINGS.conditionalRequiredFields[key].equals;

const parseConditionalRequiredFields = (
  value: unknown,
): OrderSettings['conditionalRequiredFields'] => {
  const storedFields = isPlainObject(value) ? value : {};

  return {
    address: isDefaultLikeConditionalField('address', storedFields.address)
      ? { field: storedFields.address.field, equals: storedFields.address.equals }
      : { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
    pickupTime: isDefaultLikeConditionalField('pickupTime', storedFields.pickupTime)
      ? { field: storedFields.pickupTime.field, equals: storedFields.pickupTime.equals }
      : { ...DEFAULT_SETTINGS.conditionalRequiredFields.pickupTime },
  };
};

const parseBulkQuantityThreshold = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SETTINGS.bulkQuantityThreshold;

export const loadOrders = (): CapturedOrder[] => {
  const storedOrders = parseStoredJson(safeGetItem(ORDERS_STORAGE_KEY));

  return Array.isArray(storedOrders) ? storedOrders.filter(isCapturedOrder) : [];
};

export const saveOrders = (orders: CapturedOrder[]): void => {
  safeSetItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
};

export const loadSettings = (): OrderSettings => {
  const storedSettings = parseStoredJson(safeGetItem(SETTINGS_STORAGE_KEY));

  if (!isPlainObject(storedSettings)) {
    return cloneDefaultSettings();
  }

  return {
    requiredFields: parseRequiredFields(storedSettings.requiredFields),
    conditionalRequiredFields: parseConditionalRequiredFields(storedSettings.conditionalRequiredFields),
    bulkQuantityThreshold: parseBulkQuantityThreshold(storedSettings.bulkQuantityThreshold),
  };
};

export const saveSettings = (settings: OrderSettings): void => {
  safeSetItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};
