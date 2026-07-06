import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/orderTypes';
import { SettingsModal } from './SettingsModal';

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

describe('SettingsModal', () => {
  it('shows default quantity rules and accurate conditional guidance', () => {
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText('주문 수량 조건')).toBeInTheDocument();
    expect(screen.getByLabelText('대량 기준 실수량')).toHaveValue(40);
    expect(screen.getByLabelText('최소 주문 조건 1 상품 구수')).toHaveValue(2);
    expect(screen.getByLabelText('최소 주문 조건 1 최소 세트')).toHaveValue(5);
    expect(screen.getByLabelText('최소 주문 조건 2 상품 구수')).toHaveValue(4);
    expect(screen.getByLabelText('최소 주문 조건 2 최소 세트')).toHaveValue(2);
    expect(screen.getByText('택배 주소는 수령 방식이 택배일 때만 추가 확인 항목으로 봅니다.')).toBeInTheDocument();
    expect(screen.queryByText(/픽업 시간/)).not.toBeInTheDocument();
  });

  it('focuses a useful control when opened and closes with Escape', async () => {
    const onClose = vi.fn();

    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={vi.fn()} />);

    expect(screen.getByRole('button', { name: '설정 닫기' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('awaits async save and prevents duplicate saves while pending', async () => {
    const user = userEvent.setup();
    const pendingSave = createDeferred<void>();
    const onSave = vi.fn(() => pendingSave.promise);
    const onClose = vi.fn();
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={onSave} />);

    await user.dblClick(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      pendingSave.resolve();
      await pendingSave.promise;
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the modal open when async save fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    const onClose = vi.fn();
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(screen.getByRole('dialog', { name: '정보 부족 기준' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps Tab focus inside modal controls', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SettingsModal open settings={DEFAULT_SETTINGS} onClose={vi.fn()} onSave={vi.fn()} />
        <button type="button">바깥 버튼</button>
      </>,
    );

    const dialog = screen.getByRole('dialog', { name: '정보 부족 기준' });
    const closeButton = within(dialog).getByRole('button', { name: '설정 닫기' });
    const saveButton = within(dialog).getByRole('button', { name: '저장' });

    closeButton.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(saveButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
    expect(screen.getByRole('button', { name: '바깥 버튼' })).not.toHaveFocus();
  });

  it('saves edited required fields and bulk real unit threshold', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText('주문 내용'));
    await userEvent.clear(screen.getByLabelText('대량 기준 실수량'));
    await userEvent.type(screen.getByLabelText('대량 기준 실수량'), '8');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredFields: expect.not.arrayContaining(['orderItems']),
        conditionalRequiredFields: {
          address: { field: 'fulfillmentType', equals: '택배' },
        },
        quantityRules: expect.objectContaining({
          bulkRealUnitThreshold: 8,
        }),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('saves edited minimum order rules', async () => {
    const onSave = vi.fn();
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={vi.fn()} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText('최소 주문 조건 1 상품 구수'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 1 상품 구수'), '3');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 1 최소 세트'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 1 최소 세트'), '4');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 2 상품 구수'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 2 상품 구수'), '6');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 2 최소 세트'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 2 최소 세트'), '2');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityRules: expect.objectContaining({
          minimumOrderRules: [
            { unitCount: 3, minimumSets: 4 },
            { unitCount: 6, minimumSets: 2 },
          ],
        }),
      }),
    );
  });

  it('cancels without saving', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText('연락처'));
    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps previous valid quantity rules when invalid input is saved', async () => {
    const onSave = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      quantityRules: {
        ...DEFAULT_SETTINGS.quantityRules,
        bulkRealUnitThreshold: 7,
        minimumOrderRules: [
          { unitCount: 2, minimumSets: 5 },
          { unitCount: 4, minimumSets: 2 },
        ],
      },
    };
    render(<SettingsModal open settings={settings} onClose={vi.fn()} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText('대량 기준 실수량'));
    await userEvent.type(screen.getByLabelText('대량 기준 실수량'), '-2');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 1 상품 구수'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 1 상품 구수'), '0');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 1 최소 세트'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 1 최소 세트'), '6');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 2 상품 구수'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 2 상품 구수'), '8');
    await userEvent.clear(screen.getByLabelText('최소 주문 조건 2 최소 세트'));
    await userEvent.type(screen.getByLabelText('최소 주문 조건 2 최소 세트'), '-1');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityRules: expect.objectContaining({
          bulkRealUnitThreshold: 7,
          minimumOrderRules: [
            { unitCount: 2, minimumSets: 6 },
            { unitCount: 8, minimumSets: 2 },
          ],
        }),
      }),
    );
  });
});
