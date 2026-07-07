# Account Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app password change and owner-only workspace member administration without exposing Supabase secrets.

**Architecture:** Extend `AuthRepository` with password and admin RPC methods, add `AccountModal` for UI, and add a Supabase migration with security definer RPC functions. `WorkspaceApp` owns modal state and passes the current email, workspace, and role into the modal.

**Tech Stack:** React 19, TypeScript, Supabase Auth/Postgres RPC, Vitest, React Testing Library.

---

### Task 1: Auth Repository

**Files:**
- Modify: `src/auth/authTypes.ts`
- Modify: `src/auth/authRepository.ts`
- Test: `src/auth/authRepository.test.ts`

- [ ] Add `WorkspaceMemberSummary` and new repository methods for password change, member list, and member upsert.
- [ ] Implement Supabase calls using `auth.signInWithPassword`, `auth.updateUser`, and `rpc`.
- [ ] Cover success and failure paths in tests.

### Task 2: Account Modal

**Files:**
- Create: `src/components/AccountModal.tsx`
- Create: `src/components/AccountModal.test.tsx`
- Modify: `src/App.css`

- [ ] Build a modal with password fields and owner-only member management.
- [ ] Validate current password, new password length, and confirmation match.
- [ ] Show Korean status/error messages and keep controls disabled while saving.

### Task 3: App Wiring

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] Pass `authRepository` and current email into `WorkspaceApp`.
- [ ] Add a header account button and mount `AccountModal`.
- [ ] Verify owner sees account/admin entry point while staff does not receive admin controls.

### Task 4: Supabase SQL

**Files:**
- Create: `supabase/migrations/20260707000000_workspace_admin_rpc.sql`
- Create: `supabase/grant.initial-admins.sql`
- Modify: `README.md`

- [ ] Add RPC functions guarded by `public.is_workspace_owner`.
- [ ] Add one-time SQL for `okho04@gmail.com` and `jsss2536@naver.com` owner grants.
- [ ] Document the one-time migration and grant steps.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run `npm test -- --run src/auth/authRepository.test.ts src/components/AccountModal.test.tsx src/App.test.tsx`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
