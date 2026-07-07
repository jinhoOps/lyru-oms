# Lyru OMS

Lyru OMS(Order Management System)

이 프로젝트는 Vite + React 19 + TypeScript 기반으로 구성되어 있으며, 빌드 후 생성되는 정적 파일들을 통해 쉽게 웹 호스팅 서비스에 배포할 수 있습니다.
https://jinhoops.github.io/lyru-oms/

---

## 🛠 개발 및 실행 방법

### 1. 패키지 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
```
실행 후 터미널에 표시되는 로컬 주소(기본값: `http://127.0.0.1:5173`)로 접속합니다.

### 3. 정적 파일 빌드 및 배포
```bash
npm run build
```
빌드가 완료되면 루트 디렉토리에 `dist` 폴더가 생성됩니다. 이 `dist` 폴더 내의 정적 파일들을 GitHub Pages, Vercel, Netlify, Cloudflare Pages 등의 서비스에 배포할 수 있습니다.

### 4. 빌드 결과물 미리보기
```bash
npm run preview
```

---

## 🧪 테스트 실행 방법

이 프로젝트는 **Vitest**와 **React Testing Library**를 사용하여 테스트를 수행합니다.

### 1. 테스트 단발성 실행
```bash
npm run test
```

### 2. 테스트 감시(Watch) 모드 실행
```bash
npm run test:watch
```

---

## Supabase Setup

Lyru OMS는 GitHub Pages 정적 프론트엔드와 Supabase Auth/Postgres/RLS를 함께 사용합니다.

프론트엔드에 필요한 공개 환경변수:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
```

Supabase `service_role` key, secret key, database password, RLS를 우회하는 credential은 커밋하거나 브라우저 번들에 넣지 않습니다.

로컬 개발 순서:

1. Supabase 프로젝트를 생성합니다.
2. `supabase/migrations/20260706000000_initial_auth_workspace_schema.sql`을 적용합니다.
3. Supabase에서 개발용 auth 사용자를 생성합니다.
4. `supabase/bootstrap.owner.sql`의 `owner_email`을 로그인 이메일로 바꿔 실행해 workspace를 만들고 해당 사용자를 `workspace_members`에 연결합니다.
5. `supabase/seed.dev.sql`은 개발 DB에만 명시적으로 실행합니다.
6. `.env.local`에 공개 Supabase env를 넣고 `npm run dev`로 실행합니다.

운영 DB는 빈 상태로 시작합니다. 개발 seed 데이터는 production에 실행하지 않습니다.

초기 운영 계정 연결 쿼리는 `supabase/bootstrap.owner.sql`에 주석과 함께 보관합니다. 나중에 새 Supabase 프로젝트를 만들 때는 migration을 먼저 실행한 뒤 해당 파일을 SQL Editor에 붙여넣으면 됩니다.

### GitHub Pages 배포 연결

GitHub Pages는 정적 파일만 서빙하므로 `.env.local`을 읽지 않습니다. 배포용 Supabase 공개 설정은 GitHub Actions 빌드 시점에 Repository Variables로 주입합니다.

GitHub 저장소에서 `Settings` → `Secrets and variables` → `Actions` → `Variables`에 아래 값을 추가합니다.

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
```

그 다음 `Deploy GitHub Pages` workflow를 다시 실행하면 `import.meta.env.VITE_*` 값이 빌드 결과 JS에 포함됩니다.

Supabase Dashboard의 `Authentication` URL 설정에는 아래 값을 등록합니다.

```text
Site URL: https://jinhoops.github.io/lyru-oms/
Redirect URLs: https://jinhoops.github.io/lyru-oms/**
```
