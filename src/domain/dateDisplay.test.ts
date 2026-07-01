import { describe, expect, it } from 'vitest';
import { formatDday, parseExplicitDate } from './dateDisplay';

const today = new Date('2026-07-01T09:00:00+09:00');

describe('parseExplicitDate', () => {
  it.each([
    ['7/5', '2026-07-05', ''],
    ['7월 5일', '2026-07-05', ''],
    ['7월 5일 오후 2시', '2026-07-05', '14:00'],
    ['2026-07-05', '2026-07-05', ''],
    ['2026-07-05 11:30', '2026-07-05', '11:30'],
  ] as const)('parses explicit date "%s"', (text, isoDate, timeText) => {
    expect(parseExplicitDate(text, today)).toEqual({ isoDate, timeText, originalText: text, isRelative: false });
  });

  it.each([
    ['이번 주 금요일 픽업', '이번 주 금요일'],
    ['다음 주말', '다음 주말'],
    ['어버이날 전', '어버이날 전'],
    ['결혼식 전날', '결혼식 전날'],
    ['최대한 빨리', '최대한 빨리'],
  ] as const)('keeps relative date text "%s" unconfirmed', (text, originalText) => {
    expect(parseExplicitDate(text, today)).toEqual({
      isoDate: '',
      timeText: '',
      originalText,
      isRelative: true,
    });
  });

  it('returns null when text has no date signal', () => {
    expect(parseExplicitDate('마카롱 10개 주문합니다', today)).toBeNull();
  });
});

describe('formatDday', () => {
  it.each([
    [{ isoDate: '2026-07-04', timeText: '', originalText: '7월 4일', isRelative: false }, 'D-3', '2026년 7월 4일'],
    [{ isoDate: '2026-07-01', timeText: '14:00', originalText: '7월 1일 오후 2시', isRelative: false }, '오늘 14:00', '2026년 7월 1일 14:00'],
    [{ isoDate: '2026-07-01', timeText: '', originalText: '7월 1일', isRelative: false }, '오늘', '2026년 7월 1일'],
    [{ isoDate: '2026-06-30', timeText: '', originalText: '6월 30일', isRelative: false }, 'D+1', '2026년 6월 30일'],
    [{ isoDate: '', timeText: '', originalText: '이번 주 금요일', isRelative: true }, '날짜 확인 필요', '원문 표현: 이번 주 금요일'],
    [{ isoDate: '', timeText: '', originalText: '날짜 추후 확정', isRelative: false }, '날짜 확인 필요', '원문 표현: 날짜 추후 확정'],
  ] as const)('formats %o', (value, label, title) => {
    expect(formatDday(value, today)).toEqual({ label, title });
  });

  it('formats a missing desired date', () => {
    expect(formatDday(null, today)).toEqual({ label: '희망일 미정', title: '희망일이 비어 있어요' });
  });
});
