import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { parseExplicitDate } from '../domain/dateDisplay';

interface DesiredDateTimePickerProps {
  desiredDateTime: string;
  pickupTime: string;
  includeTime: boolean;
  onApply: (nextValue: { desiredDateTime: string; pickupTime: string }) => void;
}

const timeOptions = ['11:00', '13:00', '15:00', '17:00'];
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

const pad2 = (value: number) => String(value).padStart(2, '0');

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
};

const fromIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return undefined;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const getInitialDate = (desiredDateTime: string) => {
  const parsedDate = parseExplicitDate(desiredDateTime);

  return parsedDate?.isoDate ? fromIsoDate(parsedDate.isoDate) : undefined;
};

const formatDisplayDate = (isoDate: string) => {
  const date = fromIsoDate(isoDate);

  if (!date) {
    return '';
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${dayNames[date.getDay()]}요일`;
};

export function DesiredDateTimePicker({
  desiredDateTime,
  pickupTime,
  includeTime,
  onApply,
}: DesiredDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(() => getInitialDate(desiredDateTime));
  const [draftTime, setDraftTime] = useState(pickupTime);
  const today = useMemo(() => startOfToday(), []);
  const selectedIsoDate = draftDate ? toLocalIsoDate(draftDate) : '';
  const buttonLabel = includeTime ? '희망일/시간 선택' : '희망일 선택';
  const dialogLabel = buttonLabel;
  const summary = [
    selectedIsoDate ? formatDisplayDate(selectedIsoDate) : desiredDateTime || '날짜 미정',
    includeTime ? draftTime || '시간 미정' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (!isOpen) {
      setDraftDate(getInitialDate(desiredDateTime));
      setDraftTime(pickupTime);
    }
  }, [desiredDateTime, isOpen, pickupTime]);

  function handleQuickDate(days: number) {
    setDraftDate(addDays(today, days));
  }

  function handleApply() {
    onApply({
      desiredDateTime: draftDate ? toLocalIsoDate(draftDate) : desiredDateTime,
      pickupTime: includeTime ? draftTime : '',
    });
    setIsOpen(false);
  }

  return (
    <>
      <button type="button" className="dateTimeFieldButton" aria-label={buttonLabel} onClick={() => setIsOpen(true)}>
        <span className="dateTimeFieldValue">{summary}</span>
        <span className="dateTimeFieldCue">선택</span>
      </button>

      {isOpen ? (
        <div className="dateTimeSheetBackdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="dateTimeSheet"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dateTimeSheetHeader">
              <h3>{includeTime ? '희망일/시간' : '희망일'}</h3>
              <button type="button" className="iconButton" aria-label="선택기 닫기" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>

            <div className="quickDateGrid" aria-label="빠른 날짜 선택">
              <button type="button" className="dateChip" onClick={() => handleQuickDate(0)}>
                오늘
              </button>
              <button type="button" className="dateChip" onClick={() => handleQuickDate(1)}>
                내일
              </button>
              <button type="button" className="dateChip" onClick={() => handleQuickDate(2)}>
                모레
              </button>
            </div>

            <DayPicker
              mode="single"
              selected={draftDate}
              onSelect={setDraftDate}
              locale={ko}
              disabled={{ before: today }}
              weekStartsOn={1}
            />

            {includeTime ? (
              <div className="timePickerGroup" aria-label="픽업 시간 선택">
                <p>픽업 시간</p>
                <div className="timeChipGrid">
                  {timeOptions.map((timeOption) => (
                    <button
                      type="button"
                      key={timeOption}
                      className={`timeChip ${draftTime === timeOption ? 'selected' : ''}`}
                      aria-pressed={draftTime === timeOption}
                      onClick={() => setDraftTime(timeOption)}
                    >
                      {timeOption}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`timeChip ${draftTime === '' ? 'selected' : ''}`}
                    aria-pressed={draftTime === ''}
                    onClick={() => setDraftTime('')}
                  >
                    시간 미정
                  </button>
                </div>
              </div>
            ) : null}

            <div className="dateTimeSheetActions">
              <button type="button" className="secondaryButton" onClick={() => setIsOpen(false)}>
                취소
              </button>
              <button type="button" disabled={!draftDate} onClick={handleApply}>
                적용
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
