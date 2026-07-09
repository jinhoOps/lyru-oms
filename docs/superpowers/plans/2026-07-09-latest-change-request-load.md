# 최신 변경 요청 로딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초기 작업실 로딩에서 `order_change_requests` 직접 테이블 조회 대신 주문별 최신 변경 요청 1건을 반환하는 RPC를 호출하게 만든다.

**Architecture:** `loadWorkspaceData`는 기존 orders/settings 로딩과 `CapturedOrder` mapping을 유지한다. 변경 요청 조회만 `public.list_latest_order_change_requests` RPC로 바꾸고, DB에는 동일한 최신성 기준과 composite index를 추가한다. 현재 DB는 주문당 변경 요청 1건 모델이므로 이번 slice의 주효과는 row 수 절감보다 권한 경계와 쿼리 계약을 DB RPC로 모으는 것이다.

**Tech Stack:** TypeScript, Supabase JS v2, PostgreSQL SQL/PLpgSQL, Vitest.

## Global Constraints

- `public.list_latest_order_change_requests` RPC migration 추가.
- RPC는 기존 패턴을 따른다: `security definer`, `set search_path = public`, 명시적 workspace membership 확인, `anon` 권한 회수, `authenticated` 실행 권한 부여.
- RPC는 주문별 최신 변경 요청 1건만 반환한다.
- 최신 기준은 현재 클라이언트와 동일하게 `updated_at desc`, `created_at desc`, `id desc`를 사용한다.
- `createOrderRepository.loadWorkspaceData`의 변경 요청 조회를 RPC 호출로 바꾼다.
- 최신 변경 요청 조회를 위한 composite index를 추가한다.
- 주문 row column 축소는 제외.
- 주문 pagination/window 제한은 제외.
- 상세 데이터 lazy load는 제외.
- UI 변경은 제외.
- offline cache 변경은 제외.
- `saveOrder` RPC 변경은 제외.

---

## File Structure

- Modify `src/domain/orderRepository.ts`
  - Responsibility: Supabase-backed order load/save persistence boundary.
  - Replace `selectChangeRequests` direct table query with `supabase.rpc('list_latest_order_change_requests', ...)`.
  - Keep `ChangeRequestRow` and `loadWorkspaceData` map assembly unchanged.

- Modify `src/domain/orderRepository.test.ts`
  - Responsibility: repository behavior tests and Supabase mock behavior.
  - Extend `createSupabaseMock` so `rpc` can return both save-order RPC rows and latest-change-request RPC rows.
  - Update load test to expect the latest-change-request RPC instead of direct `order_change_requests` select/order.
  - Add RPC error propagation test for workspace load.

- Create `supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql`
  - Responsibility: DB-side latest-per-order change request query.
  - Add `order_change_requests_workspace_latest_idx`.
  - Define and grant `public.list_latest_order_change_requests`.

---

### Task 1: Repository loadWorkspaceData 최신 변경요청 RPC 전환

**Files:**
- Modify: `src/domain/orderRepository.ts:226-233`
- Test: `src/domain/orderRepository.test.ts:33-152`
- Test: `src/domain/orderRepository.test.ts:193-239`

**Interfaces:**
- Consumes: `ChangeRequestRow`
- Consumes: `supabase.rpc<T>(functionName: string, args?: Record<string, unknown>): QueryResult<T>`
- Produces: `selectChangeRequests(supabase: SupabaseLike, workspaceId: string): QueryResult<ChangeRequestRow[]>`
- Produces: `createOrderRepository(supabase).loadWorkspaceData(workspaceId: string): Promise<WorkspaceData>`

- [ ] **Step 1: Write failing repository tests**

In `src/domain/orderRepository.test.ts`, update `createSupabaseMock` to accept latest-change-request RPC data and a separate load RPC error:

```typescript
function createSupabaseMock({
  orderRows = [],
  settingsRow = null,
  changeRequestRows = [],
  savedOrderRow,
  insertedChangeRequestRow = null,
  updatedChangeRequestRow = null,
  saveOrderRpcRow = null,
  latestChangeRequestRows = null,
  rpcError = null,
  latestChangeRequestsRpcError = null,
  savedSettingsRow,
}: {
  orderRows?: OrderRow[];
  settingsRow?: WorkspaceSettingsRow | null;
  changeRequestRows?: ChangeRequestRowMock[];
  savedOrderRow?: OrderRow;
  insertedChangeRequestRow?: { id: string; note: string; confirmed: boolean; order_id?: string } | null;
  updatedChangeRequestRow?: { id: string; note: string; confirmed: boolean; order_id?: string } | null;
  saveOrderRpcRow?: (OrderRow & {
    change_request_id: string | null;
    change_request_note: string | null;
    change_request_confirmed: boolean | null;
  }) | null;
  latestChangeRequestRows?: ChangeRequestRowMock[] | null;
  rpcError?: Error | null;
  latestChangeRequestsRpcError?: Error | null;
  savedSettingsRow?: WorkspaceSettingsRow;
} = {}) {
```

Replace the current `rpc` mock with a function-name aware implementation:

```typescript
  const rpc = vi.fn((functionName: string, args: unknown) => {
    record('rpc', functionName, [args]);

    if (functionName === 'list_latest_order_change_requests') {
      return Promise.resolve({
        data: latestChangeRequestRows ?? changeRequestRows,
        error: latestChangeRequestsRpcError,
      });
    }

    return Promise.resolve({ data: saveOrderRpcRow ? [saveOrderRpcRow] : [], error: rpcError });
  });
```

In the test `loads workspace orders, latest change requests, and settings from Supabase`, keep the input data and resolved expectation, but replace the direct `order_change_requests` table expectations with:

```typescript
    expect(supabase.from).toHaveBeenCalledWith('orders');
    expect(supabase.from).toHaveBeenCalledWith('workspace_settings');
    expect(supabase.from).not.toHaveBeenCalledWith('order_change_requests');
    expect(supabase.rpc).toHaveBeenCalledWith('list_latest_order_change_requests', {
      target_workspace_id: workspaceId,
    });
```

Add this test after the malformed settings test:

```typescript
  it('throws latest change request RPC errors while loading workspace data', async () => {
    const supabase = createSupabaseMock({
      latestChangeRequestsRpcError: new Error('latest change requests failed'),
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.loadWorkspaceData(workspaceId)).rejects.toThrow('latest change requests failed');
  });
```

- [ ] **Step 2: Run focused test to verify it fails**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: FAIL. The load test should fail because `selectChangeRequests` still calls `from('order_change_requests')` and does not call `rpc('list_latest_order_change_requests', ...)`.

- [ ] **Step 3: Replace `selectChangeRequests` implementation**

In `src/domain/orderRepository.ts`, replace:

```typescript
const selectChangeRequests = async (supabase: SupabaseLike, workspaceId: string): QueryResult<ChangeRequestRow[]> =>
  await supabase
    .from('order_change_requests')
    .select<ChangeRequestRow[]>('id, order_id, note, confirmed, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
```

with:

```typescript
const selectChangeRequests = async (supabase: SupabaseLike, workspaceId: string): QueryResult<ChangeRequestRow[]> =>
  await supabase.rpc<ChangeRequestRow[]>('list_latest_order_change_requests', {
    target_workspace_id: workspaceId,
  });
```

- [ ] **Step 4: Run focused test to verify it passes**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: PASS. `orderRepository` tests pass and `loadWorkspaceData` no longer expects direct `order_change_requests` table selection.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add src/domain/orderRepository.ts src/domain/orderRepository.test.ts
git commit -m "refactor: load latest change requests through rpc"
```

Expected: commit succeeds with only repository and repository test changes.

---

### Task 2: Latest Change Request RPC Migration 추가

**Files:**
- Create: `supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql`
- Test: static migration review by command output

**Interfaces:**
- Consumes: `public.is_workspace_member(target_workspace_id uuid): boolean`
- Consumes: `public.order_change_requests`
- Produces: `public.list_latest_order_change_requests(target_workspace_id uuid)`
- Produces: index `order_change_requests_workspace_latest_idx`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql` with:

```sql
create index if not exists order_change_requests_workspace_latest_idx
on public.order_change_requests (workspace_id, order_id, updated_at desc, created_at desc, id desc);

create or replace function public.list_latest_order_change_requests(target_workspace_id uuid)
returns table (
  order_id uuid,
  id uuid,
  note text,
  confirmed boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Only workspace members can list latest order change requests';
  end if;

  return query
  select
    latest.order_id,
    latest.id,
    latest.note,
    latest.confirmed,
    latest.created_at,
    latest.updated_at
  from (
    select distinct on (ocr.order_id)
      ocr.order_id,
      ocr.id,
      ocr.note,
      ocr.confirmed,
      ocr.created_at,
      ocr.updated_at
    from public.order_change_requests ocr
    where ocr.workspace_id = target_workspace_id
    order by
      ocr.order_id,
      ocr.updated_at desc,
      ocr.created_at desc,
      ocr.id desc
  ) latest
  order by
    latest.updated_at desc,
    latest.created_at desc,
    latest.id desc;
end;
$$;

revoke all on function public.list_latest_order_change_requests(uuid) from anon;
grant execute on function public.list_latest_order_change_requests(uuid) to authenticated;
```

- [ ] **Step 2: Run static migration checks**

Run:

```powershell
Select-String -Path supabase\migrations\20260709010000_latest_order_change_requests_rpc.sql -Pattern 'security definer|set search_path = public|is_workspace_member|distinct on|order_change_requests_workspace_latest_idx|revoke all|grant execute'
```

Expected: output includes all seven required patterns.

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Run focused repository tests**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

Run:

```powershell
git add supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql
git commit -m "db: add latest change request rpc"
```

Expected: commit succeeds with only the migration file.

---

### Task 3: Final Verification

**Files:**
- Verify only; no planned edits.

**Interfaces:**
- Consumes: Task 1 repository RPC load change.
- Consumes: Task 2 migration.
- Produces: verified branch ready for review.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```powershell
npm test -- --run
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS. Existing Vite chunk-size warning is acceptable if there is no build error.

- [ ] **Step 4: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit only if verification required changes**

If verification caused no file edits, do not create a commit.

If a small verification fix was needed, commit only that fix:

```powershell
git add <changed-files>
git commit -m "fix: align latest change request load verification"
```

Expected: repository ends with a clean worktree.

---

## Self-Review

Spec coverage:

- Latest-change-request RPC migration is covered by Task 2.
- Repository `loadWorkspaceData` RPC call is covered by Task 1.
- Existing orders/settings load behavior is preserved in Task 1.
- RPC permission and membership checks are covered by Task 2.
- Composite index is covered by Task 2.
- Order column reduction, pagination/windowing, lazy detail load, UI changes, offline cache changes, and `saveOrder` RPC changes are excluded from all tasks.

Placeholder scan:

- No placeholder tokens or incomplete implementation steps are present.
- Code-changing steps include exact snippets.
- Test commands and expected outcomes are explicit.

Type consistency:

- `ChangeRequestRow` remains the client row type for latest change request rows.
- `latestChangeRequestRows` mock uses the existing `ChangeRequestRowMock` shape.
- `selectChangeRequests` still returns `QueryResult<ChangeRequestRow[]>`.
