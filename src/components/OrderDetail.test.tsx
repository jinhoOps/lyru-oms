import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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
  it('groups missing field reasons into a concise field list', () => {
    const order = baseOrder({
      phone: '',
      desiredDateTime: '',
      fulfillmentType: '',
      missingFields: ['phone', 'desiredDateTime', 'fulfillmentType'],
      reviewReasons: [
        { kind: '정보 부족', field: 'phone', message: '연락처 정보가 비어 있어 확인이 필요합니다.' },
        { kind: '정보 부족', field: 'desiredDateTime', message: '희망일 정보가 비어 있어 확인이 필요합니다.' },
        { kind: '정보 부족', field: 'fulfillmentType', message: '수령 방식 정보가 비어 있어 확인이 필요합니다.' },
      ],
      warningLevel: 'attention',
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

    const reviewBox = screen.getByLabelText('확인 필요 사유');

    expect(within(reviewBox).getByText('아래 항목이 비어 있습니다.')).toBeInTheDocument();
    expect(within(reviewBox).getByText('연락처')).toBeInTheDocument();
    expect(within(reviewBox).getByText('희망일')).toBeInTheDocument();
    expect(within(reviewBox).getByText('수령 방식')).toBeInTheDocument();
    expect(screen.queryByText('연락처 정보가 비어 있어 확인이 필요합니다.')).not.toBeInTheDocument();
  });

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

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={onChange} onClose={vi.fn()} />);

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

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={onChange} onClose={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText('상태'), '정리 완료');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: '정리 완료',
        warningLevel: 'attention',
      }),
    );
  });

  it('renders as a dialog and closes from the fixed header action', async () => {
    const onClose = vi.fn();

    render(<OrderDetail order={baseOrder()} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: '주문 상세' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
