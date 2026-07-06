import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AuthRepository, AuthSession, WorkspaceMembership, WorkspaceRole } from './authTypes';

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { name: string } | { name: string }[] | null;
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
    async getWorkspaceMembership() {
      const session = await getSession();
      if (!session) {
        return null;
      }

      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(name)')
        .eq('user_id', session.userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      const row = data as WorkspaceMembershipRow;
      const membership: WorkspaceMembership = {
        workspaceId: row.workspace_id,
        workspaceName: getWorkspaceName(row.workspaces),
        role: row.role,
      };

      return membership;
    },
    onSessionChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(toAuthSession(session));
      });

      return () => data.subscription.unsubscribe();
    },
  };
}
