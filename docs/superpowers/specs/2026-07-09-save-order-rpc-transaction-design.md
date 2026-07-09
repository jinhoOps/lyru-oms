# 주문 저장 RPC 트랜잭션 설계

## 배경

현재 `createOrderRepository.saveOrder`는 Supabase에 주문을 저장할 때 두 갈래의 mutation을 순서대로 실행한다.

- `orders.upsert(...)`
- 변경 요청 메모가 있으면 `order_change_requests.upsert(...)`
- 변경 요청 메모가 비어 있으면 `order_change_requests.delete(...)`

각 요청 자체는 올바르지만, 앱 입장에서는 하나의 원자적 작업이 아니다. 주문 저장 후 변경 요청 저장 전에 네트워크 또는 DB 오류가 나면, 사장님 화면에서 보던 주문/변경 요청 상태와 DB 상태가 어긋날 수 있다.

이번 slice의 목표는 기존 주문 저장 흐름의 데이터 안정성을 높이는 것이다. 오프라인 mutation, 체크리스트 편집, 동기화 구조 변경은 포함하지 않는다.

## 결정

주문 row와 현재 변경 요청 상태를 하나의 DB 트랜잭션에서 저장하는 Supabase RPC를 추가한다.

```sql
public.save_order_with_details(
  target_workspace_id uuid,
  order_payload jsonb,
  change_request_payload jsonb default null
)
```

첫 구현은 주문과 현재 변경 요청만 저장한다. 함수명과 클라이언트 호출 구조는 나중에 checklist 세부 정보를 붙이기 쉬운 형태로 두되, 이번 PR에서는 checklist 저장 동작을 추가하지 않는다.

## 범위

포함:

- `public.save_order_with_details`를 정의하는 Supabase migration 추가.
- 기존 RPC 패턴 유지: `security definer`, `set search_path = public`, 명시적 workspace membership 확인, `anon` 권한 회수, `authenticated` 실행 권한 부여.
- `createOrderRepository.saveOrder`가 별도 `orders` / `order_change_requests` mutation 대신 RPC를 호출하도록 변경.
- `mapOrderToRow`, `mapOrderFromRow`를 TypeScript domain 객체와 DB row 사이의 경계로 계속 사용.
- repository 테스트에 RPC payload 형태, 공백 변경 요청 처리, 반환 row 매핑, RPC 오류 전파를 추가.

제외:

- Checklist 저장.
- 오프라인 mutation queue.
- Load query 또는 index 변경.
- 주문 삭제 또는 설정 저장 동작.
- UI 변경.

## RPC 계약

입력:

- `target_workspace_id uuid`: 저장할 workspace 경계.
- `order_payload jsonb`: 현재 `OrderRow`를 JSON으로 표현한 값.
- `change_request_payload jsonb default null`: 현재 변경 요청 상태. 없으면 `null`.

클라이언트 payload 형태:

```typescript
{
  target_workspace_id: workspaceId,
  order_payload: mapOrderToRow(order, workspaceId),
  change_request_payload: order.changeRequestNote.trim()
    ? {
        note: order.changeRequestNote.trim(),
        confirmed: order.changeRequestConfirmed,
      }
    : null,
}
```

반환 형태:

저장된 주문 column과 nullable 변경 요청 column을 가진 row 하나를 반환한다.

- 현재 `OrderRow`가 표현하는 모든 `orders` column
- `change_request_id text | null`
- `change_request_note text | null`
- `change_request_confirmed boolean | null`

TypeScript repository는 반환된 주문 column을 `mapOrderFromRow`로 매핑한다. `change_request_note`가 `null`이 아니면 `LatestChangeRequest`와 호환되는 객체를 만들어 `mapOrderFromRow`에 전달한다.

## DB 동작

`public.save_order_with_details` 내부 동작:

1. `public.is_workspace_member(target_workspace_id)`가 false면 거부한다.
2. `order_payload->>'workspace_id'`가 `target_workspace_id`와 일치하는지 검증한다.
3. `public.orders`에 주문을 upsert한다.
4. `change_request_payload`가 null이거나 trimmed `note`가 비어 있으면 해당 workspace/order의 `order_change_requests` row를 삭제한다.
5. note가 있으면 `(workspace_id, order_id)` 기준으로 `public.order_change_requests` row 하나를 upsert하고 trimmed note와 confirmed 값을 저장한다.
6. 저장된 주문과 현재 변경 요청 필드를 반환한다.

PostgreSQL 함수는 하나의 트랜잭션 안에서 실행되므로, 예외가 발생하면 주문 저장과 변경 요청 저장이 함께 rollback된다.

## 클라이언트 데이터 흐름

`createOrderRepository.saveOrder(workspaceId, order)`는 다음 순서로 동작한다.

1. `orderRow = mapOrderToRow(order, workspaceId)`를 만든다.
2. trimmed note 기준으로 `changeRequestPayload`를 만든다.
3. `supabase.rpc('save_order_with_details', { target_workspace_id, order_payload, change_request_payload })`를 호출한다.
4. 기존 `throwIfError`로 Supabase 오류를 던진다.
5. 오류 없이 row가 없으면 `주문 저장 결과를 확인할 수 없습니다.` 오류를 던진다.
6. 반환 row를 `CapturedOrder`로 매핑한다.

`loadWorkspaceData`, `deleteOrders`, `saveSettings`는 변경하지 않는다.

## 오류 처리

workspace membership 실패와 workspace 경계 불일치는 RPC에서 오류로 처리한다. 앱은 기존 주문 저장 실패 경로를 통해 이 오류를 표시한다.

RPC transport 또는 DB 오류는 현재 Supabase mutation 오류와 같은 방식으로 처리한다. `throwIfError`가 오류를 던지고, `App`은 이미 테스트로 보장된 local draft / status 동작을 유지한다.

RPC가 오류 없이 row를 반환하지 않으면 repository가 `주문 저장 결과를 확인할 수 없습니다.` 오류를 던진다.

## 테스트

Repository unit test에서 확인할 항목:

- `saveOrder`가 `rpc('save_order_with_details', ...)`를 호출하고, mapped order row와 trimmed change request payload를 전달한다.
- `changeRequestNote`가 비어 있거나 공백뿐이면 `change_request_payload: null`을 전달한다.
- RPC 반환 row가 `changeRequestNote`, `changeRequestConfirmed`를 가진 `CapturedOrder`로 매핑된다.
- RPC 오류가 그대로 throw된다.
- `saveOrder` 테스트에서 직접 `orders.upsert`, `order_change_requests.upsert`, `order_change_requests.delete` 호출 기대를 제거한다.

Migration review에서 확인할 항목:

- 함수가 `security definer`와 `set search_path = public`을 사용한다.
- 함수가 workspace membership을 확인한다.
- 함수가 workspace id 불일치를 거부한다.
- `anon` 실행 권한을 회수하고 `authenticated`에 실행 권한을 부여한다.

## 위험

가장 큰 위험은 TypeScript에서 typed row로 다루던 값을 `jsonb`로 넘기면서 타입 명확성이 약해지는 것이다. 이를 줄이기 위해 클라이언트 payload는 반드시 `mapOrderToRow`에서 만들고, 테스트에서 정확한 RPC 인자를 확인한다.

또 다른 위험은 `security definer`로 쓰기 권한이 의도보다 넓어지는 것이다. 함수는 쓰기 전에 반드시 `is_workspace_member`와 workspace 경계 검사를 수행해야 한다.

Checklist 지원은 이번 PR에 숨겨 넣지 않는다. RPC 이름과 payload 구조는 확장 가능하게 두지만, checklist 저장은 UI 흐름이 생긴 뒤 별도 설계로 다룬다.
