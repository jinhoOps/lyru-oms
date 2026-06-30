import { describe, expect, it } from 'vitest';
import { parseRawText, hasSimilarRawText } from './parser';

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

  it('does not infer values from free sentences', () => {
    const parsed = parseRawText('김리루 고객님이 내일 픽업하고 싶다고 하심');
    expect(parsed.customerName).toBe('');
    expect(parsed.desiredDateTime).toBe('');
    expect(parsed.fulfillmentType).toBe('');
  });
});

describe('hasSimilarRawText', () => {
  it('flags exact or near-exact raw text as duplicate possibility', () => {
    expect(hasSimilarRawText('성함: 김리루\n수량: 5', [' 성함: 김리루 수량: 5 '])).toBe(true);
  });

  it('does not flag unrelated messages', () => {
    expect(hasSimilarRawText('성함: 김리루', ['성함: 박화과'])).toBe(false);
  });
});
