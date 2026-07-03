import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_GRANTED_KEY, AccessGate } from './AccessGate';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('AccessGate', () => {
  it('hides the app behind a passcode screen until unlocked', () => {
    render(
      <AccessGate>
        <p>주문 표준화 작업실</p>
      </AccessGate>,
    );

    expect(screen.getByRole('heading', { name: 'Lyru OMS' })).toBeInTheDocument();
    expect(screen.getByLabelText('패스코드')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
  });

  it('unlocks the app and caches access when the passcode matches', async () => {
    const user = userEvent.setup();

    render(
      <AccessGate>
        <p>주문 표준화 작업실</p>
      </AccessGate>,
    );

    await user.type(screen.getByLabelText('패스코드'), '9999');
    await user.click(screen.getByRole('button', { name: '입장' }));

    expect(await screen.findByText('작업실 준비 중')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
    expect(await screen.findByText('주문 표준화 작업실', undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByLabelText('패스코드')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_GRANTED_KEY)).toBe('true');
  });

  it('keeps the app locked when the passcode does not match', async () => {
    const user = userEvent.setup();

    render(
      <AccessGate>
        <p>주문 표준화 작업실</p>
      </AccessGate>,
    );

    await user.type(screen.getByLabelText('패스코드'), '1234');
    await user.click(screen.getByRole('button', { name: '입장' }));

    expect(await screen.findByText('패스코드가 맞지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_GRANTED_KEY)).toBeNull();
  });

  it('shows the cached app after the 1.2 second preparation beat', async () => {
    vi.useFakeTimers();
    localStorage.setItem(ACCESS_GRANTED_KEY, 'true');

    render(
      <AccessGate>
        <p>주문 표준화 작업실</p>
      </AccessGate>,
    );

    expect(screen.getByText('작업실 준비 중')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1199);
    });

    expect(screen.getByText('작업실 준비 중')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.getByText('주문 표준화 작업실')).toBeInTheDocument();
    expect(screen.queryByLabelText('패스코드')).not.toBeInTheDocument();
  });
});
