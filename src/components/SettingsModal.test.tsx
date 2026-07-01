import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/orderTypes';
import { SettingsModal } from './SettingsModal';

afterEach(() => {
  cleanup();
});

describe('SettingsModal', () => {
  it('focuses a useful control when opened and closes with Escape', async () => {
    const onClose = vi.fn();

    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={vi.fn()} />);

    expect(screen.getByRole('button', { name: '설정 닫기' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('saves edited required fields and bulk quantity threshold', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<SettingsModal open settings={DEFAULT_SETTINGS} onClose={onClose} onSave={onSave} />);

    await userEvent.click(screen.getByLabelText('주문 내용'));
    await userEvent.clear(screen.getByLabelText('대량 주문 기준 수량'));
    await userEvent.type(screen.getByLabelText('대량 주문 기준 수량'), '8');
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
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('keeps the previous valid bulk quantity when invalid input is saved', async () => {
    const onSave = vi.fn();
    const settings = {
      ...DEFAULT_SETTINGS,
      quantityRules: {
        ...DEFAULT_SETTINGS.quantityRules,
        bulkRealUnitThreshold: 7,
      },
    };
    render(<SettingsModal open settings={settings} onClose={vi.fn()} onSave={onSave} />);

    await userEvent.clear(screen.getByLabelText('대량 주문 기준 수량'));
    await userEvent.type(screen.getByLabelText('대량 주문 기준 수량'), '-2');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityRules: expect.objectContaining({
          bulkRealUnitThreshold: 7,
        }),
      }),
    );
  });
});
