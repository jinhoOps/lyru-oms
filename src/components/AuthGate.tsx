import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { AuthRepository, AuthSession } from '../auth/authTypes';

type AuthGateProps = {
  authRepository: AuthRepository;
  children: ReactNode;
};

type AuthGateStatus = 'loading' | 'signed-out' | 'blocked' | 'ready';

export function AuthGate({ authRepository, children }: AuthGateProps) {
  const [status, setStatus] = useState<AuthGateStatus>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [blockedError, setBlockedError] = useState('');
  const [checking, setChecking] = useState(false);
  const mountedRef = useRef(false);

  const resolveWorkspace = useCallback(
    async (session: AuthSession | null) => {
      if (!session) {
        if (mountedRef.current) {
          setStatus('signed-out');
        }
        return;
      }

      if (mountedRef.current) {
        setStatus('loading');
        setBlockedError('');
      }

      try {
        const membership = await authRepository.getWorkspaceMembership();
        if (mountedRef.current) {
          setStatus(membership ? 'ready' : 'blocked');
        }
      } catch {
        if (mountedRef.current) {
          setStatus('blocked');
        }
      }
    },
    [authRepository],
  );

  const loadSession = useCallback(async () => {
    if (mountedRef.current) {
      setStatus('loading');
      setBlockedError('');
    }

    try {
      await resolveWorkspace(await authRepository.getSession());
    } catch {
      if (mountedRef.current) {
        setStatus('signed-out');
      }
    }
  }, [authRepository, resolveWorkspace]);

  useEffect(() => {
    mountedRef.current = true;

    void loadSession();

    const unsubscribe = authRepository.onSessionChange((nextSession) => {
      void resolveWorkspace(nextSession);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [authRepository, loadSession, resolveWorkspace]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setError('');

    try {
      const session = await authRepository.signIn(email, password);
      const membership = await authRepository.getWorkspaceMembership();
      if (mountedRef.current) {
        setStatus(session && membership ? 'ready' : 'blocked');
      }
    } catch {
      if (mountedRef.current) {
        setStatus('signed-out');
        setError('로그인 정보를 확인해 주세요.');
      }
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }

  async function handleSignOut() {
    setBlockedError('');

    try {
      await authRepository.signOut();
      if (mountedRef.current) {
        setEmail('');
        setPassword('');
        setStatus('signed-out');
      }
    } catch {
      if (mountedRef.current) {
        setBlockedError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  }

  if (status === 'ready') {
    return <div className="appReveal">{children}</div>;
  }

  if (status === 'loading') {
    return (
      <main className="accessGateShell">
        <section className="accessGateCard accessGateLoading" aria-label="작업실 준비">
          <p className="accessGateEyebrow">Lyru OMS</p>
          <h1>작업실 준비 중</h1>
          <p className="accessGateCopy">로그인 상태와 작업실 권한을 확인하고 있어요.</p>
        </section>
      </main>
    );
  }

  if (status === 'blocked') {
    return (
      <main className="accessGateShell">
        <section className="accessGateCard" aria-label="작업실 접근 차단">
          <p className="accessGateEyebrow">Lyru OMS</p>
          <h1>작업실 접근 권한이 없습니다</h1>
          <p className="accessGateCopy">이 계정의 workspace_members 권한이 없거나 확인하지 못했습니다.</p>
          <div className="accessGateActions">
            <button type="button" onClick={loadSession}>
              다시 시도
            </button>
            <button type="button" className="secondaryButton" onClick={handleSignOut}>
              로그아웃
            </button>
          </div>
          <p className="accessGateError" role="status" aria-live="polite">
            {blockedError}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="accessGateShell">
      <section className="accessGateCard" aria-label="로그인">
        <p className="accessGateEyebrow">Private workspace</p>
        <h1>Lyru OMS 로그인</h1>

        <form className="accessGateForm" onSubmit={handleSubmit}>
          <label>
            이메일
            <input
              className="accessGateInput authGateInput"
              type="email"
              autoComplete="email"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'authGateLoginError' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
            />
          </label>
          <label>
            비밀번호
            <input
              className={error ? 'accessGateInput authGateInput hasError' : 'accessGateInput authGateInput'}
              type="password"
              autoComplete="current-password"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'authGateLoginError' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={checking || email.length === 0 || password.length === 0}>
            {checking ? '확인 중' : '로그인'}
          </button>
          <p id="authGateLoginError" className="accessGateError" role="status" aria-live="polite">
            {error}
          </p>
        </form>
      </section>
    </main>
  );
}
