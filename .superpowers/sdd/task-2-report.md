# Task 2: Latest Change Request RPC Migration Report

## 수행 내용
- `supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql`을 신규 생성.
- 브리프의 SQL 본문을 그대로 반영: `order_change_requests_workspace_latest_idx` 인덱스 생성, `public.list_latest_order_change_requests(uuid)` RPC 생성, 권한 제한(`is_workspace_member`), `revoke all`/`grant execute` 설정 추가.

## 변경 파일
- `supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql` (신규 1개)

## 확인/검증
- `Select-String -Path supabase\migrations\20260709010000_latest_order_change_requests_rpc.sql -Pattern 'security definer|set search_path = public|is_workspace_member|distinct on|order_change_requests_workspace_latest_idx|revoke all|grant execute'`
  - 7개 패턴 모두 일치 확인.
- `git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms diff --check`
  - whitespace/error 없음.
- `npm test -- src/domain/orderRepository.test.ts --run`
  - PASS (1 file, 13 tests).

## 커밋
- `db: add latest change request rpc`
- SHA: `22ce811`

## Self-review
- 기능 범위는 요청대로 마이그레이션 파일 1개만 수정.
- 기존 RPC/테이블/권한 패턴과 일치하도록 작성.
- Task 2 목표(마이그레이션 추가 및 정적/테스트 검증) 충족.

## 우려/메모
- `git`이 Windows 워크트리에서 LF→CRLF 경고를 띄웠고, `npm test` 실행 시 `--run` 옵션에 대해 npm 경고가 출력됨(실행 자체는 성공).

## 수정 반영 (Task 2 리뷰 대응)
- 대상 파일: `supabase/migrations/20260709010000_latest_order_change_requests_rpc.sql`
- 조치: `revoke execute on function public.list_latest_order_change_requests(uuid) from public;` 추가하여 `PUBLIC` 기본 실행 권한을 명시적으로 철회.
- 기존 권한 설정은 유지: `revoke all ... from anon;`, `grant execute ... to authenticated;`
- 확인:
  - `Select-String -Path supabase\migrations\20260709010000_latest_order_change_requests_rpc.sql -Pattern 'security definer|set search_path = public|is_workspace_member|distinct on|order_change_requests_workspace_latest_idx|revoke all|grant execute|public.list_latest_order_change_requests'`
    - 7개 패턴(및 `public.list_latest_order_change_requests`) 모두 일치 확인(해당 라인: 14, 15, 18, 31, 1/53/54/55).
  - `git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms diff --check`  
    - whitespace/error 없음.
  - `npm test -- src/domain/orderRepository.test.ts --run`
    - `Test Files 1 passed (1), Tests 13 passed (13)` 통과.
