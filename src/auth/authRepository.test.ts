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
  membershipRows = [],
  getSessionError = null,
  signInError = null,
  signOutError = null,
  membershipError = null,
}: {
  currentSession?: SupabaseSessionMock | null;
  signInSession?: SupabaseSessionMock | null;
  membershipRows?: WorkspaceMembershipRowMock[];
  getSessionError?: Error | null;
  signInError?: Error | null;
  signOutError?: Error | null;
  membershipError?: Error | null;
} = {}) {
  const limit = vi.fn().mockResolvedValue({ data: membershipRows, error: membershipError });
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const unsubscribe = vi.fn();

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: currentSession }, error: getSessionError }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: signInSession }, error: signInError }),
      signOut: vi.fn().mockResolvedValue({ error: signOutError }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    },
    from,
    mocks: { eq, from, limit, order, select, unsubscribe },
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

  it('throws Supabase getSession errors', async () => {
    const error = new Error('session failed');
    const supabase = createSupabaseMock({ getSessionError: error });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getSession()).rejects.toThrow('session failed');
  });

  it('throws Supabase signIn errors', async () => {
    const error = new Error('sign in failed');
    const supabase = createSupabaseMock({ signInError: error });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.signIn('owner@lyru.test', 'secret')).rejects.toThrow('sign in failed');
  });

  it('throws Supabase signOut errors', async () => {
    const error = new Error('sign out failed');
    const supabase = createSupabaseMock({ signOutError: error });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.signOut()).rejects.toThrow('sign out failed');
  });

  it('returns null membership when there is no current session', async () => {
    const supabase = createSupabaseMock({ currentSession: null });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns null membership when no workspace row exists', async () => {
    const supabase = createSupabaseMock({ membershipRows: [] });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).resolves.toBeNull();
    expect(supabase.from).toHaveBeenCalledWith('workspace_members');
  });

  it('throws Supabase membership query errors', async () => {
    const error = new Error('membership failed');
    const supabase = createSupabaseMock({ membershipError: error });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).rejects.toThrow('membership failed');
  });

  it('returns workspace membership with workspace name', async () => {
    const supabase = createSupabaseMock({
      membershipRows: [
        {
          workspace_id: 'workspace-1',
          role: 'owner',
          workspaces: { name: '리루 작업실' },
        },
      ],
    });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.getWorkspaceMembership()).resolves.toEqual({
      workspaceId: 'workspace-1',
      workspaceName: '리루 작업실',
      role: 'owner',
    });
    expect(supabase.mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(supabase.mocks.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(supabase.mocks.limit).toHaveBeenCalledWith(1);
  });
});
