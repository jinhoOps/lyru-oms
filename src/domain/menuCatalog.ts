import type { MenuMatch, PurposeCategory } from './orderTypes';

export interface CatalogItem {
  menuId: string;
  label: string;
  unitCount: number | null;
  aliases: readonly string[];
  familyKeywords: readonly string[];
  matchableAsMenu?: boolean;
}

interface PurposeRule {
  category: Exclude<PurposeCategory, '기타'>;
  hints: readonly string[];
}

interface KeywordRange {
  start: number;
  end: number;
}

interface FamilyKeywordMatch {
  item: CatalogItem;
  keyword: string;
  ranges: KeywordRange[];
}

export const MENU_CATALOG: readonly CatalogItem[] = [
  {
    menuId: 'meeting-set-a',
    label: '상견례세트 A',
    unitCount: null,
    aliases: ['상견례세트 A', '상견례 세트 A'],
    familyKeywords: ['상견례'],
  },
  {
    menuId: 'meeting-set-b',
    label: '상견례세트 B',
    unitCount: null,
    aliases: ['상견례세트 B', '상견례 세트 B'],
    familyKeywords: ['상견례'],
  },
  {
    menuId: 'meeting-set-c',
    label: '상견례세트 C',
    unitCount: null,
    aliases: ['상견례세트 C', '상견례 세트 C'],
    familyKeywords: ['상견례'],
  },
  {
    menuId: 'wagashi-2',
    label: '화과자 2구',
    unitCount: 2,
    aliases: ['화과자 2구'],
    familyKeywords: ['화과자'],
  },
  {
    menuId: 'wagashi-4',
    label: '화과자 4구',
    unitCount: 4,
    aliases: ['화과자 4구'],
    familyKeywords: ['화과자'],
  },
  {
    menuId: 'wagashi-6',
    label: '화과자 6구',
    unitCount: 6,
    aliases: ['화과자 6구'],
    familyKeywords: ['화과자'],
  },
  {
    menuId: 'wagashi-8',
    label: '화과자 8구',
    unitCount: 8,
    aliases: ['화과자 8구'],
    familyKeywords: ['화과자'],
  },
  {
    menuId: 'wagashi-9',
    label: '화과자 9구',
    unitCount: 9,
    aliases: ['화과자 9구'],
    familyKeywords: ['화과자'],
  },
  {
    menuId: 'persimmon-millefeuille-8',
    label: '곶감밀푀유 8구',
    unitCount: 8,
    aliases: ['곶감밀푀유 8구', '곶감 밀푀유 8구'],
    familyKeywords: ['곶감밀푀유', '곶감 밀푀유'],
  },
  {
    menuId: 'persimmon-millefeuille-9',
    label: '곶감밀푀유 9구',
    unitCount: 9,
    aliases: ['곶감밀푀유 9구', '곶감 밀푀유 9구'],
    familyKeywords: ['곶감밀푀유', '곶감 밀푀유'],
  },
  {
    menuId: 'persimmon-millefeuille-gift',
    label: '곶감밀푀유 선물세트',
    unitCount: null,
    aliases: ['곶감밀푀유 선물세트', '곶감 밀푀유 선물세트'],
    familyKeywords: ['곶감밀푀유', '곶감 밀푀유'],
  },
  {
    menuId: 'signature-persimmon-roll',
    label: '시그니처 곶감말이',
    unitCount: null,
    aliases: ['시그니처 곶감말이'],
    familyKeywords: ['곶감말이'],
  },
  {
    menuId: 'persimmon-roll-jeonggwa-set',
    label: '곶감말이 정과세트',
    unitCount: null,
    aliases: ['곶감말이 정과세트', '곶감말이 정과 세트'],
    familyKeywords: ['곶감말이'],
  },
  {
    menuId: 'persimmon-roll-wagashi-set',
    label: '곶감말이 화과자세트',
    unitCount: null,
    aliases: ['곶감말이 화과자세트', '곶감말이 화과자 세트'],
    familyKeywords: ['곶감말이'],
  },
  {
    menuId: 'persimmon-roll-jar-set',
    label: '곶감말이 단지세트',
    unitCount: null,
    aliases: ['곶감말이 단지세트', '곶감말이 단지 세트'],
    familyKeywords: ['곶감말이'],
  },
  {
    menuId: 'dates-wood-9',
    label: '대추야자 오동나무 9구 세트',
    unitCount: 9,
    aliases: ['대추야자 오동나무 9구 세트', '대추야자 오동나무9구세트', '오동나무 9구 세트'],
    familyKeywords: ['대추야자'],
  },
  {
    menuId: 'dates-handle-10',
    label: '대추야자 10구 세트',
    unitCount: 10,
    aliases: ['대추야자 10구 세트', '대추야자10구세트'],
    familyKeywords: ['대추야자'],
  },
  {
    menuId: 'dates-premium-15',
    label: '대추야자 프리미엄 15구 세트',
    unitCount: 15,
    aliases: ['대추야자 프리미엄 15구 세트', '대추야자 프리미엄15구세트'],
    familyKeywords: ['대추야자'],
  },
  {
    menuId: 'oranda-monaka-all-in-box',
    label: '오란다&모나카 올인박스',
    unitCount: null,
    aliases: ['오란다&모나카 올인박스', '오란다 모나카 올인박스'],
    familyKeywords: ['오란다', '올인박스'],
  },
  {
    menuId: 'monaka-nut-chip-round-box',
    label: '모나카견과칩 라운드박스',
    unitCount: null,
    aliases: ['모나카견과칩 라운드박스', '모나카 견과칩 라운드박스'],
    familyKeywords: ['모나카견과칩', '모나카 견과칩'],
  },
  {
    menuId: 'fusion-chapssaltteok',
    label: '퓨전찹쌀떡',
    unitCount: null,
    aliases: ['퓨전찹쌀떡', '퓨전 찹쌀떡'],
    familyKeywords: ['찹쌀떡'],
  },
  {
    menuId: 'chestnut-wagashi-9',
    label: '밤화과자 9구',
    unitCount: 9,
    aliases: ['밤화과자 9구', '밤 화과자 9구'],
    familyKeywords: ['밤화과자', '밤 화과자'],
  },
  {
    menuId: 'flower-rice-dacquoise-cake',
    label: '생화쌀다쿠아즈케이크',
    unitCount: null,
    aliases: ['생화쌀다쿠아즈케이크', '생화 쌀다쿠아즈 케이크'],
    familyKeywords: ['다쿠아즈'],
  },
  {
    menuId: 'bojagi-wrap',
    label: '보자기 포장',
    unitCount: null,
    aliases: ['보자기 포장', '보자기포장'],
    familyKeywords: ['보자기'],
    matchableAsMenu: false,
  },
  {
    menuId: 'norigae-deco-wrap',
    label: '노리개 데코 포장',
    unitCount: null,
    aliases: ['노리개 데코 포장', '노리개데코포장'],
    familyKeywords: ['노리개'],
    matchableAsMenu: false,
  },
];

const purposeRules = [
  { category: '답례품', hints: ['답례품', '기업답례품', '결혼식', '송파답례품'] },
  { category: '상견례/인사', hints: ['상견례', '첫만남', '인사'] },
  { category: '감사 선물', hints: ['부모님', '스승님', '어버이날'] },
  { category: '기념일/행사', hints: ['집들이', '연말선물', '크리스마스선물', '결혼기념'] },
  { category: '단체/기업', hints: ['단체', '기업', '견적', '구매의사', '구매 의사'] },
] as const satisfies readonly PurposeRule[];

function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function compactText(text: string): string {
  return normalizeText(text).replace(/\s+/g, '');
}

function toMatch(item: CatalogItem, confidence: MenuMatch['confidence']): MenuMatch {
  return {
    menuId: item.menuId,
    label: item.label,
    unitCount: item.unitCount,
    confidence,
  };
}

function includesNormalized(text: string, compact: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  return text.includes(normalizedKeyword) || compact.includes(compactText(keyword));
}

function findKeywordRanges(compact: string, keyword: string): KeywordRange[] {
  const compactKeyword = compactText(keyword);
  const ranges: KeywordRange[] = [];
  let start = compact.indexOf(compactKeyword);

  while (start !== -1) {
    ranges.push({ start, end: start + compactKeyword.length });
    start = compact.indexOf(compactKeyword, start + 1);
  }

  return ranges;
}

function isCoveredByLongerKeyword(range: KeywordRange, keyword: string, matches: readonly FamilyKeywordMatch[]): boolean {
  const keywordLength = compactText(keyword).length;
  return matches.some((match) => {
    const matchedKeywordLength = compactText(match.keyword).length;
    return (
      matchedKeywordLength > keywordLength &&
      match.ranges.some((matchedRange) => matchedRange.start <= range.start && range.end <= matchedRange.end)
    );
  });
}

function hasUncoveredFamilySignal(match: FamilyKeywordMatch, matches: readonly FamilyKeywordMatch[]): boolean {
  return match.ranges.some((range) => !isCoveredByLongerKeyword(range, match.keyword, matches));
}

export function findMenuMatches(text: string): MenuMatch[] {
  const normalizedText = normalizeText(text);
  const compact = compactText(text);
  const matchableCatalog = MENU_CATALOG.filter((item) => item.matchableAsMenu !== false);

  const exactMatches = matchableCatalog.flatMap((item) => {
    const labelMatches = includesNormalized(normalizedText, compact, item.label);
    if (labelMatches) {
      return [toMatch(item, 'exact')];
    }

    const aliasMatches = item.aliases.some((alias) => includesNormalized(normalizedText, compact, alias));
    return aliasMatches ? [toMatch(item, 'alias')] : [];
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const familyKeywordMatches = matchableCatalog.flatMap((item) =>
    item.familyKeywords.flatMap((keyword) => {
      const ranges = findKeywordRanges(compact, keyword);
      return ranges.length > 0 ? [{ item, keyword, ranges }] : [];
    }),
  );
  const matchedItems = new Set<CatalogItem>();

  familyKeywordMatches.forEach((match) => {
    if (hasUncoveredFamilySignal(match, familyKeywordMatches)) {
      matchedItems.add(match.item);
    }
  });

  return matchableCatalog.filter((item) => matchedItems.has(item)).map((item) => toMatch(item, 'family'));
}

export function mapPurposeFromText(text: string): PurposeCategory | '' {
  const normalizedText = normalizeText(text);
  const compact = compactText(text);
  const matchedRule = purposeRules.find((rule) =>
    rule.hints.some((hint) => includesNormalized(normalizedText, compact, hint)),
  );

  return matchedRule?.category ?? '';
}
