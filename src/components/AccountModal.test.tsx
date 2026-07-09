import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthRepository, WorkspaceMembership } from '../auth/authTypes';
import { AccountModal } from './AccountModal';

const ownerMembership: WorkspaceMembership = {
  workspaceId: 'workspace-1',
  workspaceName: '리루 작업실',
  role: 'owner',
};

function createAuthRepositoryMock(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    changePassword: vi.fn().mockResolvedValue(undefined),
    getWorkspaceMembership: vi.fn(),
    listWorkspaceMembers: vi.fn().mockResolvedValue([
      {
        userId: 'user-1',
        email: 'okho04@gmail.com',
        role: 'owner',
        createdAt: '2026-07-07T00:00:00.000Z',
      },
    ]),
    upsertWorkspaceMemberByEmail: vi.fn().mockResolvedValue({
      userId: 'user-2',
      email: 'jsss2536@naver.com',
      role: 'owner',
      createdAt: '2026-07-07T00:00:00.000Z',
    }),
    onSessionChange: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('AccountModal', () => {
  it('changes password after validating confirmation fields', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock();

    render(
      <AccountModal
        open
        currentEmail="okho04@gmail.com"
        membership={ownerMembership}
        authRepository={authRepository}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('현재 비밀번호'), 'old-secret');
    await user.type(screen.getByLabelText('새 비밀번호'), 'new-secret');
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'new-secret');
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(() => {
      expect(authRepository.changePassword).toHaveBeenCalledWith('okho04@gmail.com', 'old-secret', 'new-secret');
    });
    expect(await screen.findByText('비밀번호를 변경했습니다.')).toBeInTheDocument();
  });

  it('blocks mismatched new password confirmation', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock();

    render(
      <AccountModal
        open
        currentEmail="okho04@gmail.com"
        membership={ownerMembership}
        authRepository={authRepository}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('현재 비밀번호'), 'old-secret');
    await user.type(screen.getByLabelText('새 비밀번호'), 'new-secret');
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'different-secret');
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('새 비밀번호 확인이 일치하지 않습니다.');
    expect(authRepository.changePassword).not.toHaveBeenCalled();
  });

  it('shows owner member management and grants owner role by email', async () => {
    const user = userEvent.setup();
    const authRepository = createAuthRepositoryMock({
      listWorkspaceMembers: vi
        .fn()
        .mockResolvedValueOnce([
          {
            userId: 'user-1',
            email: 'okho04@gmail.com',
            role: 'owner',
            createdAt: '2026-07-07T00:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([
          {
            userId: 'user-1',
            email: 'okho04@gmail.com',
            role: 'owner',
            createdAt: '2026-07-07T00:00:00.000Z',
          },
          {
            userId: 'user-2',
            email: 'jsss2536@naver.com',
            role: 'owner',
            createdAt: '2026-07-07T00:00:00.000Z',
          },
        ]),
    });

    render(
      <AccountModal
        open
        currentEmail="okho04@gmail.com"
        membership={ownerMembership}
        authRepository={authRepository}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('okho04@gmail.com')).toBeInTheDocument();
    const adminSection = screen.getByLabelText('작업실 멤버');
    expect(within(adminSection).getByText('관리자')).toBeInTheDocument();

    await user.type(screen.getByLabelText('이메일'), 'jsss2536@naver.com');
    await user.selectOptions(screen.getByLabelText('권한'), 'owner');
    await user.click(screen.getByRole('button', { name: '권한 저장' }));

    await waitFor(() => {
      expect(authRepository.upsertWorkspaceMemberByEmail).toHaveBeenCalledWith(
        'workspace-1',
        'jsss2536@naver.com',
        'owner',
      );
    });
    expect(await screen.findByText('멤버 권한을 저장했습니다.')).toBeInTheDocument();
    expect(await screen.findByText('jsss2536@naver.com')).toBeInTheDocument();
  });

  it('explains when account management RPC migrations are missing', async () => {
    const authRepository = createAuthRepositoryMock({
      listWorkspaceMembers: vi.fn().mockRejectedValue(new Error('Could not find the function public.list_workspace_members')),
    });

    render(
      <AccountModal
        open
        currentEmail="okho04@gmail.com"
        membership={ownerMembership}
        authRepository={authRepository}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '계정관리 DB 설정이 아직 적용되지 않았습니다. Supabase migration을 먼저 반영해 주세요.',
    );
  });

  it('hides member management from staff users', () => {
    const authRepository = createAuthRepositoryMock();

    render(
      <AccountModal
        open
        currentEmail="staff@lyru.test"
        membership={{ ...ownerMembership, role: 'staff' }}
        authRepository={authRepository}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading', { name: '관리자 권한' })).not.toBeInTheDocument();
    expect(authRepository.listWorkspaceMembers).not.toHaveBeenCalled();
  });
});
