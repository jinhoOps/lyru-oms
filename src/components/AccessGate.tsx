import { type FormEvent, type ReactNode, useState } from 'react';

export const ACCESS_GRANTED_KEY = 'lyru-oms:access-granted';

const PASSCODE_HASH = '888df25ae35772424a560c7152a1de794440e0ea5cfee62828333a456a506e05';

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
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [failedAttempt, setFailedAttempt] = useState(0);

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

  if (unlocked) {
    return <div className="appReveal">{children}</div>;
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
