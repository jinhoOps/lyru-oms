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
  menuMatches: [
    {
      menuId: 'dates-wood-9',
      label: '대추야자 오동나무 9구 세트',
      unitCount: 9,
      confidence: 'exact',
    },
  ],
  quantityCandidates: [{ value: 180, unit: '개', rawText: '180개' }],
  parsedDate: null,
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
  it('groups review reasons by info and check with concise labels and details', () => {
    const order = baseOrder({
      phone: '',
      desiredDateTime: '',
      fulfillmentType: '',
      missingFields: ['phone', 'desiredDateTime', 'fulfillmentType'],
      reviewReasons: [
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'phone',
          label: '연락처',
          message: '연락처 정보가 비어 있어 확인이 필요합니다.',
        },
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'desiredDateTime',
          label: '희망일',
          message: '희망일 정보가 비어 있어 확인이 필요합니다.',
        },
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'fulfillmentType',
          label: '수령 방식',
          message: '수령 방식 정보가 비어 있어 확인이 필요합니다.',
        },
        {
          kind: '확인필요',
          group: 'check',
          code: 'event-purpose',
          label: '행사 주문',
          message: '행사 일정은 고객에게 다시 확인해야 합니다. 반복 안내 문구입니다.',
          detail: '상견례 용도로 보입니다.',
        },
      ],
      warningLevel: 'attention',
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

    const reviewBox = screen.getByLabelText('확인 필요 사유');

    expect(within(reviewBox).getByText('채워야 할 정보가 있어요')).toBeInTheDocument();
    expect(within(reviewBox).getByText('확인할 내용이 있어요')).toBeInTheDocument();
    expect(within(reviewBox).getByText('연락처')).toBeInTheDocument();
    expect(within(reviewBox).getByText('희망일')).toBeInTheDocument();
    expect(within(reviewBox).getByText('수령 방식')).toBeInTheDocument();
    expect(within(reviewBox).getByText('행사 주문')).toBeInTheDocument();
    expect(within(reviewBox).getByText('상견례 용도로 보입니다.')).toHaveClass('reasonDetail');
    expect(screen.queryByText('연락처 정보가 비어 있어 확인이 필요합니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('행사 일정은 고객에게 다시 확인해야 합니다. 반복 안내 문구입니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('대추야자 오동나무 9구 세트')).not.toBeInTheDocument();
    expect(screen.queryByText('180개')).not.toBeInTheDocument();
  });

  it('supplements missing fields that are absent from info review reasons', () => {
    const order = baseOrder({
      phone: '',
      desiredDateTime: '',
      fulfillmentType: '',
      missingFields: ['phone', 'desiredDateTime', 'fulfillmentType'],
      reviewReasons: [
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'phone',
          label: '연락처',
          message: '연락처 정보가 비어 있어 확인이 필요합니다.',
        },
      ],
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

    const reviewBox = screen.getByLabelText('확인 필요 사유');

    expect(within(reviewBox).getByText('연락처')).toBeInTheDocument();
    expect(within(reviewBox).getByText('희망일')).toBeInTheDocument();
    expect(within(reviewBox).getByText('수령 방식')).toBeInTheDocument();
  });

  it('keeps an order with review reasons in 확인필요 when status select tries to save 수집', async () => {
    const onChange = vi.fn();
    const order = baseOrder({
      phone: '',
      desiredDateTime: '',
      fulfillmentType: '',
      reviewReasons: [
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'phone',
          label: '연락처',
          message: '연락처 정보가 비어 있어 확인이 필요합니다.',
        },
      ],
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
      reviewReasons: [
        {
          kind: '정보 부족',
          group: 'info',
          code: 'missing-field',
          field: 'phone',
          label: '연락처',
          message: '연락처 정보가 비어 있어 확인이 필요합니다.',
        },
      ],
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

  it('hides delivery-only and pickup-only fields after fulfillment type is chosen', () => {
    const pickupOrder = baseOrder({ fulfillmentType: '픽업' });
    const { rerender } = render(
      <OrderDetail order={pickupOrder} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText('픽업 시간')).toBeInTheDocument();
    expect(screen.queryByText('택배 주소')).not.toBeInTheDocument();

    rerender(<OrderDetail order={baseOrder({ fulfillmentType: '택배' })} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('택배 주소')).toBeInTheDocument();
    expect(screen.queryByText('픽업 시간')).not.toBeInTheDocument();
  });
});
