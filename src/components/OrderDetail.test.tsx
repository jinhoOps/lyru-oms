import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  status: '확인 필요',
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
  ...overrides,
});

const pad2 = (value: number) => String(value).padStart(2, '0');

const addDaysIsoDate = (days: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it('shows unconfirmed change request in the confirmation summary', () => {
    render(
      <OrderDetail
        order={baseOrder({ changeRequestNote: '수령 시간을 오후 3시로 변경', changeRequestConfirmed: false })}
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const reviewBox = screen.getByLabelText('확인 필요 사유');

    expect(within(reviewBox).getByText('추가/변경 요청 확인 필요')).toBeInTheDocument();
  });

  it('focuses customer name input from the detail title when customer name is missing', async () => {
    const user = userEvent.setup();

    render(
      <OrderDetail
        order={baseOrder({ customerName: '' })}
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '고객명 입력으로 이동' }));

    expect(screen.getByLabelText('고객명')).toHaveFocus();
  });

  it('keeps raw text read-only and copies it from the detail view', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <OrderDetail
        order={baseOrder({ rawText: '성함: 김리루\n곶감 1세트' })}
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('주문/문의 원문')).toHaveAttribute('readonly');

    await user.click(screen.getByRole('button', { name: '주문/문의 원문 복사' }));

    expect(writeText).toHaveBeenCalledWith('성함: 김리루\n곶감 1세트');
  });

  it('opens addition or change request editor from the subtle header button', async () => {
    const user = userEvent.setup();

    render(
      <OrderDetail
        order={baseOrder({ changeRequestNote: '' })}
        settings={DEFAULT_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('추가/변경 요청 내용')).not.toBeInTheDocument();

    const requestButton = screen.getByRole('button', { name: '+ 추가/변경 요청' });
    expect(requestButton).toHaveClass('changeRequestButton');

    await user.click(requestButton);

    expect(screen.getByText('고객이 나중에 추가하거나 바꿔달라고 한 내용을 적어둡니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('추가/변경 요청 내용')).toBeInTheDocument();
  });

  it('edits change request note and confirmation state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <OrderDetail
        order={baseOrder({ changeRequestNote: '', changeRequestConfirmed: false })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '+ 추가/변경 요청' }));

    fireEvent.change(screen.getByLabelText('추가/변경 요청 내용'), { target: { value: '픽업 시간을 오후 3시로 변경' } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changeRequestNote: '픽업 시간을 오후 3시로 변경',
        changeRequestConfirmed: false,
      }),
    );
  });

  it('allows confirming an existing change request', async () => {
    const onChange = vi.fn();

    render(
      <OrderDetail
        order={baseOrder({ changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: false })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: '반영 확인' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestNote: '픽업 시간을 오후 3시로 변경',
        changeRequestConfirmed: true,
      }),
    );
  });

  it('resets change request confirmation when confirmed note text changes', () => {
    const onChange = vi.fn();

    render(
      <OrderDetail
        order={baseOrder({ changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: true })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('추가/변경 요청 내용'), { target: { value: '픽업 시간을 오후 4시로 변경' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestNote: '픽업 시간을 오후 4시로 변경',
        changeRequestConfirmed: false,
      }),
    );
  });

  it('preserves change request confirmation when only surrounding spaces change', () => {
    const onChange = vi.fn();

    render(
      <OrderDetail
        order={baseOrder({ changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: true })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('추가/변경 요청 내용'), { target: { value: '  픽업 시간을 오후 3시로 변경  ' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestNote: '  픽업 시간을 오후 3시로 변경  ',
        changeRequestConfirmed: true,
      }),
    );
  });

  it('keeps an order with review reasons in 확인 필요 when status select tries to save 신규', async () => {
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
      status: '확인 필요',
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={onChange} onClose={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText('상태'), '신규');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: '확인 필요',
        warningLevel: 'attention',
      }),
    );
  });

  it('allows 제작 준비 even when review reasons remain', async () => {
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
      status: '확인 필요',
    });

    render(<OrderDetail order={order} settings={DEFAULT_SETTINGS} onChange={onChange} onClose={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText('상태'), '제작 준비');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: '제작 준비',
        warningLevel: 'attention',
      }),
    );
  });

  it('updates parsed date metadata when desired date is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tomorrow = addDaysIsoDate(1);

    render(<OrderDetail order={baseOrder()} settings={DEFAULT_SETTINGS} onChange={onChange} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '희망일 선택' }));
    await user.click(within(screen.getByRole('dialog', { name: '희망일 선택' })).getByRole('button', { name: '내일' }));
    await user.click(within(screen.getByRole('dialog', { name: '희망일 선택' })).getByRole('button', { name: '적용' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        desiredDateTime: tomorrow,
        parsedDate: expect.objectContaining({
          isoDate: tomorrow,
          isRelative: false,
        }),
      }),
    );
  });

  it('applies desired date and pickup time from the picker for pickup orders', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tomorrow = addDaysIsoDate(1);

    render(
      <OrderDetail
        order={baseOrder({ desiredDateTime: '', fulfillmentType: '픽업', pickupTime: '' })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '희망일/시간 선택' }));

    const picker = screen.getByRole('dialog', { name: '희망일/시간 선택' });
    await user.click(within(picker).getByRole('button', { name: '내일' }));
    await user.click(within(picker).getByRole('button', { name: '15:00' }));
    await user.click(within(picker).getByRole('button', { name: '적용' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        desiredDateTime: tomorrow,
        pickupTime: '15:00',
        parsedDate: expect.objectContaining({
          isoDate: tomorrow,
          timeText: '15:00',
          isRelative: false,
        }),
        manuallyEditedFields: expect.arrayContaining(['desiredDateTime', 'pickupTime']),
      }),
    );
  });

  it('preserves a parsed pickup time when the picker opens from desired date text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <OrderDetail
        order={baseOrder({
          desiredDateTime: '2026-07-04 15:00',
          fulfillmentType: '픽업',
          pickupTime: '',
          parsedDate: {
            isoDate: '2026-07-04',
            timeText: '15:00',
            originalText: '2026-07-04 15:00',
            isRelative: false,
          },
        })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '희망일/시간 선택' })).toHaveTextContent('15:00');

    await user.click(screen.getByRole('button', { name: '희망일/시간 선택' }));

    const picker = screen.getByRole('dialog', { name: '희망일/시간 선택' });
    expect(within(picker).getByRole('button', { name: '15:00' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(picker).getByRole('button', { name: '적용' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        desiredDateTime: '2026-07-04',
        pickupTime: '15:00',
        parsedDate: expect.objectContaining({
          isoDate: '2026-07-04',
          timeText: '15:00',
          isRelative: false,
        }),
        manuallyEditedFields: expect.arrayContaining(['desiredDateTime', 'pickupTime']),
      }),
    );
  });

  it('uses the same picker as a date-only flow for delivery orders', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tomorrow = addDaysIsoDate(1);

    render(
      <OrderDetail
        order={baseOrder({ desiredDateTime: '', fulfillmentType: '택배', pickupTime: '' })}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '희망일 선택' }));

    const picker = screen.getByRole('dialog', { name: '희망일 선택' });
    expect(within(picker).queryByRole('button', { name: '15:00' })).not.toBeInTheDocument();

    await user.click(within(picker).getByRole('button', { name: '내일' }));
    await user.click(within(picker).getByRole('button', { name: '적용' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        desiredDateTime: tomorrow,
        pickupTime: '',
        parsedDate: expect.objectContaining({
          isoDate: tomorrow,
        }),
        manuallyEditedFields: expect.arrayContaining(['desiredDateTime']),
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

    expect(screen.getByRole('button', { name: '희망일/시간 선택' })).toBeInTheDocument();
    expect(screen.queryByText('픽업 시간')).not.toBeInTheDocument();
    expect(screen.queryByText('택배 주소')).not.toBeInTheDocument();

    rerender(<OrderDetail order={baseOrder({ fulfillmentType: '택배' })} settings={DEFAULT_SETTINGS} onChange={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('택배 주소')).toBeInTheDocument();
    expect(screen.queryByText('픽업 시간')).not.toBeInTheDocument();
  });
});
