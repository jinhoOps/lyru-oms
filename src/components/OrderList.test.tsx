import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ORDER_FIELDS, type CapturedOrder } from '../domain/orderTypes';
import { OrderList } from './OrderList';

const order: CapturedOrder = {
  id: '1',
  source: '카카오톡 채널',
  rawText: '성함: 김리루',
  ...EMPTY_ORDER_FIELDS,
  customerName: '김리루',
  orderItems: '곶감밀푀유',
  quantity: '5',
  menuMatches: [],
  quantityCandidates: [],
  parsedDate: null,
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
  ],
  warningLevel: 'attention',
  status: '확인필요',
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
});

describe('OrderList', () => {
  it('does not show full raw text until expanded for information shortage', async () => {
    render(<OrderList orders={[order]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText('성함: 김리루')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('성함: 김리루')).toBeInTheDocument();
  });

  it('switches to compact list mode and hides raw text expansion', async () => {
    render(<OrderList orders={[order]} selectedId={null} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: '목록형 보기' }));

    expect(screen.queryByRole('button', { name: '원문 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '목록형 보기' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only essential fields in compact list mode', async () => {
    render(
      <OrderList
        orders={[{ ...order, desiredDateTime: '7월 3일', fulfillmentType: '픽업', customerRequestNote: '리본 포장' }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '목록형 보기' }));

    expect(screen.getByText('확인필요')).toBeInTheDocument();
    expect(screen.getByText('곶감밀푀유 · 5개')).toBeInTheDocument();
    expect(screen.getByText('7월 3일 · 픽업')).toBeInTheDocument();
    expect(screen.queryByText('카카오톡 채널')).not.toBeInTheDocument();
    expect(screen.queryByText('김리루')).not.toBeInTheDocument();
    expect(screen.queryByText('고객 요청 있음')).not.toBeInTheDocument();
  });

  it('shows fulfillment type in the primary list fields', () => {
    render(<OrderList orders={[{ ...order, fulfillmentType: '픽업' }]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('희망일 미정 · 픽업')).toBeInTheDocument();
  });

  it('shows fallback when fulfillment type is empty', () => {
    render(<OrderList orders={[{ ...order, fulfillmentType: '' }]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('희망일 미정 · 수령 방식 없음')).toBeInTheDocument();
  });

  it('shows registered date up to the minute', () => {
    render(<OrderList orders={[order]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('등록 2026-06-30 09:00')).toBeInTheDocument();
  });
});
