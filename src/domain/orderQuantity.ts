import type { CapturedOrder } from './orderTypes';

export const getPureProductionQuantity = (order: Pick<CapturedOrder, 'menuMatches' | 'quantityCandidates'>) => {
  if (order.quantityCandidates.length !== 1) {
    return null;
  }

  const [quantityCandidate] = order.quantityCandidates;

  if (quantityCandidate.unit === '개') {
    return quantityCandidate.value;
  }

  if (order.menuMatches.length !== 1) {
    return null;
  }

  const unitCount = order.menuMatches[0].unitCount;

  if (unitCount === null) {
    return null;
  }

  return unitCount * quantityCandidate.value;
};
