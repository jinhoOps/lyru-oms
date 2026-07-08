import { partition } from 'es-toolkit';

import { getPureProductionQuantity } from './orderQuantity';
import {
  FIELD_DEFINITIONS,
  type CapturedOrder,
  type OrderFieldKey,
  type OrderSettings,
  type ReviewReasonCode,
  type ReviewReason,
} from './orderTypes';

export type ParsedOrderFields = Partial<{
  [Field in OrderFieldKey]: CapturedOrder[Field];
} & Pick<CapturedOrder, 'menuMatches' | 'quantityCandidates' | 'parsedDate'>>;

const ORDER_FIELDS = Object.keys(FIELD_DEFINITIONS) as OrderFieldKey[];
const EVENT_PURPOSES = new Set(['상견례/인사', '답례품', '기념일/행사', '감사 선물', '단체/기업']);

const isBlank = (value: string) => value.trim() === '';

const setOrderField = <Field extends OrderFieldKey>(
  order: CapturedOrder,
  field: Field,
  value: CapturedOrder[Field],
) => {
  order[field] = value;
};

const reason = (
  code: ReviewReasonCode,
  label: string,
  message: string,
  options: Pick<ReviewReason, 'kind' | 'group'> & Partial<Pick<ReviewReason, 'field' | 'detail'>>,
): ReviewReason => ({
  code,
  label,
  message,
  ...options,
});

const createMissingFieldReason = (field: OrderFieldKey): ReviewReason =>
  reason('missing-field', FIELD_DEFINITIONS[field].label, FIELD_DEFINITIONS[field].label, {
    kind: '정보 부족',
    group: 'info',
    field,
  });

const hydrateDuplicateReason = (existingReason: ReviewReason): ReviewReason => ({
  kind: '중복 가능성',
  group: 'check',
  code: 'duplicate-raw-text',
  label: '중복 가능성',
  message: existingReason.message,
  ...(existingReason.field ? { field: existingReason.field } : {}),
  ...(existingReason.detail ? { detail: existingReason.detail } : {}),
});

const checkReason = (
  code: Exclude<ReviewReasonCode, 'missing-field' | 'duplicate-raw-text'>,
  label: string,
  message: string,
  options: Partial<Pick<ReviewReason, 'field' | 'detail'>> = {},
): ReviewReason =>
  reason(code, label, message, {
    kind: '확인필요',
    group: 'check',
    ...options,
  });

const getSingleKnownUnitCount = (order: CapturedOrder) => {
  if (order.menuMatches.length !== 1) {
    return null;
  }

  return order.menuMatches[0].unitCount;
};

const createQuantityReviewReasons = (order: CapturedOrder, settings: OrderSettings): ReviewReason[] => {
  const unitCount = getSingleKnownUnitCount(order);
  const reviewReasons: ReviewReason[] = [];

  if (unitCount !== null && order.quantityCandidates.length === 1 && order.quantityCandidates[0].unit === '세트') {
    const [quantityCandidate] = order.quantityCandidates;
    const matchingMinimumRule = settings.quantityRules.minimumOrderRules.find((rule) => rule.unitCount === unitCount);

    if (matchingMinimumRule && quantityCandidate.value < matchingMinimumRule.minimumSets) {
      reviewReasons.push(
        checkReason(
          'minimum-order',
          '최소 주문 조건 확인',
          '최소 주문 조건을 확인해야 합니다.',
          {
            field: 'quantity',
            detail: `${unitCount}구 상품은 최소 ${matchingMinimumRule.minimumSets}세트 기준입니다. 현재 ${quantityCandidate.rawText}입니다.`,
          },
        ),
      );
    }
  }

  const realUnitCount = getPureProductionQuantity(order);

  if (realUnitCount !== null && realUnitCount >= settings.quantityRules.bulkRealUnitThreshold) {
    const [quantityCandidate] = order.quantityCandidates;
    const detail =
      unitCount === null || quantityCandidate.unit === '개'
        ? `${quantityCandidate.rawText} = ${realUnitCount}개`
        : `${unitCount}구 x ${quantityCandidate.rawText} = ${realUnitCount}구`;

    reviewReasons.push(
      checkReason('bulk-real-unit', '대량 기준 가능성', '대량 기준에 해당할 수 있어 확인이 필요합니다.', {
        field: 'quantity',
        detail,
      }),
    );
  }

  return reviewReasons;
};

const createCheckReasons = (order: CapturedOrder, settings: OrderSettings): ReviewReason[] => {
  const reviewReasons: ReviewReason[] = [];

  if (EVENT_PURPOSES.has(order.purpose)) {
    reviewReasons.push(
      checkReason('event-purpose', '행사/답례품 주문', '행사나 답례품 용도라 요청사항 확인이 필요합니다.', {
        field: 'purpose',
      }),
    );
  }

  if (order.menuMatches.length > 1) {
    reviewReasons.push(
      checkReason('ambiguous-menu', '비슷한 메뉴 여러 개', '비슷한 메뉴가 여러 개라 확인이 필요합니다.', {
        field: 'orderItems',
      }),
    );
  }

  if (order.quantityCandidates.length > 1) {
    reviewReasons.push(
      checkReason(
        'ambiguous-quantity',
        '수량 예측 여러 개',
        '수량으로 볼 수 있는 표현이 여러 개라 확인이 필요합니다.',
        {
          field: 'quantity',
        },
      ),
    );
  }

  if (order.fulfillmentType === '택배') {
    reviewReasons.push(
      checkReason('delivery-check', '택배 가능 여부', '택배 가능 여부를 확인해야 합니다.', {
        field: 'fulfillmentType',
      }),
    );
  }

  if (order.parsedDate?.isRelative) {
    reviewReasons.push(
      checkReason('relative-date', '날짜 확인 필요', '날짜 표현을 확인해야 합니다.', {
        field: 'desiredDateTime',
        detail: `원문 표현: ${order.parsedDate.originalText}`,
      }),
    );
  }

  return [...reviewReasons, ...createQuantityReviewReasons(order, settings)];
};

const isDuplicateReason = (reviewReason: ReviewReason) =>
  reviewReason.kind === '중복 가능성' || reviewReason.code === 'duplicate-raw-text';

const createReviewReasons = (
  order: CapturedOrder,
  settings: OrderSettings,
  missingFields: Set<OrderFieldKey>,
): ReviewReason[] => {
  const [duplicateReasons] = partition(order.reviewReasons, isDuplicateReason);

  return [
    ...duplicateReasons.map(hydrateDuplicateReason),
    ...[...missingFields].map(createMissingFieldReason),
    ...createCheckReasons(order, settings),
  ];
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

  const reviewReasons = createReviewReasons(order, settings, missingFields);

  const warningLevel = reviewReasons.length > 0 ? 'attention' : 'none';

  const shouldKeepManualStatus = order.status === '제작 준비' || order.status === '발송 완료' || warningLevel === 'none';

  return {
    ...order,
    missingFields: [...missingFields],
    reviewReasons,
    warningLevel,
    status: shouldKeepManualStatus ? order.status : '확인 필요',
  };
};

export const mergeParsedFields = (order: CapturedOrder, parsed: ParsedOrderFields): CapturedOrder => {
  const merged: CapturedOrder = {
    ...order,
    menuMatches: parsed.menuMatches ?? order.menuMatches,
    quantityCandidates: parsed.quantityCandidates ?? order.quantityCandidates,
    parsedDate: parsed.parsedDate !== undefined ? parsed.parsedDate : order.parsedDate,
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
