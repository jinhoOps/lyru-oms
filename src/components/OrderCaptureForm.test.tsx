import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/orderTypes';
import { OrderCaptureForm } from './OrderCaptureForm';

afterEach(() => {
  cleanup();
});

describe('OrderCaptureForm', () => {
  it('shows future smart store API automation guidance above raw input', () => {
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);

    expect(screen.getByText('네이버 스마트스토어 같은 경우는 API 개발하면 자동으로 주문목록 추가 가능해요.')).toBeInTheDocument();
  });

  it('saves raw text even when required fields are missing', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await userEvent.selectOptions(screen.getByLabelText('출처'), '카카오톡 채널');
    await userEvent.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '성함: 김리루',
        customerName: '김리루',
        status: '확인필요',
      }),
    );
  });

  it('shows duplicate possibility but still allows save', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={['성함: 김리루']} settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await userEvent.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
    expect(screen.getByText('비슷한 원문이 이미 있어요. 그래도 저장할 수 있습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('saves parsed menu, quantity, and date metadata', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} onSave={onSave} />);

    await userEvent.type(
      screen.getByLabelText('주문/문의 원문'),
      `대추야자 9구
5세트 주문합니다
2026-06-15 14:00`,
    );
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        menuMatches: expect.arrayContaining([
          expect.objectContaining({
            menuId: 'dates-wood-9',
          }),
        ]),
        quantityCandidates: [{ value: 5, unit: '세트', rawText: '5세트' }],
        parsedDate: {
          isoDate: '2026-06-15',
          timeText: '14:00',
          originalText: '대추야자 9구\n5세트 주문합니다\n2026-06-15 14:00',
          isRelative: false,
        },
      }),
    );
  });
});
