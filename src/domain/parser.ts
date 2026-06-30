import { EMPTY_ORDER_FIELDS, FIELD_DEFINITIONS, type FulfillmentType, type OrderFieldKey } from './orderTypes';

type ParsedOrderFields = {
  -readonly [Field in keyof typeof EMPTY_ORDER_FIELDS]: Field extends 'fulfillmentType' ? FulfillmentType : string;
};

type ParseableOrderField = Exclude<OrderFieldKey, 'ownerMemo'>;

const PARSEABLE_FIELDS = Object.keys(FIELD_DEFINITIONS).filter(
  (field): field is ParseableOrderField => field !== 'ownerMemo',
);

const normalizeKeyword = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');

const normalizeRawTextForExactDuplicate = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

const findFieldByLabel = (label: string): ParseableOrderField | undefined => {
  const normalizedLabel = normalizeKeyword(label);

  return PARSEABLE_FIELDS.find((field) =>
    FIELD_DEFINITIONS[field].keywords.some((keyword) => normalizeKeyword(keyword) === normalizedLabel),
  );
};

const splitLabeledLine = (line: string): { label: string; value: string } | undefined => {
  const separatorMatch = /[:：-]/.exec(line);

  if (!separatorMatch || separatorMatch.index === 0) {
    return undefined;
  }

  const label = line.slice(0, separatorMatch.index).trim();
  const value = line.slice(separatorMatch.index + 1).trim();

  if (!label || !value) {
    return undefined;
  }

  return { label, value };
};

const normalizeFulfillmentType = (value: string): FulfillmentType => {
  const normalizedValue = value.normalize('NFKC').trim().toLowerCase();
  const hasDeliverySignal = normalizedValue.includes('택배');
  const hasPickupSignal = normalizedValue.includes('픽업') || normalizedValue.includes('방문');
  const hasCorrectionSignal = /아니|아님|x|취소/.test(normalizedValue);

  if (hasCorrectionSignal || (hasDeliverySignal && hasPickupSignal)) {
    return '';
  }

  if (hasDeliverySignal) {
    return '택배';
  }

  if (hasPickupSignal) {
    return '픽업';
  }

  return '';
};

export const parseRawText = (rawText: string): ParsedOrderFields => {
  const parsed: ParsedOrderFields = { ...EMPTY_ORDER_FIELDS };

  for (const line of rawText.split(/\r?\n/)) {
    const labeledLine = splitLabeledLine(line);

    if (!labeledLine) {
      continue;
    }

    const field = findFieldByLabel(labeledLine.label);

    if (!field) {
      continue;
    }

    if (field === 'fulfillmentType') {
      parsed.fulfillmentType = normalizeFulfillmentType(labeledLine.value);
      continue;
    }

    parsed[field] = labeledLine.value;
  }

  return parsed;
};

export const hasSimilarRawText = (rawText: string, existingRawTexts: readonly string[]) => {
  const normalizedRawText = normalizeRawTextForExactDuplicate(rawText);

  return existingRawTexts.some((existingRawText) => normalizeRawTextForExactDuplicate(existingRawText) === normalizedRawText);
};
