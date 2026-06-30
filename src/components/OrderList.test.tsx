import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('OrderList', () => {
  it('does not show full raw text until expanded for information shortage', async () => {
    render(<OrderList orders={[order]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText('성함: 김리루')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('성함: 김리루')).toBeInTheDocument();
  });
});
