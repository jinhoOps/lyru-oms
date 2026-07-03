# Order Toolbar Information Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주문 목록 도구, 주문 수집 접힘 상태, 주문 행 정보 밀도를 정리해 모바일에서도 읽기 쉬운 운영 화면을 만든다.

**Architecture:** `App.tsx`는 앱 헤더와 주문 수집 패널 상태를 맡고, `OrderList.tsx`는 주문 목록 헤더 도구와 행 표시를 맡는다. CSS는 기존 단일 `App.css` 패턴을 유지하고, 테스트는 기존 React Testing Library 테스트에 동작 기대값을 추가한다.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, browser `localStorage`.

---

### Task 1: 앱 헤더와 주문 수집 접힘 상태

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that assert the management control is an icon button with the accessible name `관리 설정`, and that the capture panel can be collapsed and restores its state from `localStorage`.

- [ ] **Step 2: Implement App state**

Add `CAPTURE_PANEL_COLLAPSED_KEY`, safe localStorage read/write helpers, a `captureCollapsed` state, a gear-only settings button, and a capture panel toggle that hides `OrderCaptureForm` when collapsed.

- [ ] **Step 3: Verify**

Run: `npm test -- src/App.test.tsx`

Expected: all App tests pass.

### Task 2: 주문 목록 도구와 중복 pill 정리

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that assert `주문 목록` and visible count share the heading row, sort opens from a `정렬` button, view opens from a `보기` button, and the total `확인 필요` pill no longer appears as a duplicate.

- [ ] **Step 2: Implement list header and menus**

Replace the icon-only sort button with a compact text button, replace the always-visible card/list segmented control with a compact `보기` menu, and keep the native radio controls inside both menus.

- [ ] **Step 3: Verify**

Run: `npm test -- src/components/OrderList.test.tsx`

Expected: all OrderList tests pass.

### Task 3: 주문 행 hierarchy and status coloring hooks

**Files:**
- Modify: `src/components/OrderList.tsx`
- Modify: `src/components/OrderList.test.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing tests**

Add tests that assert each row has a status class derived from the order status, that status pills remain visible, and that field summary text stays on the lower row.

- [ ] **Step 2: Implement row class and markup**

Add a status class helper, render top badge / center order content / bottom field summary consistently, and remove duplicate summary pills.

- [ ] **Step 3: Implement CSS**

Add compact toolbar styles, mobile wrapping constraints, status pill colors, and status border colors with low-saturation completed styling.

- [ ] **Step 4: Verify all work**

Run: `npm test`, `npm run build`, and `git diff --check`.

Expected: all commands pass.
