import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthRepository } from './authRepository';

const session = {
  user: {
    id: 'user-1',
    email: 'owner@lyru.test',
  },
};

type SupabaseSessionMock = typeof session;
type WorkspaceMembershipRowMock = {
  workspace_id: string;
  role: 'owner' | 'staff';
  workspaces: { name: string } | { name: string }[] | null;
};

function createSupabaseMock({
  currentSession = session,
  signInSession = session,
  membershipRow = null,
}: {
  currentSession?: SupabaseSessionMock | null;
  signInSession?: SupabaseSessionMock | null;
  membershipRow?: WorkspaceMembershipRowMock | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: membershipRow, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const unsubscribe = vi.fn();

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: currentSession }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: signInSession }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    },
    from,
    mocks: { eq, from, maybeSingle, select, unsubscribe },
  };
}

describe('authRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current session', async () => {
    const supabase = createSupabaseMock();
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getSession()).resolves.toEqual({
      userId: 'user-1',
      email: 'owner@lyru.test',
    });
  });

  it('signs in with email and password', async () => {
    const supabase = createSupabaseMock();
    const repository = createAuthRepository(supabase as never);

    await expect(repository.signIn('owner@lyru.test', 'secret')).resolves.toEqual({
      userId: 'user-1',
      email: 'owner@lyru.test',
    });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@lyru.test',
      password: 'secret',
    });
  });

  it('returns null membership when there is no current session', async () => {
    const supabase = createSupabaseMock({ currentSession: null });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns null membership when no workspace row exists', async () => {
    const supabase = createSupabaseMock({ membershipRow: null });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).resolves.toBeNull();
    expect(supabase.from).toHaveBeenCalledWith('workspace_members');
  });

  it('returns workspace membership with workspace name', async () => {
    const supabase = createSupabaseMock({
      membershipRow: {
        workspace_id: 'workspace-1',
        role: 'owner',
        workspaces: { name: '리루 작업실' },
      },
    });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).resolves.toEqual({
      workspaceId: 'workspace-1',
      workspaceName: '리루 작업실',
      role: 'owner',
    });
    expect(supabase.mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
