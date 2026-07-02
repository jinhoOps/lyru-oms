# Lyru OMS

Lyru OMS(Order Management System)

이 프로젝트는 Vite + React 19 + TypeScript 기반으로 구성되어 있으며, 빌드 후 생성되는 정적 파일들을 통해 쉽게 웹 호스팅 서비스에 배포할 수 있습니다.

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

> 💡 **배포 경로 설정 팁 (vite.config.ts)**
> - **GitHub Pages** 등으로 하위 경로(`https://<유저명>.github.io/lyru-oms/`)에 배포할 경우: `vite.config.ts` 파일의 `base` 설정이 `'/lyru-oms/'`로 유지되어야 합니다.
> - **Vercel, Netlify** 또는 커스텀 도메인을 사용해 루트 경로(`https://<도메인>/`)에 배포할 경우: `vite.config.ts` 파일의 `base` 설정을 `'/'`로 변경한 후 빌드해야 리소스가 올바르게 로드됩니다.

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
