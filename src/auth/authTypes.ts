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

export interface WorkspaceMemberSummary {
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface AuthRepository {
  getSession: () => Promise<AuthSession | null>;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  changePassword: (email: string, currentPassword: string, newPassword: string) => Promise<void>;
  getWorkspaceMembership: () => Promise<WorkspaceMembership | null>;
  listWorkspaceMembers: (workspaceId: string) => Promise<WorkspaceMemberSummary[]>;
  upsertWorkspaceMemberByEmail: (
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ) => Promise<WorkspaceMemberSummary>;
  onSessionChange: (callback: (session: AuthSession | null) => void) => () => void;
}
