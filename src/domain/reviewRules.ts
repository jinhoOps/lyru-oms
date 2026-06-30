import {
  FIELD_DEFINITIONS,
  type CapturedOrder,
  type OrderFieldKey,
  type OrderSettings,
  type ReviewReason,
} from './orderTypes';

export type ParsedOrderFields = Partial<{
  [Field in OrderFieldKey]: CapturedOrder[Field];
}>;

const ORDER_FIELDS = Object.keys(FIELD_DEFINITIONS) as OrderFieldKey[];

const isBlank = (value: string) => value.trim() === '';

const parseQuantity = (quantity: string) => {
  const normalizedQuantity = quantity.replace(/,/g, '').trim();
  const matchedNumbers = normalizedQuantity.match(/\d+/g);

  return matchedNumbers?.reduce((sum, matchedNumber) => sum + Number(matchedNumber), 0) ?? 0;
};

const setOrderField = <Field extends OrderFieldKey>(
  order: CapturedOrder,
  field: Field,
  value: CapturedOrder[Field],
) => {
  order[field] = value;
};

export const evaluateOrder = (order: CapturedOrder, settings: OrderSettings): CapturedOrder => {
  const missingFields = new Set<OrderFieldKey>();

  for (const field of settings.requiredFields) {
    if (isBlank(order[field])) {
      missingFields.add(field);
    }
  }

  for (const field of ORDER_FIELDS) {
    const condition = settings.conditionalRequiredFields[field];

    if (!condition) {
      continue;
    }

    if (order[condition.field] === condition.equals && isBlank(order[field])) {
      missingFields.add(field);
    }
  }

  const reviewReasons: ReviewReason[] = [
    ...order.reviewReasons.filter((reason) => reason.kind === '중복 가능성'),
    ...[...missingFields].map((field) => ({
      kind: '정보 부족' as const,
      field,
      message: `${FIELD_DEFINITIONS[field].label} 정보가 비어 있어 확인이 필요합니다.`,
    })),
  ];

  if (parseQuantity(order.quantity) >= settings.bulkQuantityThreshold) {
    reviewReasons.push({
      kind: '확인필요',
      field: 'quantity',
      message: `대량 주문 수량이라 생산 가능 여부 확인이 필요합니다.`,
    });
  }

  const warningLevel = reviewReasons.length > 0 ? 'attention' : 'none';

  return {
    ...order,
    missingFields: [...missingFields],
    reviewReasons,
    warningLevel,
    status: order.status === '정리 완료' || warningLevel === 'none' ? order.status : '확인필요',
  };
};

export const mergeParsedFields = (order: CapturedOrder, parsed: ParsedOrderFields): CapturedOrder => {
  const merged: CapturedOrder = {
    ...order,
    reparseDifferences: [],
  };

  for (const field of ORDER_FIELDS) {
    const parsedValue = parsed[field];

    if (parsedValue === undefined || isBlank(parsedValue)) {
      continue;
    }

    if (order.manuallyEditedFields.includes(field)) {
      if (order[field] !== parsedValue) {
        merged.reparseDifferences.push({ field, extractedValue: parsedValue });
      }

      continue;
    }

    if (isBlank(order[field])) {
      setOrderField(merged, field, parsedValue);
    }
  }

  return merged;
};
