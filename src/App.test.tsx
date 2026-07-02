import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { ACCESS_GRANTED_KEY } from './components/AccessGate';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(ACCESS_GRANTED_KEY, 'true');
});

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('keeps owner questions hidden behind the header note control', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByLabelText('주문/문의 원문')).toBeInTheDocument();
    expect(screen.queryByText('아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.getByRole('region', { name: '확인 질문 쪽지' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '관리 설정' })).toBeInTheDocument();
  });

  it('re-evaluates existing orders when quantity settings change', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(
      screen.getByLabelText('주문/문의 원문'),
      `화과자 9구
5세트
2026-07-03
픽업`,
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

    expect(screen.getByText('확인할 내용 1개')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '관리 설정' }));
    const settingsDialog = screen.getByRole('dialog', { name: '정보 부족 기준' });
    await user.clear(within(settingsDialog).getByLabelText('대량 기준 실수량'));
    await user.type(within(settingsDialog).getByLabelText('대량 기준 실수량'), '100');
    await user.click(within(settingsDialog).getByRole('button', { name: '저장' }));

    expect(screen.queryByText('확인할 내용 1개')).not.toBeInTheDocument();
  });
});
