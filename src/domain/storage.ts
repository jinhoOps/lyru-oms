import {
  DEFAULT_SETTINGS,
  FIELD_DEFINITIONS,
  EMPTY_ORDER_FIELDS,
  ORDER_SOURCES,
  ORDER_STATUSES,
  type CapturedOrder,
  type ConditionalRequiredField,
  type MenuMatch,
  type OrderFieldKey,
  type OrderSettings,
  type ParsedDateValue,
  type QuantityCandidate,
  type QuantityRules,
} from './orderTypes';

const ORDERS_STORAGE_KEY = 'lyru-oms.orders.v1';
const SETTINGS_STORAGE_KEY = 'lyru-oms.settings.v1';

const ORDER_FIELD_KEYS = new Set<OrderFieldKey>(Object.keys(FIELD_DEFINITIONS) as OrderFieldKey[]);
const ORDER_SOURCE_VALUES = new Set<string>(ORDER_SOURCES);
const ORDER_STATUS_VALUES = new Set<string>(ORDER_STATUSES);
const FULFILLMENT_TYPE_VALUES = new Set<string>(['', '픽업', '택배']);
const REVIEW_REASON_KINDS = new Set<string>(['정보 부족', '확인필요', '중복 가능성']);
const REVIEW_REASON_GROUPS = new Set<string>(['info', 'check']);
const REVIEW_REASON_CODES = new Set<string>([
  'missing-field',
  'duplicate-raw-text',
  'event-purpose',
  'ambiguous-menu',
  'ambiguous-quantity',
  'bulk-real-unit',
  'minimum-order',
  'delivery-check',
  'relative-date',
]);
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
  },
  quantityRules: {
    bulkRealUnitThreshold: DEFAULT_SETTINGS.quantityRules.bulkRealUnitThreshold,
    minimumOrderRules: DEFAULT_SETTINGS.quantityRules.minimumOrderRules.map((rule) => ({ ...rule })),
  },
});

const isOrderFieldKey = (value: unknown): value is OrderFieldKey =>
  typeof value === 'string' && ORDER_FIELD_KEYS.has(value as OrderFieldKey);

const isOrderFieldKeyArray = (value: unknown): value is OrderFieldKey[] =>
  Array.isArray(value) && value.every(isOrderFieldKey);

const hasValidStringOrderFields = (value: Record<string, unknown>): boolean =>
  Object.keys(EMPTY_ORDER_FIELDS).every((field) => value[field] === undefined || typeof value[field] === 'string');

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
      typeof reason.group === 'string' &&
      REVIEW_REASON_GROUPS.has(reason.group) &&
      typeof reason.code === 'string' &&
      REVIEW_REASON_CODES.has(reason.code) &&
      typeof reason.label === 'string' &&
      typeof reason.message === 'string' &&
      (reason.detail === undefined || typeof reason.detail === 'string') &&
      (reason.field === undefined || isOrderFieldKey(reason.field)),
  );

const hydrateReviewReasons = (value: unknown): CapturedOrder['reviewReasons'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  if (isReviewReasonArray(value)) {
    return value;
  }

  return value.flatMap((reason): CapturedOrder['reviewReasons'] => {
    if (
      !isPlainObject(reason) ||
      typeof reason.kind !== 'string' ||
      !REVIEW_REASON_KINDS.has(reason.kind) ||
      typeof reason.message !== 'string'
    ) {
      return [];
    }

    const field = isOrderFieldKey(reason.field) ? reason.field : undefined;
    const label = typeof reason.label === 'string' ? reason.label : field ? FIELD_DEFINITIONS[field].label : reason.kind;

    if (reason.kind === '정보 부족') {
      return [
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          ...(field ? { field } : {}),
          label,
          message: reason.message,
        },
      ];
    }

    if (reason.kind === '중복 가능성') {
      return [
        {
          kind: '중복 가능성',
          group: 'check',
          code: 'duplicate-raw-text',
          ...(field ? { field } : {}),
          label,
          message: reason.message,
        },
      ];
    }

    return [
      {
        kind: '확인필요',
        group: 'check',
        code: 'event-purpose',
        ...(field ? { field } : {}),
        label,
        message: reason.message,
      },
    ];
  });
};

const isMenuMatchArray = (value: unknown): value is MenuMatch[] =>
  Array.isArray(value) &&
  value.every(
    (match) =>
      isPlainObject(match) &&
      typeof match.menuId === 'string' &&
      typeof match.label === 'string' &&
      (typeof match.unitCount === 'number' || match.unitCount === null) &&
      ['exact', 'alias', 'family'].includes(String(match.confidence)),
  );

const isQuantityCandidateArray = (value: unknown): value is QuantityCandidate[] =>
  Array.isArray(value) &&
  value.every(
    (candidate) =>
      isPlainObject(candidate) &&
      typeof candidate.value === 'number' &&
      Number.isFinite(candidate.value) &&
      ['개', '세트'].includes(String(candidate.unit)) &&
      typeof candidate.rawText === 'string',
  );

const isParsedDateValue = (value: unknown): value is ParsedDateValue | null =>
  value === null ||
  (isPlainObject(value) &&
    typeof value.isoDate === 'string' &&
    typeof value.timeText === 'string' &&
    typeof value.originalText === 'string' &&
    typeof value.isRelative === 'boolean');

const isStoredOrderBase = (value: unknown): value is CapturedOrder =>
  isPlainObject(value) &&
  typeof value.id === 'string' &&
  typeof value.rawText === 'string' &&
  hasValidStringOrderFields(value) &&
  (value.fulfillmentType === undefined || FULFILLMENT_TYPE_VALUES.has(String(value.fulfillmentType))) &&
  ORDER_SOURCE_VALUES.has(String(value.source)) &&
  ORDER_STATUS_VALUES.has(String(value.status)) &&
  WARNING_LEVELS.has(String(value.warningLevel)) &&
  isOrderFieldKeyArray(value.manuallyEditedFields) &&
  isOrderFieldKeyArray(value.missingFields) &&
  isReparseDifferenceArray(value.reparseDifferences) &&
  Array.isArray(value.reviewReasons) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const hydrateStoredOrder = (value: CapturedOrder): CapturedOrder => {
  const storedValue = value as unknown as Record<string, unknown>;

  return {
    ...EMPTY_ORDER_FIELDS,
    ...value,
    menuMatches: isMenuMatchArray(storedValue.menuMatches) ? (storedValue.menuMatches as MenuMatch[]) : [],
    quantityCandidates: isQuantityCandidateArray(storedValue.quantityCandidates)
      ? (storedValue.quantityCandidates as QuantityCandidate[])
      : [],
    parsedDate: isParsedDateValue(storedValue.parsedDate) ? (storedValue.parsedDate as ParsedDateValue | null) : null,
    reviewReasons: hydrateReviewReasons(storedValue.reviewReasons),
  };
};

const parseRequiredFields = (value: unknown): readonly OrderFieldKey[] =>
  Array.isArray(value) && value.every((field): field is OrderFieldKey => ORDER_FIELD_KEYS.has(field as OrderFieldKey))
    ? [...value]
    : [...DEFAULT_SETTINGS.requiredFields];

const isDefaultLikeConditionalField = (
  value: unknown,
): value is ConditionalRequiredField =>
  isPlainObject(value) &&
  value.field === 'fulfillmentType' &&
  value.equals === DEFAULT_SETTINGS.conditionalRequiredFields.address.equals;

const parseConditionalRequiredFields = (
  value: unknown,
): OrderSettings['conditionalRequiredFields'] => {
  const storedFields = isPlainObject(value) ? value : {};

  return {
    address: isDefaultLikeConditionalField(storedFields.address)
      ? { field: storedFields.address.field, equals: storedFields.address.equals }
      : { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
  };
};

const parseQuantityRules = (value: unknown): QuantityRules => {
  const fallback = cloneDefaultSettings().quantityRules;

  if (!isPlainObject(value)) {
    return fallback;
  }

  const bulkRealUnitThreshold =
    typeof value.bulkRealUnitThreshold === 'number' &&
    Number.isFinite(value.bulkRealUnitThreshold) &&
    value.bulkRealUnitThreshold > 0
      ? Math.floor(value.bulkRealUnitThreshold)
      : fallback.bulkRealUnitThreshold;

  const minimumOrderRules =
    Array.isArray(value.minimumOrderRules) &&
    value.minimumOrderRules.every(
      (rule) =>
        isPlainObject(rule) &&
        typeof rule.unitCount === 'number' &&
        typeof rule.minimumSets === 'number' &&
        Number.isFinite(rule.unitCount) &&
        Number.isFinite(rule.minimumSets) &&
        rule.unitCount > 0 &&
        rule.minimumSets > 0,
    )
      ? value.minimumOrderRules.map((rule) => ({
          unitCount: Math.floor(Number(rule.unitCount)),
          minimumSets: Math.floor(Number(rule.minimumSets)),
        }))
      : fallback.minimumOrderRules;

  return { bulkRealUnitThreshold, minimumOrderRules };
};

export const loadOrders = (): CapturedOrder[] => {
  const storedOrders = parseStoredJson(safeGetItem(ORDERS_STORAGE_KEY));

  return Array.isArray(storedOrders) ? storedOrders.filter(isStoredOrderBase).map(hydrateStoredOrder) : [];
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
    quantityRules: parseQuantityRules(storedSettings.quantityRules),
  };
};

export const saveSettings = (settings: OrderSettings): void => {
  safeSetItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};
