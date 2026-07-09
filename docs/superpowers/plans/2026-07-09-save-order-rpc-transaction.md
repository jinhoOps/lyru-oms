# 주문 저장 RPC 트랜잭션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `saveOrder`가 주문과 변경 요청을 하나의 Supabase RPC 트랜잭션으로 저장하게 만든다.

**Architecture:** DB에는 `public.save_order_with_details` RPC를 추가하고, 클라이언트 repository는 기존 개별 mutation 대신 `supabase.rpc(...)`만 호출한다. TypeScript 경계는 기존 `mapOrderToRow`, `mapOrderFromRow`를 유지하고, RPC 반환 row만 얇은 타입으로 감싼다.

**Tech Stack:** TypeScript, Supabase JS v2, PostgreSQL PL/pgSQL, Vitest.

## Global Constraints

- `public.save_order_with_details`를 정의하는 Supabase migration 추가.
- 기존 RPC 패턴 유지: `security definer`, `set search_path = public`, 명시적 workspace membership 확인, `anon` 권한 회수, `authenticated` 실행 권한 부여.
- `createOrderRepository.saveOrder`가 별도 `orders` / `order_change_requests` mutation 대신 RPC를 호출하도록 변경.
- `mapOrderToRow`, `mapOrderFromRow`를 TypeScript domain 객체와 DB row 사이의 경계로 계속 사용.
- Checklist 저장은 제외.
- 오프라인 mutation queue는 제외.
- Load query 또는 index 변경은 제외.
- 주문 삭제 또는 설정 저장 동작은 제외.
- UI 변경은 제외.

---

## File Structure

- Modify `src/domain/orderRepository.ts`
  - Responsibility: Supabase-backed order persistence boundary.
  - Add RPC support to `SupabaseLike`.
  - Add `SaveOrderWithDetailsRow` and a small mapper from RPC row to `CapturedOrder`.
  - Replace `saveOrder` separate mutations with `rpc('save_order_with_details', ...)`.

- Modify `src/domain/orderRepository.test.ts`
  - Responsibility: repository unit tests and Supabase mock behavior.
  - Extend the mock with `rpc`.
  - Replace old save-order mutation expectations with RPC expectations.
  - Add tests for blank change request payload and RPC error propagation.

- Create `supabase/migrations/20260709000000_save_order_with_details_rpc.sql`
  - Responsibility: database transaction boundary for order + current change request save.
  - Define `public.save_order_with_details`.
  - Revoke/Grant execute permissions.

---

### Task 1: Repository saveOrder RPC 전환

**Files:**
- Modify: `src/domain/orderRepository.ts:73-103`
- Modify: `src/domain/orderRepository.ts:160-190`
- Modify: `src/domain/orderRepository.ts:240-278`
- Test: `src/domain/orderRepository.test.ts:33-139`
- Test: `src/domain/orderRepository.test.ts:249-390`

**Interfaces:**
- Consumes: `mapOrderToRow(order: CapturedOrder, workspaceId: string): OrderRow`
- Consumes: `mapOrderFromRow(row: OrderRow, latestChangeRequest?: LatestChangeRequest): CapturedOrder`
- Produces: `createOrderRepository(supabase).saveOrder(workspaceId: string, order: CapturedOrder): Promise<CapturedOrder>`
- Produces: `supabase.rpc('save_order_with_details', { target_workspace_id, order_payload, change_request_payload })`

- [ ] **Step 1: Add failing RPC mock support and save-order RPC tests**

In `src/domain/orderRepository.test.ts`, change `createSupabaseMock` signature so it can return RPC data/errors:

```typescript
function createSupabaseMock({
  orderRows = [],
  settingsRow = null,
  changeRequestRows = [],
  savedOrderRow,
  insertedChangeRequestRow = null,
  updatedChangeRequestRow = null,
  saveOrderRpcRow = null,
  rpcError = null,
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
  rpcError?: Error | null;
  savedSettingsRow?: WorkspaceSettingsRow;
} = {}) {
```

In the returned mock object, add `rpc` next to `from`:

```typescript
  const rpc = vi.fn((functionName: string, args: unknown) => {
    record('rpc', functionName, [args]);
    return Promise.resolve({ data: saveOrderRpcRow ? [saveOrderRpcRow] : [], error: rpcError });
  });

  return { from, rpc, calls };
```

Replace the existing test named `saves an order row and upserts a change request when note exists` with:

```typescript
  it('saves an order and change request through the transactional RPC', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '  쇼핑백 2개로 변경  ',
      changeRequestConfirmed: false,
    };
    const orderRow = toOrderRow(order);
    const supabase = createSupabaseMock({
      saveOrderRpcRow: {
        ...orderRow,
        change_request_id: 'inserted-change',
        change_request_note: '쇼핑백 2개로 변경',
        change_request_confirmed: false,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      id: order.id,
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: false,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('save_order_with_details', {
      target_workspace_id: workspaceId,
      order_payload: orderRow,
      change_request_payload: {
        note: '쇼핑백 2개로 변경',
        confirmed: false,
      },
    });
    expect(supabase.calls.some((call) => call.table === 'orders' && call.method === 'upsert')).toBe(false);
    expect(
      supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'upsert'),
    ).toBe(false);
  });
```

Replace `upserts a change request instead of selecting and updating the latest row` with:

```typescript
  it('maps the RPC change request response without selecting or updating child rows directly', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: true,
    };
    const supabase = createSupabaseMock({
      saveOrderRpcRow: {
        ...toOrderRow(order),
        change_request_id: 'latest-change',
        change_request_note: '쇼핑백 2개로 변경',
        change_request_confirmed: true,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: true,
    });
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'select')).toBe(false);
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'update')).toBe(false);
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'insert')).toBe(false);
  });
```

Replace `clears all active change request rows for the order when note is empty` with:

```typescript
  it('sends a null change request payload when the note is empty', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '   ',
      changeRequestConfirmed: false,
    };
    const supabase = createSupabaseMock({
      saveOrderRpcRow: {
        ...toOrderRow(order),
        change_request_id: null,
        change_request_note: null,
        change_request_confirmed: null,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      changeRequestNote: '',
      changeRequestConfirmed: false,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('save_order_with_details', {
      target_workspace_id: workspaceId,
      order_payload: toOrderRow(order),
      change_request_payload: null,
    });
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'delete')).toBe(false);
  });
```

Add this test after the blank-note test:

```typescript
  it('throws RPC errors when saving an order fails', async () => {
    const order = createNasdaqSampleOrder();
    const supabase = createSupabaseMock({ rpcError: new Error('rpc failed') });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).rejects.toThrow('rpc failed');
  });
```

- [ ] **Step 2: Run the focused repository test to verify it fails**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: FAIL. The failures should mention missing `supabase.rpc` support in `createOrderRepository` or old direct mutation behavior.

- [ ] **Step 3: Add RPC types and mapper in `orderRepository.ts`**

In `src/domain/orderRepository.ts`, add `rpc` to `SupabaseLike`:

```typescript
type SupabaseLike = {
  from(table: string): {
    select<T>(columns?: string): SelectQuery<T>;
    upsert<T>(payload: unknown, options?: unknown): MutationQuery<T>;
    insert<T>(payload: unknown): MutationQuery<T>;
    update<T>(payload: unknown): MutationQuery<T>;
    delete<T>(): MutationQuery<T>;
  };
  rpc<T>(functionName: string, args?: Record<string, unknown>): QueryResult<T>;
};
```

After `interface ChangeRequestRow`, add:

```typescript
interface SaveOrderWithDetailsRow extends OrderRow {
  change_request_id: string | null;
  change_request_note: string | null;
  change_request_confirmed: boolean | null;
}
```

After `mapOrderFromRow`, add:

```typescript
const mapOrderFromSaveOrderRpcRow = (row: SaveOrderWithDetailsRow): CapturedOrder => {
  const latestChangeRequest =
    row.change_request_note === null
      ? undefined
      : {
          id: row.change_request_id ?? '',
          note: row.change_request_note,
          confirmed: row.change_request_confirmed ?? false,
        };

  return mapOrderFromRow(row, latestChangeRequest);
};
```

- [ ] **Step 4: Replace `saveOrder` implementation with RPC call**

In `src/domain/orderRepository.ts`, replace the entire `async saveOrder(workspaceId, order) { ... }` body with:

```typescript
    async saveOrder(workspaceId, order) {
      const orderRow = mapOrderToRow(order, workspaceId);
      const note = order.changeRequestNote.trim();
      const result = await supabase.rpc<SaveOrderWithDetailsRow[]>('save_order_with_details', {
        target_workspace_id: workspaceId,
        order_payload: orderRow,
        change_request_payload: note
          ? {
              note,
              confirmed: order.changeRequestConfirmed,
            }
          : null,
      });

      throwIfError(result.error);

      const [savedOrder] = result.data ?? [];
      if (!savedOrder) {
        throw new Error('주문 저장 결과를 확인할 수 없습니다.');
      }

      return mapOrderFromSaveOrderRpcRow(savedOrder);
    },
```

- [ ] **Step 5: Run the focused repository test to verify it passes**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: PASS. All `orderRepository` tests pass.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add src/domain/orderRepository.ts src/domain/orderRepository.test.ts
git commit -m "refactor: save orders through rpc"
```

Expected: commit succeeds with only repository and repository test changes.

---

### Task 2: Supabase RPC Migration 추가

**Files:**
- Create: `supabase/migrations/20260709000000_save_order_with_details_rpc.sql`
- Test: static migration review by command output

**Interfaces:**
- Consumes: `public.is_workspace_member(target_workspace_id uuid): boolean`
- Consumes: tables `public.orders` and `public.order_change_requests`
- Produces: `public.save_order_with_details(target_workspace_id uuid, order_payload jsonb, change_request_payload jsonb default null)`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260709000000_save_order_with_details_rpc.sql` with:

```sql
create or replace function public.save_order_with_details(
  target_workspace_id uuid,
  order_payload jsonb,
  change_request_payload jsonb default null
)
returns table (
  id uuid,
  workspace_id uuid,
  source text,
  status text,
  raw_text text,
  customer_name text,
  phone text,
  order_items text,
  quantity text,
  purpose text,
  fulfillment_type text,
  desired_date_time text,
  pickup_time text,
  address text,
  allergy_note text,
  options text,
  customer_request_note text,
  owner_memo text,
  parsed_date jsonb,
  menu_matches jsonb,
  quantity_candidates jsonb,
  manually_edited_fields jsonb,
  reparse_differences jsonb,
  missing_fields jsonb,
  review_reasons jsonb,
  warning_level text,
  created_at timestamptz,
  updated_at timestamptz,
  change_request_id uuid,
  change_request_note text,
  change_request_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_order public.orders%rowtype;
  saved_change_request public.order_change_requests%rowtype;
  trimmed_note text := nullif(trim(coalesce(change_request_payload->>'note', '')), '');
  confirmed_value boolean := coalesce((change_request_payload->>'confirmed')::boolean, false);
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Only workspace members can save orders';
  end if;

  if (order_payload->>'workspace_id')::uuid is distinct from target_workspace_id then
    raise exception 'order workspace_id must match target_workspace_id';
  end if;

  insert into public.orders (
    id,
    workspace_id,
    source,
    status,
    raw_text,
    customer_name,
    phone,
    order_items,
    quantity,
    purpose,
    fulfillment_type,
    desired_date_time,
    pickup_time,
    address,
    allergy_note,
    options,
    customer_request_note,
    owner_memo,
    parsed_date,
    menu_matches,
    quantity_candidates,
    manually_edited_fields,
    reparse_differences,
    missing_fields,
    review_reasons,
    warning_level,
    created_at,
    updated_at
  )
  values (
    (order_payload->>'id')::uuid,
    target_workspace_id,
    order_payload->>'source',
    order_payload->>'status',
    order_payload->>'raw_text',
    coalesce(order_payload->>'customer_name', ''),
    coalesce(order_payload->>'phone', ''),
    coalesce(order_payload->>'order_items', ''),
    coalesce(order_payload->>'quantity', ''),
    coalesce(order_payload->>'purpose', ''),
    coalesce(order_payload->>'fulfillment_type', ''),
    coalesce(order_payload->>'desired_date_time', ''),
    coalesce(order_payload->>'pickup_time', ''),
    coalesce(order_payload->>'address', ''),
    coalesce(order_payload->>'allergy_note', ''),
    coalesce(order_payload->>'options', ''),
    coalesce(order_payload->>'customer_request_note', ''),
    coalesce(order_payload->>'owner_memo', ''),
    order_payload->'parsed_date',
    coalesce(order_payload->'menu_matches', '[]'::jsonb),
    coalesce(order_payload->'quantity_candidates', '[]'::jsonb),
    coalesce(order_payload->'manually_edited_fields', '[]'::jsonb),
    coalesce(order_payload->'reparse_differences', '[]'::jsonb),
    coalesce(order_payload->'missing_fields', '[]'::jsonb),
    coalesce(order_payload->'review_reasons', '[]'::jsonb),
    coalesce(order_payload->>'warning_level', 'none'),
    (order_payload->>'created_at')::timestamptz,
    (order_payload->>'updated_at')::timestamptz
  )
  on conflict (id) do update
  set
    source = excluded.source,
    status = excluded.status,
    raw_text = excluded.raw_text,
    customer_name = excluded.customer_name,
    phone = excluded.phone,
    order_items = excluded.order_items,
    quantity = excluded.quantity,
    purpose = excluded.purpose,
    fulfillment_type = excluded.fulfillment_type,
    desired_date_time = excluded.desired_date_time,
    pickup_time = excluded.pickup_time,
    address = excluded.address,
    allergy_note = excluded.allergy_note,
    options = excluded.options,
    customer_request_note = excluded.customer_request_note,
    owner_memo = excluded.owner_memo,
    parsed_date = excluded.parsed_date,
    menu_matches = excluded.menu_matches,
    quantity_candidates = excluded.quantity_candidates,
    manually_edited_fields = excluded.manually_edited_fields,
    reparse_differences = excluded.reparse_differences,
    missing_fields = excluded.missing_fields,
    review_reasons = excluded.review_reasons,
    warning_level = excluded.warning_level,
    updated_at = excluded.updated_at
  where orders.workspace_id = target_workspace_id
  returning * into saved_order;

  if saved_order.id is null then
    raise exception 'Order not found in target workspace';
  end if;

  if trimmed_note is null then
    delete from public.order_change_requests ocr
    where ocr.workspace_id = target_workspace_id
      and ocr.order_id = saved_order.id;
  else
    insert into public.order_change_requests (
      workspace_id,
      order_id,
      note,
      confirmed
    )
    values (
      target_workspace_id,
      saved_order.id,
      trimmed_note,
      confirmed_value
    )
    on conflict (workspace_id, order_id) do update
    set
      note = excluded.note,
      confirmed = excluded.confirmed
    returning * into saved_change_request;
  end if;

  return query
  select
    saved_order.id,
    saved_order.workspace_id,
    saved_order.source,
    saved_order.status,
    saved_order.raw_text,
    saved_order.customer_name,
    saved_order.phone,
    saved_order.order_items,
    saved_order.quantity,
    saved_order.purpose,
    saved_order.fulfillment_type,
    saved_order.desired_date_time,
    saved_order.pickup_time,
    saved_order.address,
    saved_order.allergy_note,
    saved_order.options,
    saved_order.customer_request_note,
    saved_order.owner_memo,
    saved_order.parsed_date,
    saved_order.menu_matches,
    saved_order.quantity_candidates,
    saved_order.manually_edited_fields,
    saved_order.reparse_differences,
    saved_order.missing_fields,
    saved_order.review_reasons,
    saved_order.warning_level,
    saved_order.created_at,
    saved_order.updated_at,
    saved_change_request.id,
    saved_change_request.note,
    saved_change_request.confirmed;
end;
$$;

revoke all on function public.save_order_with_details(uuid, jsonb, jsonb) from anon;
grant execute on function public.save_order_with_details(uuid, jsonb, jsonb) to authenticated;
```

- [ ] **Step 2: Run static migration checks**

Run:

```powershell
Select-String -Path supabase\migrations\20260709000000_save_order_with_details_rpc.sql -Pattern 'security definer|set search_path = public|is_workspace_member|revoke all|grant execute'
```

Expected: output includes all five required patterns.

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Run repository tests again**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

Run:

```powershell
git add supabase/migrations/20260709000000_save_order_with_details_rpc.sql
git commit -m "db: add save order transaction rpc"
```

Expected: commit succeeds with only the migration file.

---

### Task 3: Final Verification

**Files:**
- Verify only; no planned file edits.

**Interfaces:**
- Consumes: Task 1 repository RPC implementation.
- Consumes: Task 2 Supabase migration.
- Produces: verified branch ready for review.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- src/domain/orderRepository.test.ts --run
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

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
git commit -m "fix: align save order rpc verification"
```

Expected: repository ends with a clean worktree.

---

## Self-Review

Spec coverage:

- RPC migration is covered by Task 2.
- Repository `saveOrder` RPC call is covered by Task 1.
- `mapOrderToRow` and `mapOrderFromRow` boundary is preserved in Task 1.
- RPC permissions and membership checks are covered by Task 2.
- Checklist, offline mutation, load query/index, delete-order/settings-save, and UI changes are excluded from all tasks.

Placeholder scan:

- No placeholder tokens or incomplete implementation steps are present.
- Code-changing steps include exact snippets.
- Test commands and expected outcomes are explicit.

Type consistency:

- `SaveOrderWithDetailsRow` extends `OrderRow` and matches the RPC return columns.
- `change_request_payload` uses trimmed `note` and `confirmed`.
- `saveOrder` public signature remains unchanged.
