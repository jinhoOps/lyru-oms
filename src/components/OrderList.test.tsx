import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ORDER_FIELDS, type CapturedOrder } from '../domain/orderTypes';
import { OrderList } from './OrderList';

const ddayFixture = {
  isoDate: '2026-07-03',
  title: '2026년 7월 3일',
};

const order: CapturedOrder = {
  id: '1',
  source: '카카오톡 채널',
  rawText: '성함: 김리루',
  ...EMPTY_ORDER_FIELDS,
  customerName: '김리루',
  orderItems: '곶감밀푀유',
  quantity: '5',
  menuMatches: [
    {
      menuId: 'dates-wood-9',
      label: '대추야자 오동나무 9구 세트',
      unitCount: 9,
      confidence: 'exact',
    },
  ],
  quantityCandidates: [{ value: 180, unit: '개', rawText: '180개' }],
  parsedDate: {
    isoDate: ddayFixture.isoDate,
    timeText: '',
    originalText: ddayFixture.isoDate,
    isRelative: false,
  },
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: ['phone'],
  reviewReasons: [
    {
      kind: '정보 부족',
      group: 'info',
      code: 'missing-field',
      field: 'phone',
      label: '연락처',
      message: '연락처 정보가 비어 있어요.',
    },
    {
      kind: '확인필요',
      group: 'check',
      code: 'event-purpose',
      label: '행사 주문',
      message: '행사 일정은 한 번 더 확인이 필요합니다.',
      detail: '상견례 용도로 보입니다.',
    },
  ],
  warningLevel: 'attention',
  status: '확인 필요',
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
};

const renderOrderList = (overrides: Partial<ComponentProps<typeof OrderList>> = {}) => {
  const props: ComponentProps<typeof OrderList> = {
    orders: [order],
    totalOrderCount: 1,
    selectedId: null,
    sortMode: 'desiredDate',
    sourceFilter: '전체',
    onSortModeChange: vi.fn(),
    onSourceFilterChange: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };

  return render(<OrderList {...props} />);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T03:00:00.000Z'));
});

describe('OrderList', () => {
  it('does not show full raw text until expanded for information shortage', () => {
    renderOrderList();
    expect(screen.queryByText('성함: 김리루')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('성함: 김리루')).toBeInTheDocument();
  });

  it('switches to compact list mode and hides raw text expansion', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '목록형 보기' }));

    expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록형 보기' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only essential fields in compact list mode', () => {
    renderOrderList({
      orders: [{ ...order, desiredDateTime: '7월 3일', fulfillmentType: '픽업', customerRequestNote: '리본 포장' }],
    });

    fireEvent.click(screen.getByRole('button', { name: '목록형 보기' }));

    expect(screen.getAllByText('확인 필요')).toHaveLength(2);
    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
    expect(screen.queryByText('곶감밀푀유 · 5개')).not.toBeInTheDocument();
    expect(screen.getByText('채워야 할 정보 1개')).toBeInTheDocument();
    expect(screen.getByText('확인할 내용 1개')).toBeInTheDocument();
    expect(screen.getByText('7월 3일 · 픽업')).toBeInTheDocument();
    const compactOrderButton = screen.getByRole('button', { name: /곶감밀푀유 · 5/ });
    expect(within(compactOrderButton).queryByText('카카오톡 채널')).not.toBeInTheDocument();
    expect(within(compactOrderButton).queryByText('김리루')).not.toBeInTheDocument();
    expect(within(compactOrderButton).queryByText('고객 요청 있음')).not.toBeInTheDocument();
  });

  it('shows fulfillment type in the primary list fields', () => {
    renderOrderList({ orders: [{ ...order, fulfillmentType: '픽업' }] });

    expect(screen.getByText('희망일 미정 · 픽업')).toBeInTheDocument();
  });

  it('shows fallback when fulfillment type is empty', () => {
    renderOrderList({ orders: [{ ...order, fulfillmentType: '' }] });

    expect(screen.getByText('희망일 미정 · 수령 방식 없음')).toBeInTheDocument();
  });

  it('shows registered date up to the minute', () => {
    renderOrderList();

    expect(screen.getByText('등록 2026-06-30 09:00')).toBeInTheDocument();
  });

  it('shows D-Day badge and review reason counts in card mode', () => {
    renderOrderList();

    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
    expect(screen.getByText('채워야 할 정보 1개')).toBeInTheDocument();
    expect(screen.getByText('확인할 내용 1개')).toBeInTheDocument();
    expect(screen.queryByText('대추야자 오동나무 9구 세트')).not.toBeInTheDocument();
    expect(screen.queryByText('180개')).not.toBeInTheDocument();
  });

  it('uses desired date text for D-Day when parsed metadata is missing', () => {
    renderOrderList({ orders: [{ ...order, desiredDateTime: '2026-07-03', parsedDate: null }] });

    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('2026-07-03 · 수령 방식 없음')).toBeInTheDocument();
  });

  it('uses missing fields as a fallback when info review reasons are missing', () => {
    renderOrderList({ orders: [{ ...order, missingFields: ['phone', 'fulfillmentType'], reviewReasons: [] }] });

    expect(screen.getByText('채워야 할 정보 2개')).toBeInTheDocument();
  });

  it('shows sort controls separately from view controls', () => {
    const onSortModeChange = vi.fn();

    renderOrderList({ onSortModeChange });

    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'quantityDesc' } });

    expect(onSortModeChange).toHaveBeenCalledWith('quantityDesc');
    expect(screen.getByRole('button', { name: '카드형 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록형 보기' })).toBeInTheDocument();
  });

  it('renders visible count and emits source filter changes', () => {
    const onSourceFilterChange = vi.fn();
    const naverOrder = { ...order, source: '네이버 스마트스토어' as const };

    renderOrderList({ orders: [naverOrder], sourceFilter: '네이버 스마트스토어', onSourceFilterChange });

    expect(screen.getByText('1건')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('주문 목록 출처'), { target: { value: '카카오톡 채널' } });

    expect(onSourceFilterChange).toHaveBeenCalledWith('카카오톡 채널');
  });

  it('distinguishes no saved orders from filtered-out orders', () => {
    const { rerender } = renderOrderList({ orders: [], totalOrderCount: 0 });

    expect(screen.getByText('아직 저장된 주문이 없습니다.')).toBeInTheDocument();

    rerender(
      <OrderList
        orders={[]}
        totalOrderCount={1}
        selectedId={null}
        sortMode="desiredDate"
        sourceFilter="네이버 스마트스토어"
        onSortModeChange={vi.fn()}
        onSourceFilterChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('선택한 출처의 주문이 없습니다.')).toBeInTheDocument();
  });

  it('shows change confirmation badge for unconfirmed change requests', () => {
    renderOrderList({
      orders: [{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: false }],
    });

    expect(screen.getByText('변경 확인 필요')).toBeInTheDocument();
  });

  it('hides change confirmation badge after change request is confirmed', () => {
    renderOrderList({
      orders: [{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: true }],
    });

    expect(screen.queryByText('변경 확인 필요')).not.toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
