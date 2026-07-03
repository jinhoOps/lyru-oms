# First Run Channel Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 입장 샘플 주문, 주문 수집 채널 접힘, 짧은 입장 애니메이션을 추가한다.

**Architecture:** `App`에서 빈 주문 상태에 샘플을 주입하고, 주문 수집 채널 선택을 접힘 콘텐츠 안으로 이동한다. `AccessGate`는 잠금 해제 후 짧은 리빌레이 상태를 거쳐 children을 표시한다.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, localStorage.

---

### Task 1: App first-run sample and channel capture

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing tests**

Add tests proving an empty first run shows `유리루`, the capture channel hides while collapsed, and labels use `채널`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/App.test.tsx`

- [ ] **Step 3: Implement minimal App changes**

Add sample order creation, move channel select into the expanded capture area, and rename visible labels.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/App.test.tsx`

### Task 2: AccessGate short reveal delay

**Files:**
- Modify: `src/components/AccessGate.tsx`
- Modify: `src/components/AccessGate.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing tests**

Add tests proving cached and newly unlocked access show a short loading state before the app body appears.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/components/AccessGate.test.tsx`

- [ ] **Step 3: Implement minimal AccessGate changes**

Add a sub-1000ms reveal delay and loading copy.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/components/AccessGate.test.tsx`

### Task 3: Full verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused and full checks**

Run: `npm test`, `npm run build`, `git diff --check`.

- [ ] **Step 2: Verify desktop/mobile UI**

Use Playwright against the local Vite server to confirm capture collapse and first-run sample on desktop and mobile.
