# 최신 변경 요청 로딩 설계

## 배경

현재 `createOrderRepository.loadWorkspaceData`는 초기 작업실 로딩 시 세 가지 요청을 병렬로 실행한다.

- `orders` 전체 row 로드
- `workspace_settings` 로드
- `order_change_requests` 전체 row 로드

그 뒤 클라이언트에서 `order_change_requests`를 `updated_at desc`, `created_at desc`, `id desc` 순서로 훑으며 주문별 최신 변경 요청 1건만 `Map`에 남긴다. 이 방식은 동작은 맞지만, 변경 요청 이력이 쌓일수록 초기 로딩 payload와 DB 정렬 비용이 커진다.

현재 스키마는 `order_change_requests`를 `(workspace_id, order_id)` 기준 주문당 1건으로 유지한다. 따라서 이번 slice의 목표는 UI 동작과 `CapturedOrder` 데이터 모델을 유지하면서, 변경 요청 조회를 클라이언트의 직접 테이블 조회에서 권한 경계가 있는 RPC로 옮기고 “주문별 최신 1건” 계약을 DB에 두는 것이다. 나중에 변경 요청 이력 모델로 확장하더라도 초기 로딩 경로는 같은 RPC 계약을 유지할 수 있다.

## 결정

주문별 최신 변경 요청만 반환하는 Supabase RPC를 추가한다.

```sql
public.list_latest_order_change_requests(target_workspace_id uuid)
```

`loadWorkspaceData`는 기존 `order_change_requests` 테이블 직접 조회 대신 이 RPC를 호출한다. 주문 row 로딩의 `select('*')`와 전체 주문 수 제한은 이번 slice에서 변경하지 않는다.

## 범위

포함:

- `public.list_latest_order_change_requests` RPC migration 추가.
- RPC는 기존 패턴을 따른다: `security definer`, `set search_path = public`, 명시적 workspace membership 확인, `anon` 권한 회수, `authenticated` 실행 권한 부여.
- RPC는 주문별 최신 변경 요청 1건만 반환한다.
- 최신 기준은 현재 클라이언트와 동일하게 `updated_at desc`, `created_at desc`, `id desc`를 사용한다.
- `createOrderRepository.loadWorkspaceData`의 변경 요청 조회를 RPC 호출로 바꾼다.
- repository 테스트에서 RPC 호출과 기존 mapping 결과를 확인한다.
- 최신 변경 요청 조회를 위한 composite index를 추가한다.

제외:

- 주문 row column 축소.
- 주문 pagination/window 제한.
- 상세 데이터 lazy load.
- UI 변경.
- offline cache 변경.
- `saveOrder` RPC 변경.

## RPC 계약

입력:

- `target_workspace_id uuid`: 변경 요청을 조회할 workspace 경계.

반환 row:

```sql
order_id uuid,
id uuid,
note text,
confirmed boolean,
created_at timestamptz,
updated_at timestamptz
```

TypeScript에서는 기존 `ChangeRequestRow` 구조를 계속 사용한다. 반환 row 수는 주문별 최대 1건이지만, `loadWorkspaceData`의 `Map` 조립은 유지해도 된다. 이렇게 하면 RPC가 중복 row를 반환하지 않는다는 DB 계약에만 클라이언트가 과하게 의존하지 않는다.

## DB 동작

`public.list_latest_order_change_requests`는 다음 순서로 동작한다.

1. `public.is_workspace_member(target_workspace_id)`가 false면 거부한다.
2. `public.order_change_requests`에서 해당 workspace의 row를 조회한다.
3. `distinct on (order_id)` 또는 window function으로 주문별 최신 1건만 선택한다.
4. `updated_at desc`, `created_at desc`, `id desc` 기준을 사용한다.
5. 결과를 최근 변경 순서로 반환한다.

Migration에는 다음 index를 추가한다.

```sql
create index order_change_requests_workspace_latest_idx
on public.order_change_requests (workspace_id, order_id, updated_at desc, created_at desc, id desc);
```

## 클라이언트 데이터 흐름

`createOrderRepository.loadWorkspaceData(workspaceId)`는 다음 흐름을 유지한다.

1. 주문 row 로드.
2. workspace settings 로드.
3. 최신 변경 요청 RPC 호출.
4. 각 결과의 오류를 `throwIfError`로 처리.
5. 최신 변경 요청을 `Map<order_id, ChangeRequestRow>`로 만든다.
6. `mapOrderFromRow(row, latestChangeRequestByOrderId.get(row.id))`로 기존 `CapturedOrder`를 만든다.

`orders.select('*')`는 이번 slice에서 유지한다. 상세/수정 UI가 아직 `CapturedOrder` 전체 필드를 사용하므로, 주문 column 축소는 별도 설계가 필요하다.

## 오류 처리

RPC 권한 실패, DB 오류, 네트워크 오류는 기존 변경 요청 조회 오류와 같은 위치에서 처리한다. `loadWorkspaceData`의 `Promise.all` 결과 중 `changeRequestsResult.error`가 있으면 `throwIfError`가 오류를 던지고, 앱의 기존 load failure/offline cache fallback 경로가 동작한다.

RPC가 빈 배열을 반환하면 변경 요청이 없는 것으로 처리한다.

## 테스트

Repository unit test에서 확인할 항목:

- `loadWorkspaceData`가 `supabase.rpc('list_latest_order_change_requests', { target_workspace_id: workspaceId })`를 호출한다.
- orders/settings 로딩은 기존과 동일하게 유지된다.
- 반환된 최신 변경 요청 row가 `CapturedOrder.changeRequestNote`와 `changeRequestConfirmed`에 매핑된다.
- RPC 오류가 있으면 `loadWorkspaceData`가 reject된다.
- 기존 `order_change_requests` 직접 `select/order` 기대는 제거한다.

Migration static review에서 확인할 항목:

- 함수가 `security definer`와 `set search_path = public`을 사용한다.
- 함수가 `is_workspace_member`를 확인한다.
- 함수가 주문별 최신 1건 선택을 표현한다.
- `anon` 실행 권한을 회수하고 `authenticated`에 실행 권한을 부여한다.
- `order_change_requests_workspace_latest_idx` index가 추가된다.

## 위험

가장 큰 위험은 최신 변경 요청 선택 기준이 기존 클라이언트 기준과 달라지는 것이다. RPC 정렬 기준은 반드시 기존 `selectChangeRequests`와 같은 `updated_at desc`, `created_at desc`, `id desc`를 사용한다.

또 다른 위험은 `security definer` 함수에서 workspace 경계를 느슨하게 처리하는 것이다. 함수는 반드시 `target_workspace_id` membership을 확인하고, 해당 workspace row만 조회해야 한다.

이번 slice는 변경 요청 테이블 직접 조회를 RPC 경계로 옮긴다. 현재 스키마에서는 주문당 변경 요청 1건이므로 즉각적인 row 수 절감보다 권한/쿼리 계약 정리가 핵심이다. 주문 row payload와 주문 수 제한은 그대로 남으므로, 초기 로딩 최적화의 다음 slice로 column 축소 또는 pagination/window 정책을 별도로 다룰 수 있다.
