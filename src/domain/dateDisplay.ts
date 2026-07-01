import type { ParsedDateValue } from './orderTypes';

const RELATIVE_DATE_PATTERN = /(이번\s*주\s*[월화수목금토일]요일|다음\s*주말|어버이날\s*전|결혼식\s*전날|최대한\s*빨리)/;

const pad2 = (value: number) => String(value).padStart(2, '0');

const toIsoDate = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)}`;

const getKoreaDateParts = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
};

const isValidDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const formatValidTime = (hour: number, minute: number) => {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return '';
  }

  return `${pad2(hour)}:${pad2(minute)}`;
};

const parseKoreanTime = (period: string | undefined, hourText: string | undefined, minuteText: string | undefined) => {
  if (!hourText) {
    return '';
  }

  let hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;

  if (period && (hour < 1 || hour > 12)) {
    return '';
  }

  if (period === '오후' && hour < 12) {
    hour += 12;
  }

  if (period === '오전' && hour === 12) {
    hour = 0;
  }

  return formatValidTime(hour, minute);
};

const buildParsedDate = (
  year: number,
  month: number,
  day: number,
  timeText: string,
  originalText: string,
): ParsedDateValue | null => {
  if (!isValidDate(year, month, day)) {
    return null;
  }

  return {
    isoDate: toIsoDate(year, month, day),
    timeText,
    originalText,
    isRelative: false,
  };
};

export const parseExplicitDate = (text: string, today = new Date()): ParsedDateValue | null => {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return null;
  }

  const isoMatch = /(^|[^\dA-Za-z가-힣])(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?(?=$|[^\dA-Za-z가-힣])/.exec(
    trimmedText,
  );

  if (isoMatch) {
    return buildParsedDate(
      Number(isoMatch[2]),
      Number(isoMatch[3]),
      Number(isoMatch[4]),
      isoMatch[5] ? formatValidTime(Number(isoMatch[5]), Number(isoMatch[6])) : '',
      trimmedText,
    );
  }

  const slashMatch = /(^|[^\dA-Za-z가-힣])(\d{1,2})\/(\d{1,2})(?=$|[^\dA-Za-z가-힣])/.exec(trimmedText);

  if (slashMatch) {
    return buildParsedDate(getKoreaDateParts(today).year, Number(slashMatch[2]), Number(slashMatch[3]), '', trimmedText);
  }

  const koreanMatch = /(\d{1,2})월\s*(\d{1,2})일(?:\s*(오전|오후)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?)?/.exec(trimmedText);

  if (koreanMatch) {
    return buildParsedDate(
      getKoreaDateParts(today).year,
      Number(koreanMatch[1]),
      Number(koreanMatch[2]),
      parseKoreanTime(koreanMatch[3], koreanMatch[4], koreanMatch[5]),
      trimmedText,
    );
  }

  const relativeMatch = RELATIVE_DATE_PATTERN.exec(trimmedText);

  if (relativeMatch) {
    return {
      isoDate: '',
      timeText: '',
      originalText: relativeMatch[1],
      isRelative: true,
    };
  }

  return null;
};

const toUtcDateOnlyTime = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);

export const formatDday = (value: ParsedDateValue | null, today = new Date()) => {
  if (!value) {
    return { label: '희망일 미정', title: '희망일이 비어 있어요' };
  }

  if (value.isRelative || !value.isoDate) {
    return { label: '날짜 확인 필요', title: `원문 표현: ${value.originalText}` };
  }

  const [year, month, day] = value.isoDate.split('-').map(Number);
  const koreaToday = getKoreaDateParts(today);
  const dayDifference = Math.round(
    (toUtcDateOnlyTime(year, month, day) - toUtcDateOnlyTime(koreaToday.year, koreaToday.month, koreaToday.day)) /
      86_400_000,
  );
  const title = `${year}년 ${month}월 ${day}일${value.timeText ? ` ${value.timeText}` : ''}`;

  if (dayDifference === 0) {
    return { label: value.timeText ? `오늘 ${value.timeText}` : '오늘', title };
  }

  if (dayDifference > 0) {
    return { label: `D-${dayDifference}`, title };
  }

  return { label: `D+${Math.abs(dayDifference)}`, title };
};
