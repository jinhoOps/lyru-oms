import { describe, expect, it } from 'vitest';
import { createRawTextDuplicateKey, hasSimilarRawText, parseRawText } from './parser';

const rawTextKeys = (values: string[]) => new Set(values.map(createRawTextDuplicateKey));

describe('parseRawText', () => {
  it('extracts known labels and related keywords', () => {
    const parsed = parseRawText(`성함: 김리루
전화번호: 010-1111-2222
상품: 곶감밀푀유 4구
개수: 5
수령방법: 택배
배송지: 서울시 강남구
요청사항: 선물이라 예쁘게 부탁드려요`);

    expect(parsed.customerName).toBe('김리루');
    expect(parsed.phone).toBe('010-1111-2222');
    expect(parsed.orderItems).toBe('곶감밀푀유 4구');
    expect(parsed.quantity).toBe('5');
    expect(parsed.fulfillmentType).toBe('택배');
    expect(parsed.address).toBe('서울시 강남구');
    expect(parsed.customerRequestNote).toBe('선물이라 예쁘게 부탁드려요');
  });

  it('extracts consultation-style purpose, menu matches, quantity candidates, and delivery signal', () => {
    const parsed = parseRawText(`결혼식 답례품
대추야자 2구/9구
180개 / 20개 구매 의사 먼저 밝히려고 합니다!!!
택배 가능할까요?`);

    expect(parsed.purpose).toBe('답례품');
    expect(parsed.orderItems).toBe('대추야자 2구/9구');
    expect(parsed.quantity).toBe('180개 / 20개 (예측)');
    expect(parsed.quantityCandidates).toEqual([
      { value: 180, unit: '개', rawText: '180개' },
      { value: 20, unit: '개', rawText: '20개' },
    ]);
    expect(parsed.menuMatches.map((match) => match.menuId)).toEqual([
      'dates-wood-9',
      'dates-handle-10',
      'dates-premium-15',
    ]);
    expect(parsed.fulfillmentType).toBe('택배');
  });

  it('does not treat product unit counts, prices, delivery fees, or phone numbers as quantity candidates', () => {
    const parsed = parseRawText(`연락처: 010-1111-2222
화과자 9구
45,000원
배송비 5,000원
5세트 주문합니다`);

    expect(parsed.quantityCandidates).toEqual([{ value: 5, unit: '세트', rawText: '5세트' }]);
    expect(parsed.quantity).toBe('5세트');
  });

  it('keeps relative dates as parsed date metadata without filling desired date', () => {
    const parsed = parseRawText('이번 주 금요일 픽업하고 싶어요');

    expect(parsed.desiredDateTime).toBe('');
    expect(parsed.parsedDate).toEqual({
      isoDate: '',
      timeText: '',
      originalText: '이번 주 금요일',
      isRelative: true,
    });
  });

  it('fills desired date from explicit date only when unlabeled', () => {
    const parsed = parseRawText('2026-06-15 14:00 택배 가능한가요?');

    expect(parsed.desiredDateTime).toBe('2026-06-15 14:00');
    expect(parsed.parsedDate).toMatchObject({
      isoDate: '2026-06-15',
      timeText: '14:00',
      originalText: '2026-06-15 14:00 택배 가능한가요?',
      isRelative: false,
    });
  });

  it('does not overwrite labeled quantity with inferred quantity candidates', () => {
    const parsed = parseRawText(`수량: 별도 상담
5세트 주문 가능할까요?`);

    expect(parsed.quantity).toBe('별도 상담');
    expect(parsed.quantityCandidates).toEqual([{ value: 5, unit: '세트', rawText: '5세트' }]);
  });

  it('uses labeled plain quantity numbers as set quantity candidates', () => {
    const parsed = parseRawText(`상품: 화과자 9구
개수: 5`);

    expect(parsed.quantity).toBe('5');
    expect(parsed.quantityCandidates).toEqual([{ value: 5, unit: '세트', rawText: '5' }]);
  });

  it('does not infer fulfillment when a fulfillment label is present but unresolved', () => {
    const parsed = parseRawText(`수령방법: 상담 필요
택배도 가능한지 문의드립니다`);

    expect(parsed.fulfillmentType).toBe('');
  });

  it('keeps clear single fulfillment signals and rejects ambiguous corrections', () => {
    expect(parseRawText('수령방법: 택배').fulfillmentType).toBe('택배');
    expect(parseRawText('수령방법: 픽업').fulfillmentType).toBe('픽업');
    expect(parseRawText('수령방법: 방문').fulfillmentType).toBe('픽업');

    expect(parseRawText('수령방법: 택배 아니고 픽업').fulfillmentType).toBe('');
    expect(parseRawText('수령방법: 택배X 방문').fulfillmentType).toBe('');
    expect(parseRawText('수령방법: 택배 취소').fulfillmentType).toBe('');
  });

  it('infers fulfillment from global text even when unrelated fields contain correction-like values', () => {
    const parsed = parseRawText(`택배 가능할까요?
견과류 알레르기 유무: x`);

    expect(parsed.fulfillmentType).toBe('택배');
    expect(parsed.allergyNote).toBe('x');
  });
});

describe('createRawTextDuplicateKey', () => {
  it('normalizes full-width digits, whitespace, newlines, and case for duplicate checks', () => {
    expect(createRawTextDuplicateKey(' 주문ID: ＡＢＣ１２３\n수량:\t５ ')).toBe('주문id: abc123 수량: 5');
  });
});

describe('hasSimilarRawText', () => {
  it('flags normalized exact raw text as duplicate possibility', () => {
    expect(hasSimilarRawText('성함: 김리루\n수량: 5', rawTextKeys([' 성함: 김리루 수량: 5 ']))).toBe(true);
  });

  it('does not flag punctuation or phone-format differences as duplicate', () => {
    expect(hasSimilarRawText('전화번호: 010-1111-2222', rawTextKeys(['전화번호 01011112222']))).toBe(false);
  });

  it('does not flag unrelated messages', () => {
    expect(hasSimilarRawText('성함: 김리루', rawTextKeys(['성함: 박화과']))).toBe(false);
  });
});
