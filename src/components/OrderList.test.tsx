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
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: ['phone'],
  reviewReasons: [{ kind: '정보 부족', field: 'phone', message: '연락처 정보가 비어 있어요.' }],
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
