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
type WorkspaceMemberRpcRowMock = {
  user_id: string;
  email: string;
  role: 'owner' | 'staff';
  created_at: string;
};

function createSupabaseMock({
  currentSession = session,
  signInSession = session,
  membershipRows = [],
  rpcData = [],
  getSessionError = null,
  signInError = null,
  signOutError = null,
  updateUserError = null,
  membershipError = null,
  rpcError = null,
}: {
  currentSession?: SupabaseSessionMock | null;
  signInSession?: SupabaseSessionMock | null;
  membershipRows?: WorkspaceMembershipRowMock[];
  rpcData?: WorkspaceMemberRpcRowMock[];
  getSessionError?: Error | null;
  signInError?: Error | null;
  signOutError?: Error | null;
  updateUserError?: Error | null;
  membershipError?: Error | null;
  rpcError?: Error | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: membershipRows[0] ?? null, error: membershipError });
  const limit = vi.fn(() => ({ maybeSingle }));
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
      updateUser: vi.fn().mockResolvedValue({ data: { user: currentSession?.user ?? null }, error: updateUserError }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    },
    from,
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
    mocks: { eq, from, limit, maybeSingle, order, select, unsubscribe },
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

  it('changes password after confirming the current password', async () => {
    const supabase = createSupabaseMock();
    const repository = createAuthRepository(supabase as never);

    await expect(repository.changePassword('owner@lyru.test', 'old-secret', 'new-secret')).resolves.toBeUndefined();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@lyru.test',
      password: 'old-secret',
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
  });

  it('does not update password when current password confirmation fails', async () => {
    const supabase = createSupabaseMock({ signInError: new Error('invalid credentials') });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.changePassword('owner@lyru.test', 'wrong-secret', 'new-secret')).rejects.toThrow(
      'invalid credentials',
    );
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('throws updateUser errors when password update fails', async () => {
    const supabase = createSupabaseMock({ updateUserError: new Error('update failed') });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.changePassword('owner@lyru.test', 'old-secret', 'new-secret')).rejects.toThrow(
      'update failed',
    );
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
    expect(supabase.mocks.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('lists workspace members through RPC', async () => {
    const supabase = createSupabaseMock({
      rpcData: [
        {
          user_id: 'user-1',
          email: 'owner@lyru.test',
          role: 'owner',
          created_at: '2026-07-07T00:00:00.000Z',
        },
      ],
    });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.listWorkspaceMembers('workspace-1')).resolves.toEqual([
      {
        userId: 'user-1',
        email: 'owner@lyru.test',
        role: 'owner',
        createdAt: '2026-07-07T00:00:00.000Z',
      },
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith('list_workspace_members', {
      target_workspace_id: 'workspace-1',
    });
  });

  it('upserts a workspace member by email through RPC', async () => {
    const supabase = createSupabaseMock({
      rpcData: [
        {
          user_id: 'user-2',
          email: 'staff@lyru.test',
          role: 'staff',
          created_at: '2026-07-07T00:00:00.000Z',
        },
      ],
    });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.upsertWorkspaceMemberByEmail('workspace-1', 'staff@lyru.test', 'staff')).resolves.toEqual({
      userId: 'user-2',
      email: 'staff@lyru.test',
      role: 'staff',
      createdAt: '2026-07-07T00:00:00.000Z',
    });
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_workspace_member_by_email', {
      target_workspace_id: 'workspace-1',
      target_email: 'staff@lyru.test',
      target_role: 'staff',
    });
  });

  it('throws RPC errors when member management fails', async () => {
    const supabase = createSupabaseMock({ rpcError: new Error('not owner') });
    const repository = createAuthRepository(supabase as never);

    await expect(repository.listWorkspaceMembers('workspace-1')).rejects.toThrow('not owner');
  });
});
