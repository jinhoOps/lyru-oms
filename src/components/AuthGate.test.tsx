import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthRepository, AuthSession, WorkspaceMembership } from '../auth/authTypes';
import { AuthGate } from './AuthGate';

const session: AuthSession = {
  userId: 'user-1',
  email: 'owner@lyru.test',
};

const membership: WorkspaceMembership = {
  workspaceId: 'workspace-1',
  workspaceName: '리루 작업실',
  role: 'owner',
};

function createAuthRepositoryMock({
  initialSession = null,
  signInSession = session,
  workspaceMembership = membership,
  signInError = null,
  signOutError = null,
}: {
  initialSession?: AuthSession | null;
  signInSession?: AuthSession;
  workspaceMembership?: WorkspaceMembership | null;
  signInError?: Error | null;
  signOutError?: Error | null;
} = {}): AuthRepository {
  return {
    getSession: vi.fn().mockResolvedValue(initialSession),
    signIn: signInError ? vi.fn().mockRejectedValue(signInError) : vi.fn().mockResolvedValue(signInSession),
    signOut: signOutError ? vi.fn().mockRejectedValue(signOutError) : vi.fn().mockResolvedValue(undefined),
    getWorkspaceMembership: vi.fn().mockResolvedValue(workspaceMembership),
    onSessionChange: vi.fn(() => vi.fn()),
  };
}

afterEach(() => {
  cleanup();
});

describe('AuthGate', () => {
  it('shows email and password login before session exists', async () => {
    const authRepository = createAuthRepositoryMock({ initialSession: null });

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    expect(await screen.findByRole('heading', { name: 'Lyru OMS 로그인' })).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
  });

  it('signs in and renders children when membership exists', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock({ initialSession: null, workspaceMembership: membership });

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    await user.type(await screen.findByLabelText('이메일'), 'owner@lyru.test');
    await user.type(screen.getByLabelText('비밀번호'), 'secret');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('주문 표준화 작업실')).toBeInTheDocument();
    expect(authRepository.signIn).toHaveBeenCalledWith('owner@lyru.test', 'secret');
  });

  it('shows a login error when sign-in fails and keeps children hidden', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock({
      initialSession: null,
      signInError: new Error('invalid credentials'),
    });

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    const emailInput = await screen.findByLabelText('이메일');
    const passwordInput = screen.getByLabelText('비밀번호');
    await user.type(emailInput, 'owner@lyru.test');
    await user.type(passwordInput, 'wrong');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('로그인 정보를 확인해 주세요.')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'authGateLoginError');
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
  });

  it('blocks authenticated users without workspace membership', async () => {
    const authRepository = createAuthRepositoryMock({
      initialSession: session,
      workspaceMembership: null,
    });

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    expect(await screen.findByRole('heading', { name: '작업실 접근 권한이 없습니다' })).toBeInTheDocument();
    expect(screen.getByText(/workspace_members/)).toBeInTheDocument();
    expect(screen.queryByText('주문 표준화 작업실')).not.toBeInTheDocument();
  });

  it('logs out from the blocked screen and returns to login', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock({
      initialSession: session,
      workspaceMembership: null,
    });

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    await screen.findByRole('heading', { name: '작업실 접근 권한이 없습니다' });
    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(authRepository.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Lyru OMS 로그인' })).toBeInTheDocument();
  });

  it('shows a Korean status if blocked screen logout fails', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock({
      initialSession: session,
      workspaceMembership: null,
      signOutError: new Error('network failed'),
    });

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    await screen.findByRole('heading', { name: '작업실 접근 권한이 없습니다' });
    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByText('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lyru OMS 로그인' })).not.toBeInTheDocument();
  });

  it('retries workspace loading from the blocked screen and can render children', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock({
      initialSession: session,
      workspaceMembership: null,
    });
    vi.mocked(authRepository.getWorkspaceMembership)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(membership);

    render(
      <AuthGate authRepository={authRepository}>
        <p>주문 표준화 작업실</p>
      </AuthGate>,
    );

    await screen.findByRole('heading', { name: '작업실 접근 권한이 없습니다' });
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('주문 표준화 작업실')).toBeInTheDocument();
    expect(authRepository.getWorkspaceMembership).toHaveBeenCalledTimes(2);
  });
});
