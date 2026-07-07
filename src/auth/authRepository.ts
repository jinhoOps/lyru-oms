import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthRepository,
  AuthSession,
  WorkspaceMembership,
  WorkspaceMemberSummary,
  WorkspaceRole,
} from './authTypes';

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { name: string } | { name: string }[] | null;
};

type WorkspaceMemberRpcRow = {
  user_id: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
};

export function toAuthSession(session: Session | null): AuthSession | null {
  const userId = session?.user.id;
  const email = session?.user.email;

  if (!userId || !email) {
    return null;
  }

  return { userId, email };
}

function getWorkspaceName(workspaces: WorkspaceMembershipRow['workspaces']) {
  if (Array.isArray(workspaces)) {
    return workspaces[0]?.name ?? '';
  }

  return workspaces?.name ?? '';
}

function mapWorkspaceMember(row: WorkspaceMemberRpcRow): WorkspaceMemberSummary {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function createAuthRepository(supabase: SupabaseClient): AuthRepository {
  async function getSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return toAuthSession(data.session);
  }

  return {
    getSession,
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      const session = toAuthSession(data.session);
      if (!session) {
        throw new Error('로그인 세션을 확인할 수 없습니다.');
      }

      return session;
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },
    async changePassword(email, currentPassword, newPassword) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });

      if (signInError) {
        throw signInError;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        throw updateError;
      }
    },
    async getWorkspaceMembership() {
      const session = await getSession();
      if (!session) {
        return null;
      }

      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(name)')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle<WorkspaceMembershipRow>();

      if (error) {
        throw error;
      }

      const row = data;
      if (!row) {
        return null;
      }

      const membership: WorkspaceMembership = {
        workspaceId: row.workspace_id,
        workspaceName: getWorkspaceName(row.workspaces),
        role: row.role,
      };

      return membership;
    },
    async listWorkspaceMembers(workspaceId) {
      const { data, error } = await supabase.rpc('list_workspace_members', {
        target_workspace_id: workspaceId,
      });

      if (error) {
        throw error;
      }

      return ((data ?? []) as WorkspaceMemberRpcRow[]).map(mapWorkspaceMember);
    },
    async upsertWorkspaceMemberByEmail(workspaceId, email, role) {
      const { data, error } = await supabase.rpc('upsert_workspace_member_by_email', {
        target_workspace_id: workspaceId,
        target_email: email,
        target_role: role,
      });

      if (error) {
        throw error;
      }

      const [row] = (data ?? []) as WorkspaceMemberRpcRow[];
      if (!row) {
        throw new Error('멤버 권한 저장 결과를 확인할 수 없습니다.');
      }

      return mapWorkspaceMember(row);
    },
    onSessionChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(toAuthSession(session));
      });

      return () => data.subscription.unsubscribe();
    },
  };
}
