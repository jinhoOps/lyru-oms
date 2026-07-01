import { describe, expect, it } from 'vitest';
import { findMenuMatches, mapPurposeFromText } from './menuCatalog';

describe('findMenuMatches', () => {
  it('matches concrete menu names and keeps unit counts', () => {
    expect(findMenuMatches('대추야자 오동나무 9구 세트 5세트')).toContainEqual({
      menuId: 'dates-wood-9',
      label: '대추야자 오동나무 9구 세트',
      unitCount: 9,
      confidence: 'exact',
    });
  });

  it('returns family matches for ambiguous product text', () => {
    const matches = findMenuMatches('대추야자 2구/9구 180개 구매 의사');
    expect(matches.map((match) => match.menuId)).toEqual(['dates-wood-9', 'dates-handle-10', 'dates-premium-15']);
  });

  it('matches shared 2구 and 4구 minimum-order products', () => {
    expect(findMenuMatches('화과자 2구 3세트')).toContainEqual(expect.objectContaining({ menuId: 'wagashi-2', unitCount: 2 }));
    expect(findMenuMatches('화과자 4구 1세트')).toContainEqual(expect.objectContaining({ menuId: 'wagashi-4', unitCount: 4 }));
  });
});

describe('mapPurposeFromText', () => {
  it.each([
    ['결혼식 답례품 문의', '답례품'],
    ['기업답례품 견적 부탁드립니다', '답례품'],
    ['상견례 선물', '상견례/인사'],
    ['부모님 선물입니다', '감사 선물'],
    ['크리스마스선물 문의', '기념일/행사'],
    ['단체 주문 구매 의사', '단체/기업'],
  ] as const)('maps "%s" to "%s"', (text, expected) => {
    expect(mapPurposeFromText(text)).toBe(expected);
  });
});
