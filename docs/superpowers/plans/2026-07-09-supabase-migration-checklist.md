# Supabase Migration Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 가능한 Supabase migration 적용 체크리스트를 추가해 프론트 배포 후 DB migration 누락으로 RPC 404가 재발하지 않게 한다.

**Architecture:** 앱 코드나 Supabase 설정은 변경하지 않고 `docs/operations/supabase-migration-checklist.md` 문서만 추가한다. 문서는 배포 전 확인, SQL 적용, smoke test, 문제 해석, 완료 기준을 한 파일에 모은다. 퍼블릭 저장소에 안전하도록 실제 Supabase 프로젝트 값과 운영 데이터는 쓰지 않는다.

**Tech Stack:** Markdown, Git, Supabase SQL Editor 또는 개인 로컬 CLI를 전제로 한 운영 문서.

## Global Constraints

- 공개 가능한 Supabase migration 적용 체크리스트 문서 추가.
- 새 `supabase/migrations/*.sql` 파일 확인 절차를 포함한다.
- SQL Editor 또는 개인 로컬 CLI로 migration을 적용한다는 일반 절차를 포함한다.
- 앱에서 확인할 smoke test 항목을 포함한다.
- `/rest/v1/rpc/<function_name>` 404의 해석 기준을 포함한다.
- 완료 기준은 GitHub Pages 배포 성공, Supabase migration 적용, smoke test 통과다.
- Supabase CLI 설정 파일은 추가하지 않는다.
- DB 접속 정보, 프로젝트 URL, API key, 계정 이메일, workspace id는 기록하지 않는다.
- CI 자동 migration 적용은 하지 않는다.
- 원격 DB에 직접 migration을 적용하지 않는다.
- 앱 UI는 변경하지 않는다.

---

## File Structure

- Create `docs/operations/supabase-migration-checklist.md`
  - Responsibility: public-safe operational checklist for applying Supabase migrations after app deployment.
  - Contains no real project URL, project id/ref, API key, email, workspace id, user id, order id, or order content.

---

### Task 1: Supabase Migration Checklist 문서 추가

**Files:**
- Create: `docs/operations/supabase-migration-checklist.md`

**Interfaces:**
- Consumes: `supabase/migrations/*.sql` naming convention.
- Consumes: GitHub Pages deploy workflow status as an external deployment signal.
- Produces: public-safe deployment checklist for future Supabase RPC and migration changes.

- [ ] **Step 1: Create the operations docs directory and checklist file**

Create `docs/operations/supabase-migration-checklist.md` with exactly this content:

```markdown
# Supabase Migration Checklist

## Purpose

Use this checklist whenever a change adds or modifies files under `supabase/migrations/`.

The app deploy and the Supabase database migration are separate steps. If the app calls a new RPC before the matching SQL has been applied to the Supabase project, the browser can show a request like `/rest/v1/rpc/<function_name>` with a 404 response.

## Public Repository Safety

This repository is public. Do not write real operational values in this file, commit messages, issues, or PR descriptions.

Do not record:

- Supabase project URL.
- Supabase project id or ref.
- publishable key, anon key, service role key, or database password.
- owner, staff, or customer email addresses.
- workspace id, user id, order id, or other database ids.
- real order text, customer notes, phone numbers, or addresses.

Use placeholders such as `<project>`, `<workspace>`, and `<function_name>` when examples are needed.

## Before Applying SQL

- [ ] Review `git diff --name-only` and list every new or changed file under `supabase/migrations/`.
- [ ] Apply migration files in timestamp filename order.
- [ ] For every RPC migration, check whether it creates or replaces a function with `security definer`.
- [ ] For every client-facing RPC, check that execution is limited intentionally, including `revoke execute ... from public` when needed.
- [ ] For every index migration, check whether the statement uses `create index if not exists` or whether duplicate application must be avoided manually.
- [ ] Confirm that no migration SQL contains real project values or customer data.

## Applying SQL

Apply the SQL using one of these private operational paths:

- Supabase SQL Editor for the target project.
- A personal local Supabase CLI setup outside this public repository.

Do not add Supabase project configuration, access tokens, database passwords, or generated local config files to this repository.

When applying more than one migration, apply them oldest to newest by filename timestamp.

## Smoke Test After Applying SQL

After the GitHub Pages deploy succeeds and the Supabase SQL has been applied, open the deployed app and verify:

- [ ] Login succeeds.
- [ ] The workspace loads without an RPC 404 in the browser console or network tab.
- [ ] The order list loads.
- [ ] Saving a new order succeeds.
- [ ] Editing an existing order succeeds.
- [ ] Account management opens.
- [ ] Account management member list loads.
- [ ] Latest change request loading does not show `/rest/v1/rpc/list_latest_order_change_requests` as 404.

If the change added a new RPC, add one manual smoke check for the UI path that calls that RPC.

## Interpreting Common Failures

### `/rest/v1/rpc/<function_name>` returns 404

Treat this as a database deployment issue first.

Check:

- [ ] Was the migration that creates `<function_name>` applied to the target Supabase project?
- [ ] Was the SQL applied to the same project used by the deployed app?
- [ ] Does the function signature match the client call?
- [ ] Has the PostgREST schema cache refreshed after the function was created?

### RPC returns a permission or membership error

Treat this separately from a 404.

Check:

- [ ] The user is logged in.
- [ ] The user has the required workspace membership or owner role.
- [ ] The migration includes the intended `revoke` and `grant` statements.
- [ ] The RPC checks the target workspace boundary before reading or writing data.

## Completion Criteria

Migration work is not complete until all of these are true:

- [ ] GitHub Pages workflow completed successfully.
- [ ] Supabase migration SQL was applied to the target project.
- [ ] Smoke test passed on the deployed app.
- [ ] No RPC 404 appears for newly added or changed RPCs.
- [ ] No secrets, project identifiers, account emails, workspace ids, order ids, or customer data were added to the repository.
```

- [ ] **Step 2: Verify the checklist does not contain real operational values**

Run:

```powershell
Select-String -Path docs\operations\supabase-migration-checklist.md -Pattern 'https://|supabase.co|service_role|sb_publishable_|@|workspace-1|user-1|order-1'
```

Expected: no matches.

- [ ] **Step 3: Verify required public-safe placeholders and key phrases exist**

Run:

```powershell
Select-String -Path docs\operations\supabase-migration-checklist.md -Pattern '<function_name>|<project>|<workspace>|/rest/v1/rpc/|revoke execute|GitHub Pages|Smoke Test|Completion Criteria'
```

Expected: output includes all eight patterns.

- [ ] **Step 4: Run markdown whitespace check**

Run:

```powershell
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms diff --check -- docs/operations/supabase-migration-checklist.md
```

Expected: no output and exit code 0.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms add docs/operations/supabase-migration-checklist.md
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms commit -m "docs: add supabase migration checklist"
```

Expected: commit succeeds with only `docs/operations/supabase-migration-checklist.md`.

---

### Task 2: Final Documentation Verification

**Files:**
- Verify: `docs/operations/supabase-migration-checklist.md`

**Interfaces:**
- Consumes: checklist created in Task 1.
- Produces: verified docs-only branch ready for review.

- [ ] **Step 1: Read the checklist from top to bottom**

Run:

```powershell
Get-Content docs\operations\supabase-migration-checklist.md
```

Expected: document is readable in this order: Purpose, Public Repository Safety, Before Applying SQL, Applying SQL, Smoke Test After Applying SQL, Interpreting Common Failures, Completion Criteria.

- [ ] **Step 2: Re-run sensitive-value scan**

Run:

```powershell
Select-String -Path docs\operations\supabase-migration-checklist.md -Pattern 'https://|supabase.co|service_role|sb_publishable_|@|workspace-1|user-1|order-1'
```

Expected: no matches.

- [ ] **Step 3: Re-run whitespace check**

Run:

```powershell
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 4: Commit only if verification required changes**

If Step 1-3 required no edits, do not create a commit.

If a small documentation fix was needed, run:

```powershell
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms add docs/operations/supabase-migration-checklist.md
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms commit -m "docs: refine supabase migration checklist"
```

Expected: repository ends with no tracked file changes.

---

## Self-Review

Spec coverage:

- `docs/operations/supabase-migration-checklist.md` creation is covered by Task 1.
- Public-safe wording and sensitive-value exclusions are covered by Task 1 Step 2 and Task 2 Step 2.
- Migration file review, SQL application, smoke test, RPC 404 interpretation, and completion criteria are included in the exact Markdown content in Task 1.
- Supabase CLI setup, CI automation, remote DB application, and app UI changes are excluded from every task.

Placeholder scan:

- No placeholder markers or incomplete implementation instructions are present.
- Placeholder tokens such as `<function_name>`, `<project>`, and `<workspace>` are intentional safe examples required by the spec.

Type consistency:

- This is docs-only work. There are no code interfaces or TypeScript types.
