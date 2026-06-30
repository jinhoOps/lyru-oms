import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, EMPTY_ORDER_FIELDS, type CapturedOrder } from '../domain/orderTypes';
import { OrderDetail } from './OrderDetail';

const baseOrder = (overrides: Partial<CapturedOrder> = {}): CapturedOrder => ({
  id: 'order-1',
  source: '카카오톡 채널',
  rawText: '성함: 김리루',
  ...EMPTY_ORDER_FIELDS,
  customerName: '김리루',
  orderItems: '곶감밀푀유',
  quantity: '1',
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: [],
  warningLevel: 'none',
  status: '확인필요',
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe('OrderDetail', () => {
  it('keeps an order with review reasons in 확인필요 when status select tries to save 수집', async () => {
    const onChange = vi.fn();
    const order = baseOrder({
      phone: '',
      desiredDateTime: '',
      fulfillmentType: '',
      reviewReasons: [{ kind: '정보 부족', field: 'phone', message: '연락처 정보가 비어 있어 확인이 필요합니다.' }],
      warningLevel: 'attention',
      status: '확인필요',
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('상태'), '수집');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: '확인필요',
        warningLevel: 'attention',
      }),
    );
  });

  it('allows 정리 완료 even when review reasons remain', async () => {
    const onChange = vi.fn();
    const order = baseOrder({
      phone: '',
      desiredDateTime: '',
      fulfillmentType: '',
      reviewReasons: [{ kind: '정보 부족', field: 'phone', message: '연락처 정보가 비어 있어 확인이 필요합니다.' }],
      warningLevel: 'attention',
      status: '확인필요',
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('상태'), '정리 완료');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: '정리 완료',
        warningLevel: 'attention',
      }),
    );
  });
});
