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
}: {
  initialSession?: AuthSession | null;
  signInSession?: AuthSession;
  workspaceMembership?: WorkspaceMembership | null;
} = {}): AuthRepository {
  return {
    getSession: vi.fn().mockResolvedValue(initialSession),
    signIn: vi.fn().mockResolvedValue(signInSession),
    signOut: vi.fn().mockResolvedValue(undefined),
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
});
