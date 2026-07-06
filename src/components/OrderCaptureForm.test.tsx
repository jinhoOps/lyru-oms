import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/orderTypes';
import { OrderCaptureForm } from './OrderCaptureForm';

afterEach(() => {
  cleanup();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('OrderCaptureForm', () => {
  it('shows future smart store API automation guidance above raw input', () => {
    render(
      <OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="카카오톡 채널" onSave={vi.fn()} />,
    );

    expect(screen.getByText('네이버 스마트스토어 같은 경우는 API 개발하면 자동으로 주문목록 추가 가능해요.')).toBeInTheDocument();
  });

  it('saves raw text even when required fields are missing', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="네이버 스마트스토어" onSave={onSave} />);

    await userEvent.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        source: '네이버 스마트스토어',
        rawText: '성함: 김리루',
        customerName: '김리루',
        status: '확인 필요',
      }),
    );
  });

  it('shows duplicate possibility but still allows save', async () => {
    const onSave = vi.fn();
    render(
      <OrderCaptureForm
        existingRawTexts={['성함: 김리루']}
        settings={DEFAULT_SETTINGS}
        source="카카오톡 채널"
        onSave={onSave}
      />,
    );

    await userEvent.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
    expect(screen.getByText('비슷한 원문이 이미 있어요. 그래도 저장할 수 있습니다.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('prevents duplicate submits while a save is pending', async () => {
    const user = userEvent.setup();
    const pendingSave = createDeferred<boolean>();
    const onSave = vi.fn(() => pendingSave.promise);
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="카카오톡 채널" onSave={onSave} />);

    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 중복방지고객');
    await user.dblClick(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled();

    await act(async () => {
      pendingSave.resolve(true);
      await pendingSave.promise;
    });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('does not clear newer raw text when an older pending save succeeds', async () => {
    const user = userEvent.setup();
    const pendingSave = createDeferred<boolean>();
    const onSave = vi.fn(() => pendingSave.promise);
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="카카오톡 채널" onSave={onSave} />);

    const rawTextInput = screen.getByLabelText('주문/문의 원문');
    await user.type(rawTextInput, '성함: 첫고객');
    await user.click(screen.getByRole('button', { name: '저장' }));

    fireEvent.change(rawTextInput, { target: { value: '성함: 새고객' } });
    expect(rawTextInput).toHaveValue('성함: 새고객');

    await act(async () => {
      pendingSave.resolve(true);
      await pendingSave.promise;
    });

    expect(rawTextInput).toHaveValue('성함: 새고객');
  });

  it('keeps the extraction preview focused on order content fields', async () => {
    render(
      <OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="카카오톡 채널" onSave={vi.fn()} />,
    );

    await userEvent.type(
      screen.getByLabelText('주문/문의 원문'),
      `성함: 김리루
연락처: 010-1111-2222
주문 내용: 대추야자 9구
수량: 5세트
선물 용도: 답례품
수령 방식: 택배`,
    );

    const preview = screen.getByLabelText('추출 결과 미리보기');

    expect(preview).toHaveTextContent('주문 내용: 대추야자 9구');
    expect(preview).toHaveTextContent('수량: 5세트');
    expect(preview).toHaveTextContent('선물 용도: 답례품');
    expect(preview).toHaveTextContent('수령 방식: 택배');
    expect(preview).not.toHaveTextContent('고객명');
    expect(preview).not.toHaveTextContent('연락처');
  });

  it('saves parsed menu, quantity, and date metadata', async () => {
    const onSave = vi.fn();
    render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="카카오톡 채널" onSave={onSave} />);

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
