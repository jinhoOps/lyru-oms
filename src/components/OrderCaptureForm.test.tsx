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
});
