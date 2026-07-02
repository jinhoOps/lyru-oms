import { parseExplicitDate } from './dateDisplay';
import { findMenuMatches, mapPurposeFromText, MENU_CATALOG } from './menuCatalog';
import {
  EMPTY_ORDER_FIELDS,
  FIELD_DEFINITIONS,
  type FulfillmentType,
  type MenuMatch,
  type OrderFieldKey,
  type ParsedDateValue,
  type QuantityCandidate,
} from './orderTypes';

type ParsedOrderBaseFields = {
  -readonly [Field in OrderFieldKey]: Field extends 'fulfillmentType' ? FulfillmentType : string;
};

type ParsedOrderFields = ParsedOrderBaseFields & {
  menuMatches: MenuMatch[];
  quantityCandidates: QuantityCandidate[];
  parsedDate: ParsedDateValue | null;
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

const normalizeFulfillmentType = (value: string, isGlobal = false): FulfillmentType => {
  const normalizedValue = value.normalize('NFKC').trim().toLowerCase();
  const hasDeliverySignal = normalizedValue.includes('택배');
  const hasPickupSignal = normalizedValue.includes('픽업') || normalizedValue.includes('방문');
  const hasCorrectionSignal = !isGlobal && /아니|아님|x|취소/.test(normalizedValue);

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

const stripQuantityExclusions = (value: string) =>
  value
    .replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, ' ')
    .replace(/\d{1,3}(?:,\d{3})+\s*원/g, ' ')
    .replace(/\d+\s*원/g, ' ')
    .replace(/\d+\s*(?:구|개입)/g, ' ');

const extractQuantityCandidates = (rawText: string): QuantityCandidate[] => {
  const strippedText = stripQuantityExclusions(rawText);
  const candidates: QuantityCandidate[] = [];

  for (const match of strippedText.matchAll(/(\d+)\s*(세트|개)/g)) {
    const rawText = match[0].replace(/\s+/g, '');
    candidates.push({ value: Number(match[1]), unit: match[2] as QuantityCandidate['unit'], rawText });
  }

  return candidates;
};

const summarizeQuantityCandidates = (candidates: readonly QuantityCandidate[]) => {
  if (candidates.length === 0) {
    return '';
  }

  if (candidates.length === 1) {
    return candidates[0].rawText;
  }

  return `${candidates.map((candidate) => candidate.rawText).join(' / ')} 후보`;
};

const isQuantityOnlyLine = (line: string) => {
  const strippedLine = stripQuantityExclusions(line).trim();

  return /^\d+\s*(?:개|세트)(?:\s*(?:[/,]|및|와|과|랑)\s*\d+\s*(?:개|세트))*$/.test(strippedLine);
};

const findConsultationOrderItemLine = (rawText: string, menuMatches: readonly MenuMatch[]) => {
  if (menuMatches.length === 0) {
    return '';
  }

  const matchedMenuIds = new Set(menuMatches.map((match) => match.menuId));
  const signalTokens = MENU_CATALOG.filter((item) => matchedMenuIds.has(item.menuId)).flatMap((item) => [
    item.label,
    ...item.aliases,
    ...item.familyKeywords,
  ]);

  return (
    rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !isQuantityOnlyLine(line) && signalTokens.some((token) => normalizeKeyword(line).includes(normalizeKeyword(token)))) ??
    ''
  );
};

const formatParsedDateForField = (parsedDate: ParsedDateValue) =>
  parsedDate.timeText ? `${parsedDate.isoDate} ${parsedDate.timeText}` : parsedDate.isoDate;

export const parseRawText = (rawText: string): ParsedOrderFields => {
  const parsed: ParsedOrderFields = {
    ...EMPTY_ORDER_FIELDS,
    menuMatches: [],
    quantityCandidates: [],
    parsedDate: null,
  };
  const labeledFields = new Set<ParseableOrderField>();

  for (const line of rawText.split(/\r?\n/)) {
    const labeledLine = splitLabeledLine(line);

    if (!labeledLine) {
      continue;
    }

    const field = findFieldByLabel(labeledLine.label);

    if (!field) {
      continue;
    }

    labeledFields.add(field);

    if (field === 'fulfillmentType') {
      parsed.fulfillmentType = normalizeFulfillmentType(labeledLine.value);
      continue;
    }

    parsed[field] = labeledLine.value;
  }

  parsed.menuMatches = findMenuMatches(rawText);
  parsed.quantityCandidates = extractQuantityCandidates(rawText);
  parsed.parsedDate = parseExplicitDate(rawText);

  if (!labeledFields.has('purpose')) {
    parsed.purpose = mapPurposeFromText(rawText);
  }

  if (!labeledFields.has('orderItems')) {
    parsed.orderItems = findConsultationOrderItemLine(rawText, parsed.menuMatches);
  }

  if (!labeledFields.has('quantity')) {
    parsed.quantity = summarizeQuantityCandidates(parsed.quantityCandidates);
  }

  if (!labeledFields.has('fulfillmentType')) {
    parsed.fulfillmentType = normalizeFulfillmentType(rawText, true);
  }

  if (!labeledFields.has('desiredDateTime') && parsed.parsedDate && !parsed.parsedDate.isRelative) {
    parsed.desiredDateTime = formatParsedDateForField(parsed.parsedDate);
  }

  return parsed;
};

export const hasSimilarRawText = (rawText: string, existingRawTexts: readonly string[]) => {
  const normalizedRawText = normalizeRawTextForExactDuplicate(rawText);

  return existingRawTexts.some((existingRawText) => normalizeRawTextForExactDuplicate(existingRawText) === normalizedRawText);
};
