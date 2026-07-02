import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-01T03:00:00.000Z'));
});

describe('OrderList', () => {
  it('does not show full raw text until expanded for information shortage', () => {
    render(
      <OrderList
        orders={[order]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText('성함: 김리루')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('성함: 김리루')).toBeInTheDocument();
  });

  it('switches to compact list mode and hides raw text expansion', () => {
    render(
      <OrderList
        orders={[order]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '목록형 보기' }));

    expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록형 보기' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only essential fields in compact list mode', () => {
    render(
      <OrderList
        orders={[{ ...order, desiredDateTime: '7월 3일', fulfillmentType: '픽업', customerRequestNote: '리본 포장' }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '목록형 보기' }));

    expect(screen.getAllByText('확인 필요')).toHaveLength(2);
    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
    expect(screen.queryByText('곶감밀푀유 · 5개')).not.toBeInTheDocument();
    expect(screen.getByText('채워야 할 정보 1개')).toBeInTheDocument();
    expect(screen.getByText('확인할 내용 1개')).toBeInTheDocument();
    expect(screen.getByText('7월 3일 · 픽업')).toBeInTheDocument();
    expect(screen.queryByText('카카오톡 채널')).not.toBeInTheDocument();
    expect(screen.queryByText('김리루')).not.toBeInTheDocument();
    expect(screen.queryByText('고객 요청 있음')).not.toBeInTheDocument();
  });

  it('shows fulfillment type in the primary list fields', () => {
    render(
      <OrderList
        orders={[{ ...order, fulfillmentType: '픽업' }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('희망일 미정 · 픽업')).toBeInTheDocument();
  });

  it('shows fallback when fulfillment type is empty', () => {
    render(
      <OrderList
        orders={[{ ...order, fulfillmentType: '' }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('희망일 미정 · 수령 방식 없음')).toBeInTheDocument();
  });

  it('shows registered date up to the minute', () => {
    render(
      <OrderList
        orders={[order]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('등록 2026-06-30 09:00')).toBeInTheDocument();
  });

  it('shows D-Day badge and review reason counts in card mode', () => {
    render(
      <OrderList
        orders={[order]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('곶감밀푀유 · 5')).toBeInTheDocument();
    expect(screen.getByText('채워야 할 정보 1개')).toBeInTheDocument();
    expect(screen.getByText('확인할 내용 1개')).toBeInTheDocument();
    expect(screen.queryByText('대추야자 오동나무 9구 세트')).not.toBeInTheDocument();
    expect(screen.queryByText('180개')).not.toBeInTheDocument();
  });

  it('uses desired date text for D-Day when parsed metadata is missing', () => {
    render(
      <OrderList
        orders={[{ ...order, desiredDateTime: '2026-07-03', parsedDate: null }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('D-2')).toHaveAttribute('title', ddayFixture.title);
    expect(screen.getByText('2026-07-03 · 수령 방식 없음')).toBeInTheDocument();
  });

  it('uses missing fields as a fallback when info review reasons are missing', () => {
    render(
      <OrderList
        orders={[{ ...order, missingFields: ['phone', 'fulfillmentType'], reviewReasons: [] }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('채워야 할 정보 2개')).toBeInTheDocument();
  });

  it('shows sort controls separately from view controls', () => {
    const onSortModeChange = vi.fn();

    render(
      <OrderList
        orders={[order]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={onSortModeChange}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'quantityDesc' } });

    expect(onSortModeChange).toHaveBeenCalledWith('quantityDesc');
    expect(screen.getByRole('button', { name: '카드형 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록형 보기' })).toBeInTheDocument();
  });

  it('shows change confirmation badge for unconfirmed change requests', () => {
    render(
      <OrderList
        orders={[{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: false }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('변경 확인 필요')).toBeInTheDocument();
  });

  it('hides change confirmation badge after change request is confirmed', () => {
    render(
      <OrderList
        orders={[{ ...order, changeRequestNote: '픽업 시간을 오후 3시로 변경', changeRequestConfirmed: true }]}
        selectedId={null}
        sortMode="desiredDate"
        onSortModeChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText('변경 확인 필요')).not.toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
