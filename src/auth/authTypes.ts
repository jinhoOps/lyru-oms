export interface AuthSession {
  userId: string;
  email: string;
}

export type WorkspaceRole = 'owner' | 'staff';

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export interface AuthRepository {
  getSession: () => Promise<AuthSession | null>;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  getWorkspaceMembership: () => Promise<WorkspaceMembership | null>;
  onSessionChange: (callback: (session: AuthSession | null) => void) => () => void;
}
