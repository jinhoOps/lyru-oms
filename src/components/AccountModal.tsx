import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { AuthRepository, WorkspaceMemberSummary, WorkspaceMembership, WorkspaceRole } from '../auth/authTypes';

interface AccountModalProps {
  open: boolean;
  currentEmail: string;
  membership: WorkspaceMembership;
  authRepository: AuthRepository;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export function AccountModal({ open, currentEmail, membership, authRepository, onClose }: AccountModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('staff');
  const [memberStatus, setMemberStatus] = useState('');
  const [memberError, setMemberError] = useState('');
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const canManageMembers = membership.role === 'owner';

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setPasswordStatus('');
    setPasswordError('');
    setMemberEmail('');
    setMemberRole('staff');
    setMemberStatus('');
    setMemberError('');
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !canManageMembers) {
      return;
    }

    let active = true;
    setIsLoadingMembers(true);
    setMemberError('');

    authRepository
      .listWorkspaceMembers(membership.workspaceId)
      .then((nextMembers) => {
        if (!active) {
          return;
        }

        setMembers(nextMembers);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setMemberError('멤버 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) {
          setIsLoadingMembers(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authRepository, canManageMembers, membership.workspaceId, open]);

  if (!open) {
    return null;
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus('');
    setPasswordError('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError('새 비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsChangingPassword(true);

    try {
      await authRepository.changePassword(currentEmail, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setPasswordStatus('비밀번호를 변경했습니다.');
    } catch {
      setPasswordError('현재 비밀번호를 확인해 주세요.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = memberEmail.trim();
    setMemberStatus('');
    setMemberError('');

    if (!trimmedEmail) {
      setMemberError('권한을 줄 이메일을 입력해 주세요.');
      return;
    }

    setIsSavingMember(true);

    try {
      await authRepository.upsertWorkspaceMemberByEmail(membership.workspaceId, trimmedEmail, memberRole);
      const nextMembers = await authRepository.listWorkspaceMembers(membership.workspaceId);
      setMembers(nextMembers);
      setMemberEmail('');
      setMemberStatus('멤버 권한을 저장했습니다.');
    } catch {
      setMemberError('멤버 권한을 저장하지 못했습니다. Auth 사용자가 먼저 생성되어 있는지 확인해 주세요.');
    } finally {
      setIsSavingMember(false);
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!isChangingPassword && !isSavingMember) {
        onClose();
      }
    }
  }

  return (
    <div className="modalBackdrop bottomSheetBackdrop" role="presentation">
      <section
        className="settingsModal accountModal bottomSheetModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">계정</p>
            <h2 id="account-title">로그인 계정 관리</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="iconButton" aria-label="계정 관리 닫기" onClick={onClose}>
            x
          </button>
        </div>

        <section className="accountSection" aria-labelledby="password-section-title">
          <div>
            <h3 id="password-section-title">비밀번호 변경</h3>
            <p>{currentEmail}</p>
          </div>
          <form className="accountForm" onSubmit={handlePasswordSubmit}>
            <label>
              현재 비밀번호
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              새 비밀번호
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              새 비밀번호 확인
              <input
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !newPasswordConfirm}
            >
              {isChangingPassword ? '변경 중' : '비밀번호 변경'}
            </button>
            {passwordError ? <p role="alert">{passwordError}</p> : null}
            {passwordStatus ? (
              <p className="accountStatus" role="status" aria-live="polite">
                {passwordStatus}
              </p>
            ) : null}
          </form>
        </section>

        {canManageMembers ? (
          <section className="accountSection" aria-labelledby="members-section-title">
            <div>
              <h3 id="members-section-title">관리자 권한</h3>
              <p>Supabase Auth에 먼저 만든 계정에 작업실 권한을 부여합니다.</p>
            </div>
            <form className="accountMemberForm" onSubmit={handleMemberSubmit}>
              <label>
                이메일
                <input
                  type="email"
                  autoComplete="email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                />
              </label>
              <label>
                권한
                <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}>
                  <option value="owner">관리자</option>
                  <option value="staff">직원</option>
                </select>
              </label>
              <button type="submit" disabled={isSavingMember || !memberEmail.trim()}>
                {isSavingMember ? '저장 중' : '권한 저장'}
              </button>
            </form>
            {memberError ? <p role="alert">{memberError}</p> : null}
            {memberStatus ? (
              <p className="accountStatus" role="status" aria-live="polite">
                {memberStatus}
              </p>
            ) : null}
            <div className="accountMemberList" aria-label="작업실 멤버">
              {isLoadingMembers ? (
                <p>멤버 목록을 불러오고 있어요.</p>
              ) : (
                members.map((member) => (
                  <div key={member.userId} className="accountMemberRow">
                    <span>{member.email}</span>
                    <strong>{member.role === 'owner' ? '관리자' : '직원'}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        <div className="modalActions">
          <button type="button" className="secondaryButton" onClick={onClose}>
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}
