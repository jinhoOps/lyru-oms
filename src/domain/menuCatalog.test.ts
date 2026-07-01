import { describe, expect, it } from 'vitest';
import { MENU_CATALOG, findMenuMatches, mapPurposeFromText } from './menuCatalog';

describe('findMenuMatches', () => {
  it('exports the menu catalog for consumers that need the known menu list', () => {
    expect(MENU_CATALOG.length).toBeGreaterThan(0);
  });

  it('keeps packaging option data represented outside menu matching', () => {
    expect(MENU_CATALOG).toContainEqual(expect.objectContaining({ menuId: 'bojagi-wrap', matchableAsMenu: false }));
    expect(MENU_CATALOG).toContainEqual(expect.objectContaining({ menuId: 'norigae-deco-wrap', matchableAsMenu: false }));
  });

  it('matches concrete menu names and keeps unit counts', () => {
    expect(findMenuMatches('대추야자 오동나무 9구 세트 5세트')).toContainEqual({
      menuId: 'dates-wood-9',
      label: '대추야자 오동나무 9구 세트',
      unitCount: 9,
      confidence: 'exact',
    });
  });

  it('matches exact menu names with compact spacing and NFKC text', () => {
    expect(findMenuMatches('대추야자오동나무９구세트')).toContainEqual(
      expect.objectContaining({
        menuId: 'dates-wood-9',
        confidence: 'exact',
      }),
    );
  });

  it('keeps only the more specific exact match when compact menu names overlap', () => {
    expect(findMenuMatches('밤화과자 9구 문의').map((match) => match.menuId)).toEqual(['chestnut-wagashi-9']);
  });

  it('uses exact or alias matches instead of adding family fallback matches', () => {
    expect(findMenuMatches('화과자 2구 문의').map((match) => match.menuId)).toEqual(['wagashi-2']);
  });

  it('returns family matches for ambiguous product text', () => {
    const matches = findMenuMatches('대추야자 2구/9구 180개 구매 의사');
    expect(matches.map((match) => match.menuId)).toEqual(['dates-wood-9', 'dates-handle-10', 'dates-premium-15']);
  });

  it('matches shared 2구 and 4구 minimum-order products', () => {
    expect(findMenuMatches('화과자 2구 3세트')).toContainEqual(expect.objectContaining({ menuId: 'wagashi-2', unitCount: 2 }));
    expect(findMenuMatches('화과자 4구 1세트')).toContainEqual(expect.objectContaining({ menuId: 'wagashi-4', unitCount: 4 }));
  });

  it('returns no matches for text without menu signals', () => {
    expect(findMenuMatches('문의드립니다')).toEqual([]);
  });

  it('keeps packaging options out of product menu matches', () => {
    expect(findMenuMatches('보자기 포장')).toEqual([]);
    expect(findMenuMatches('노리개 데코 포장')).toEqual([]);
  });

  it('prefers specific chestnut wagashi text over generic wagashi family matches', () => {
    expect(findMenuMatches('밤화과자 문의').map((match) => match.menuId)).toEqual(['chestnut-wagashi-9']);
  });

  it('keeps generic wagashi matches when generic text appears separately from chestnut wagashi', () => {
    const menuIds = findMenuMatches('밤화과자와 화과자 문의').map((match) => match.menuId);
    expect(menuIds).toContain('chestnut-wagashi-9');
    expect(menuIds).toEqual(expect.arrayContaining(['wagashi-2', 'wagashi-4', 'wagashi-6', 'wagashi-8', 'wagashi-9']));
  });

  it('does not match the mixed oranda box from monaka nut chip text', () => {
    const menuIds = findMenuMatches('모나카견과칩 문의').map((match) => match.menuId);
    expect(menuIds).toContain('monaka-nut-chip-round-box');
    expect(menuIds).not.toContain('oranda-monaka-all-in-box');
  });
});

describe('mapPurposeFromText', () => {
  it('returns an empty purpose for text without purpose hints', () => {
    expect(mapPurposeFromText('일반 문의')).toBe('');
  });

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
