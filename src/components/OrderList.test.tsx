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
    onClearOrders: vi.fn(),
    ...overrides,
  };

  return render(<OrderList {...props} />);
};

const openViewMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: '보기' }));
  return screen.getByRole('radiogroup', { name: '보기 방식' });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T03:00:00.000Z'));
  localStorage.clear();
});

describe('OrderList', () => {
  it('does not show full raw text until expanded for information shortage', () => {
    renderOrderList();
    const viewGroup = openViewMenu();
    fireEvent.click(within(viewGroup).getByRole('radio', { name: '카드형 보기' }));

    expect(screen.queryByText('성함: 김리루')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('성함: 김리루')).toBeInTheDocument();
  });

  it('defaults to compact list mode and hides raw text expansion', () => {
    renderOrderList();

    expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('radio', { name: '목록형 보기' })).toBeChecked();
  });

  it('persists card and list view mode changes', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '카드형 보기' }));
    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('card');
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('radio', { name: '카드형 보기' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: '목록형 보기' }));
    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('list');
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('radio', { name: '목록형 보기' })).toBeChecked();
  });

  it('opens calendar view with monthly mode by default', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('calendar');
    expect(screen.getByRole('radiogroup', { name: '달력 범위' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '월별' })).toBeChecked();
    expect(screen.getByLabelText('월별 주문 달력')).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: '월별 주문 달력' })).not.toBeInTheDocument();
  });

  it('persists calendar range mode separately from list view mode', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '2주' }));

    expect(localStorage.getItem('lyru-oms.orderList.viewMode.v1')).toBe('calendar');
    expect(localStorage.getItem('lyru-oms.orderList.calendarMode.v1')).toBe('twoWeek');

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '목록형 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    expect(screen.getByRole('radio', { name: '2주' })).toBeChecked();
  });

  it('shows the current Sunday through next Saturday in two-week calendar mode', () => {
    vi.setSystemTime(new Date('2026-07-06T03:00:00.000Z'));
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'two-week-range',
          customerName: '박기간',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-10',
          parsedDate: null,
          createdAt: '2026-07-05T00:30:00.000Z',
          updatedAt: '2026-07-05T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '2주' }));

    const calendar = screen.getByLabelText('2주 주문 달력');
    expect(screen.queryByRole('grid', { name: '2주 주문 달력' })).not.toBeInTheDocument();
    expect(within(calendar).getByText('7월 5일')).toBeInTheDocument();
    expect(within(calendar).getByText('7월 18일')).toBeInTheDocument();
    expect(within(calendar).queryByText('7월 19일')).not.toBeInTheDocument();
  });

  it('renders a multi-day order as one connected range per visible week instead of repeated daily chips', () => {
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'calendar-range',
          customerName: '박기간',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-03',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    const rangeButton = screen.getByRole('button', { name: /곶감단지 수량 2.*등록.*마감/ });
    expect(rangeButton).toBeInTheDocument();
    expect(within(rangeButton).getByText('곶감단지')).toBeInTheDocument();
    expect(within(rangeButton).getByText('2')).toHaveClass('calendarQuantityBadge');
    expect(within(rangeButton).queryByText('2세트')).not.toBeInTheDocument();
  });

  it('shows today orders once in daily mode with the correct range status', () => {
    vi.setSystemTime(new Date('2026-07-02T03:00:00.000Z'));
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'daily-progress',
          customerName: '박기간',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-03',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '일별' }));

    expect(screen.getByRole('heading', { name: '7월 2일' })).toBeInTheDocument();
    const dailyButton = screen.getByRole('button', { name: /곶감단지 수량 2.*진행 중/ });
    expect(dailyButton).toBeInTheDocument();
    expect(within(dailyButton).getByText('2')).toHaveClass('calendarQuantityBadge');
  });

  it('marks today orders as registered in daily mode when today is the start date', () => {
    vi.setSystemTime(new Date('2026-07-01T03:00:00.000Z'));
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'daily-start',
          customerName: '박등록',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-03',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '일별' }));

    expect(screen.getByRole('button', { name: /곶감단지 수량 2.*등록/ })).toBeInTheDocument();
  });

  it('marks today orders as closing in daily mode when today is the end date', () => {
    vi.setSystemTime(new Date('2026-07-03T03:00:00.000Z'));
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'daily-end',
          customerName: '박마감',
          orderItems: '곶감단지',
          quantity: '2세트',
          desiredDateTime: '2026-07-03',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '일별' }));

    expect(screen.getByRole('button', { name: /곶감단지 수량 2.*마감/ })).toBeInTheDocument();
  });

  it('keeps missing and invalid desired dates in the unresolved calendar group', () => {
    renderOrderList({
      orders: [
        {
          ...order,
          id: 'calendar-unresolved',
          customerName: '최확인',
          orderItems: '화과자',
          quantity: '4개',
          desiredDateTime: '',
          parsedDate: null,
        },
        {
          ...order,
          id: 'calendar-invalid',
          customerName: '문확인',
          orderItems: '양갱',
          quantity: '3개',
          desiredDateTime: '2026-06-29',
          parsedDate: null,
          createdAt: '2026-07-01T00:30:00.000Z',
          updatedAt: '2026-07-01T00:30:00.000Z',
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '달력형 보기' }));

    const unresolved = screen.getByRole('region', { name: '날짜 확인 필요' });
    expect(within(unresolved).getByRole('button', { name: /화과자 수량 4.*희망일 확인/ })).toBeInTheDocument();
    expect(within(unresolved).getByRole('button', { name: /양갱 수량 3.*기간 확인/ })).toBeInTheDocument();
  });

  it('keeps filtered-out empty state before rendering calendar view', () => {
    renderOrderList({ orders: [], totalOrderCount: 1, sourceFilter: '네이버 스마트스토어' });

    expect(screen.getByText('선택한 채널의 주문이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '날짜 확인 필요' })).not.toBeInTheDocument();
  });

  it('hydrates invalid stored view mode to compact list mode', () => {
    localStorage.setItem('lyru-oms.orderList.viewMode.v1', 'table');

    renderOrderList();

    expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('radio', { name: '목록형 보기' })).toBeChecked();
  });

  it('falls back to list mode when stored view mode cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    try {
      renderOrderList();

      fireEvent.click(screen.getByRole('button', { name: '보기' }));
      expect(screen.getByRole('radio', { name: '목록형 보기' })).toBeChecked();
    } finally {
      getItem.mockRestore();
    }
  });

  it('still switches view mode when storing the preference fails', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    try {
      renderOrderList();
      fireEvent.click(screen.getByRole('button', { name: '보기' }));
      fireEvent.click(screen.getByRole('radio', { name: '카드형 보기' }));

      fireEvent.click(screen.getByRole('button', { name: '보기' }));
      expect(screen.getByRole('radio', { name: '카드형 보기' })).toBeChecked();
    } finally {
      setItem.mockRestore();
    }
  });

  it('shows only essential fields in compact list mode', () => {
    renderOrderList({
      orders: [{ ...order, desiredDateTime: '7월 3일', fulfillmentType: '픽업', customerRequestNote: '리본 포장' }],
    });

    expect(screen.getAllByText('확인 필요')).toHaveLength(1);
    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
    expect(screen.queryByText('곶감밀푀유 · 5개')).not.toBeInTheDocument();
    expect(screen.getByText('정보 1개')).toBeInTheDocument();
    expect(screen.getByText('확인 1개')).toBeInTheDocument();
    expect(screen.getByText(/김리루 · 7월 3일 ·\s*픽업/)).toBeInTheDocument();
    const compactOrderButton = screen.getByRole('button', { name: /곶감밀푀유 · 5/ });
    expect(within(compactOrderButton).queryByText('카카오톡 채널')).not.toBeInTheDocument();
    expect(within(compactOrderButton).getByText(/김리루/)).toBeInTheDocument();
    expect(within(compactOrderButton).queryByText('고객 요청 있음')).not.toBeInTheDocument();
  });

  it('shows fulfillment type in the primary list fields', () => {
    renderOrderList({ orders: [{ ...order, fulfillmentType: '픽업' }] });

    expect(screen.getByText(/김리루 · 희망일 미정 ·\s*픽업/)).toBeInTheDocument();
  });

  it('shows fallback when fulfillment type is empty', () => {
    renderOrderList({ orders: [{ ...order, fulfillmentType: '' }] });

    expect(screen.getByText(/김리루 · 희망일 미정 ·\s*수령 방식 없음/)).toBeInTheDocument();
  });

  it('shows registered date up to the minute in card mode', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '카드형 보기' }));

    expect(screen.getByText('등록 2026-06-30 09:00')).toBeInTheDocument();
  });

  it('shows D-Day badge and review reason counts in card mode', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    fireEvent.click(screen.getByRole('radio', { name: '카드형 보기' }));

    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
    expect(screen.getByText('정보 1개')).toBeInTheDocument();
    expect(screen.getByText('확인 1개')).toBeInTheDocument();
    expect(screen.queryByText('대추야자 오동나무 9구 세트')).not.toBeInTheDocument();
    expect(screen.queryByText('180개')).not.toBeInTheDocument();
  });

  it('uses desired date text for D-Day when parsed metadata is missing', () => {
    renderOrderList({ orders: [{ ...order, desiredDateTime: '2026-07-03', parsedDate: null }] });

    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText(/김리루 · 2026-07-03 ·\s*수령 방식 없음/)).toBeInTheDocument();
  });

  it('uses missing fields as a fallback when info review reasons are missing', () => {
    renderOrderList({ orders: [{ ...order, missingFields: ['phone', 'fulfillmentType'], reviewReasons: [] }] });

    expect(screen.getByText('정보 2개')).toBeInTheDocument();
  });

  it('opens sort menu, chooses a sort mode, and closes the menu', () => {
    const onSortModeChange = vi.fn();

    renderOrderList({ onSortModeChange, sortMode: 'desiredDate' });

    fireEvent.click(screen.getByRole('button', { name: '정렬' }));
    const sortGroup = screen.getByRole('radiogroup', { name: '정렬 방식' });

    expect(within(sortGroup).getByRole('radio', { name: '희망일 빠른 순' })).toBeChecked();

    fireEvent.click(within(sortGroup).getByRole('radio', { name: '수량 많은 순' }));

    expect(onSortModeChange).toHaveBeenCalledWith('quantityDesc');
    expect(screen.queryByRole('radiogroup', { name: '정렬 방식' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '보기' })).toBeInTheDocument();
  });

  it('uses native radio controls in the sort menu', () => {
    renderOrderList({ sortMode: 'quantityDesc' });

    fireEvent.click(screen.getByRole('button', { name: '정렬' }));
    const sortGroup = screen.getByRole('radiogroup', { name: '정렬 방식' });
    const quantitySort = within(sortGroup).getByRole('radio', { name: '수량 많은 순' });

    expect(quantitySort).toBeInstanceOf(HTMLInputElement);
    expect(quantitySort).toHaveAttribute('type', 'radio');
    expect(quantitySort).toBeChecked();
  });

  it('closes sort menu on Escape', () => {
    renderOrderList();

    const sortButton = screen.getByRole('button', { name: '정렬' });
    fireEvent.click(sortButton);
    expect(screen.getByRole('radiogroup', { name: '정렬 방식' })).toBeInTheDocument();

    fireEvent.keyDown(sortButton, { key: 'Escape' });

    expect(screen.queryByRole('radiogroup', { name: '정렬 방식' })).not.toBeInTheDocument();
  });

  it('closes sort menu on Escape from a radio inside the panel', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '정렬' }));
    const sortGroup = screen.getByRole('radiogroup', { name: '정렬 방식' });
    const quantitySort = within(sortGroup).getByRole('radio', { name: '수량 많은 순' });
    quantitySort.focus();

    fireEvent.keyDown(quantitySort, { key: 'Escape' });

    expect(screen.queryByRole('radiogroup', { name: '정렬 방식' })).not.toBeInTheDocument();
  });

  it('closes sort menu when focus leaves the menu area', () => {
    renderOrderList();

    const sortButton = screen.getByRole('button', { name: '정렬' });
    const viewButton = screen.getByRole('button', { name: '보기' });
    fireEvent.click(sortButton);
    expect(screen.getByRole('radiogroup', { name: '정렬 방식' })).toBeInTheDocument();

    fireEvent.blur(sortButton.parentElement as HTMLElement, { relatedTarget: viewButton });
    vi.runOnlyPendingTimers();

    expect(screen.queryByRole('radiogroup', { name: '정렬 방식' })).not.toBeInTheDocument();
  });

  it('keeps sort choice clickable when blur fires before the radio change', () => {
    const onSortModeChange = vi.fn();
    renderOrderList({ onSortModeChange });

    const sortButton = screen.getByRole('button', { name: '정렬' });
    fireEvent.click(sortButton);
    fireEvent.blur(sortButton, { relatedTarget: null });

    fireEvent.click(screen.getByRole('radio', { name: '수량 많은 순' }));
    vi.runOnlyPendingTimers();

    expect(onSortModeChange).toHaveBeenCalledWith('quantityDesc');
    expect(screen.queryByRole('radiogroup', { name: '정렬 방식' })).not.toBeInTheDocument();
  });

  it('keeps view choice clickable when blur fires before the radio change', () => {
    renderOrderList();

    const viewButton = screen.getByRole('button', { name: '보기' });
    fireEvent.click(viewButton);
    fireEvent.blur(viewButton, { relatedTarget: null });

    fireEvent.click(screen.getByRole('radio', { name: '카드형 보기' }));
    vi.runOnlyPendingTimers();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('radio', { name: '카드형 보기' })).toBeChecked();
  });

  it('keeps only one toolbar menu open at a time', () => {
    renderOrderList();

    fireEvent.click(screen.getByRole('button', { name: '정렬' }));
    expect(screen.getByRole('radiogroup', { name: '정렬 방식' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '보기' }));

    expect(screen.queryByRole('radiogroup', { name: '정렬 방식' })).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '보기 방식' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '작업' }));

    expect(screen.queryByRole('radiogroup', { name: '보기 방식' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: '주문 목록 작업' })).toBeInTheDocument();
  });

  it('keeps destructive list actions inside the action menu', () => {
    const onClearOrders = vi.fn();
    renderOrderList({ onClearOrders });

    expect(screen.queryByRole('button', { name: '전체 삭제' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '작업' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '전체 삭제' }));

    expect(onClearOrders).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: '주문 목록 작업' })).not.toBeInTheDocument();
  });

  it('renders visible count and emits source filter changes from the channel menu', () => {
    const onSourceFilterChange = vi.fn();
    const naverOrder = { ...order, source: '네이버 스마트스토어' as const };

    renderOrderList({ orders: [naverOrder], sourceFilter: '네이버 스마트스토어', onSourceFilterChange });

    expect(screen.getByText('1건')).toBeInTheDocument();
    expect(screen.queryByLabelText('주문 목록 채널')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '채널: 네이버 스마트스토어' }));
    const channelGroup = screen.getByRole('radiogroup', { name: '주문 목록 채널' });
    expect(within(channelGroup).getByRole('radio', { name: '네이버 스마트스토어' })).toBeChecked();

    fireEvent.click(within(channelGroup).getByRole('radio', { name: '카카오톡 채널' }));

    expect(onSourceFilterChange).toHaveBeenCalledWith('카카오톡 채널');
    expect(screen.queryByRole('radiogroup', { name: '주문 목록 채널' })).not.toBeInTheDocument();
  });

  it('places the visible count next to the order list heading', () => {
    renderOrderList();

    const titleLine = screen.getByText('주문 목록').parentElement as HTMLElement;

    expect(within(titleLine).getByText('1건')).toBeInTheDocument();
  });

  it('marks rows with status-specific classes', () => {
    renderOrderList({ orders: [{ ...order, status: '발송 완료', warningLevel: 'none', reviewReasons: [], missingFields: [] }] });

    expect(screen.getByRole('article')).toHaveClass('status-shipped');
    expect(screen.getByText('발송 완료')).toHaveClass('status-shipped');
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
        onClearOrders={vi.fn()}
      />,
    );

    expect(screen.getByText('선택한 채널의 주문이 없습니다.')).toBeInTheDocument();
  });

  it('shows change confirmation badge for unconfirmed change requests', () => {
    renderOrderList({
      orders: [{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: false }],
    });

    expect(screen.getByText('변경 확인 필요')).toBeInTheDocument();
  });

  it('shows change confirmation badge in list mode even without other review reasons', () => {
    renderOrderList({
      orders: [
        {
          ...order,
          changeRequestNote: '픽업 시간을 오후 3시로 변경',
          changeRequestConfirmed: false,
          missingFields: [],
          reviewReasons: [],
          warningLevel: 'none',
        },
      ],
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
