import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
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
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;

    async function resolveWorkspace(session: AuthSession | null) {
      if (!session) {
        if (active) {
          setStatus('signed-out');
        }
        return;
      }

      if (active) {
        setStatus('loading');
      }

      try {
        const membership = await authRepository.getWorkspaceMembership();
        if (active) {
          setStatus(membership ? 'ready' : 'blocked');
        }
      } catch {
        if (active) {
          setStatus('blocked');
        }
      }
    }

    async function prepare() {
      try {
        await resolveWorkspace(await authRepository.getSession());
      } catch {
        if (active) {
          setStatus('signed-out');
        }
      }
    }

    void prepare();

    const unsubscribe = authRepository.onSessionChange((nextSession) => {
      void resolveWorkspace(nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authRepository]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setError('');

    try {
      const session = await authRepository.signIn(email, password);
      const membership = await authRepository.getWorkspaceMembership();
      setStatus(session && membership ? 'ready' : 'blocked');
    } catch {
      setStatus('signed-out');
      setError('로그인 정보를 확인해 주세요.');
    } finally {
      setChecking(false);
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
          <p className="accessGateCopy">이 계정에 연결된 workspace_members 권한을 확인해 주세요.</p>
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={checking || email.length === 0 || password.length === 0}>
            {checking ? '확인 중' : '로그인'}
          </button>
          <p className="accessGateError" role="status" aria-live="polite">
            {error}
          </p>
        </form>
      </section>
    </main>
  );
}
