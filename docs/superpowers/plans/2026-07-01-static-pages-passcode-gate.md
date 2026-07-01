# Static Pages Passcode Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 GitHub Pages 배포용 정적 앱에 로컬 캐시 기반 패스코드 게이트를 추가한다.

**Architecture:** `AccessGate` 컴포넌트가 `localStorage`와 SHA-256 비교를 담당하고, `App`은 기존 작업실 UI를 children으로 넘긴다. CSS는 기존 브랜드 톤 위에 진입 화면 애니메이션만 추가한다.

**Tech Stack:** React 19, TypeScript, Web Crypto API, Vitest, Testing Library, CSS animation

---

### Task 1: Access Gate Behavior

**Files:**
- Create: `src/components/AccessGate.tsx`
- Test: `src/components/AccessGate.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing tests**

Add tests that render `AccessGate` with child content and verify locked, success, failure, and cached states.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- src/components/AccessGate.test.tsx`

Expected: FAIL because `AccessGate` does not exist.

- [ ] **Step 3: Implement `AccessGate`**

Create a focused component with:
- `ACCESS_GRANTED_KEY = 'lyru-oms:access-granted'`
- `PASSCODE_HASH` set to SHA-256 of `9999`
- async `hashPasscode`
- submit handler that stores cache only on match

- [ ] **Step 4: Wire `App`**

Wrap the existing `<main className="appShell">...</main>` with `<AccessGate>`.

- [ ] **Step 5: Style the gate**

Add full-screen warm white layout, staggered fade/slide entrance, failure shake, and mobile-safe spacing.

- [ ] **Step 6: Verify**

Run:
- `npm test -- src/components/AccessGate.test.tsx src/App.test.tsx`
- `npm test`
- `npm run build`

- [ ] **Step 7: Commit**

Commit with:

```bash
git add docs/superpowers/specs/2026-07-01-static-pages-passcode-gate-design.md docs/superpowers/plans/2026-07-01-static-pages-passcode-gate.md src
git commit -m "feat: add static pages passcode gate"
```
