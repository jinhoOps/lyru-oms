import { type FormEvent, type ReactNode, useEffect, useState } from 'react';

export const ACCESS_GRANTED_KEY = 'lyru-oms:access-granted';

const PASSCODE_HASH = '888df25ae35772424a560c7152a1de794440e0ea5cfee62828333a456a506e05';
const REVEAL_DELAY_MS = 1200;

async function hashPasscode(passcode: string) {
  const input = new TextEncoder().encode(passcode);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

type AccessGateProps = {
  children: ReactNode;
};

export function AccessGate({ children }: AccessGateProps) {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(ACCESS_GRANTED_KEY) === 'true');
  const [revealReady, setRevealReady] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [failedAttempt, setFailedAttempt] = useState(0);

  useEffect(() => {
    if (!unlocked) {
      setRevealReady(false);
      return;
    }

    const timer = window.setTimeout(() => setRevealReady(true), REVEAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [unlocked]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setError('');

    try {
      const nextHash = await hashPasscode(passcode);
      if (nextHash === PASSCODE_HASH) {
        localStorage.setItem(ACCESS_GRANTED_KEY, 'true');
        setUnlocked(true);
        return;
      }

      setPasscode('');
      setFailedAttempt((current) => current + 1);
      setError('패스코드가 맞지 않습니다.');
    } finally {
      setChecking(false);
    }
  }

  if (unlocked && revealReady) {
    return <div className="appReveal">{children}</div>;
  }

  if (unlocked) {
    return (
      <main className="accessGateShell">
        <section className="accessGateCard accessGateLoading" aria-label="작업실 준비">
          <p className="accessGateEyebrow">Lyru OMS</p>
          <h1>작업실 준비 중</h1>
          <p className="accessGateCopy">주문 작업실을 불러오고 있어요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="accessGateShell">
      <section className="accessGateCard" aria-label="앱 접근 확인">
        <p className="accessGateEyebrow">Private workspace</p>
        <h1>Lyru OMS</h1>
        <p className="accessGateCopy">주문 작업실에 입장하려면 패스코드를 입력하세요.</p>

        <form className="accessGateForm" onSubmit={handleSubmit}>
          <label>
            패스코드
            <input
              key={failedAttempt}
              className={error ? 'accessGateInput hasError' : 'accessGateInput'}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" disabled={checking || passcode.length === 0}>
            {checking ? '확인 중' : '입장'}
          </button>
          <p className="accessGateError" role="status" aria-live="polite">
            {error}
          </p>
        </form>
      </section>
    </main>
  );
}
