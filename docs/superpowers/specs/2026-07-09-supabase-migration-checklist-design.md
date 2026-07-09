# Supabase migration 적용 누락 방지 설계

## 배경

최근 계정관리 화면에서 `list_workspace_members` RPC 호출이 404로 실패했다. 원인은 앱 코드와 GitHub Pages 배포는 완료됐지만, 원격 Supabase DB에 필요한 migration SQL이 아직 적용되지 않은 상태였다.

Lyru OMS는 Supabase RPC를 점점 더 많이 사용하고 있다. 주문 저장, 계정관리, 최신 변경 요청 로딩처럼 핵심 흐름이 RPC에 의존하므로, 프론트 배포와 DB migration 적용이 분리되어 있다는 사실을 배포 때마다 확인해야 한다.

이번 slice는 자동화가 아니라 운영 체크리스트를 만든다. 퍼블릭 저장소에 배포되므로 Supabase 프로젝트 정보나 실제 운영 데이터가 노출되지 않는 문서만 작성한다.

## 목표

`docs/operations/supabase-migration-checklist.md`를 추가해 Supabase migration 적용 누락을 배포 전에 확인할 수 있게 한다.

문서는 개발자가 배포 시 참고하는 공개 가능한 절차서다. 실제 Supabase URL, project id, API key, 계정 이메일, workspace id, 주문 데이터는 포함하지 않는다.

## 범위

포함:

- 공개 가능한 Supabase migration 적용 체크리스트 문서 추가.
- 새 `supabase/migrations/*.sql` 파일 확인 절차.
- SQL Editor 또는 개인 로컬 CLI로 migration을 적용한다는 일반 절차.
- 앱에서 확인할 smoke test 항목.
- `/rest/v1/rpc/<function_name>` 404의 해석 기준.
- 완료 기준: GitHub Pages 배포 성공, Supabase migration 적용, smoke test 통과.

제외:

- Supabase CLI 설정 파일 추가.
- DB 접속 정보, 프로젝트 URL, API key, 계정 이메일, workspace id 기록.
- CI 자동 migration 적용.
- 원격 DB에 직접 migration 적용.
- 앱 UI 변경.

## 문서 구조

새 문서는 다음 섹션을 가진다.

1. **목적**
   - 프론트 배포와 Supabase migration 적용이 별도 단계임을 명시한다.
   - RPC 404 재발 방지가 핵심임을 적는다.

2. **보안 원칙**
   - 퍼블릭 repo에 민감 정보를 기록하지 않는다.
   - 실제 프로젝트 값은 개인 비공개 메모나 Supabase 콘솔에서만 확인한다.

3. **적용 전 확인**
   - 새 migration 파일 목록을 확인한다.
   - RPC 생성, 권한 변경, index 변경이 있는지 확인한다.
   - 적용 순서가 파일명 timestamp 순서임을 명시한다.

4. **적용 절차**
   - Supabase SQL Editor 또는 개인 로컬 CLI에서 SQL을 적용한다.
   - 이미 적용된 SQL을 중복 실행할 때 안전한지 확인한다.
   - `create or replace function`, `create index if not exists`, `revoke`, `grant` 같은 문장은 적용 후에도 권한 상태를 확인한다.

5. **Smoke test**
   - 로그인 후 작업실 로딩.
   - 주문 목록 로딩.
   - 주문 저장.
   - 계정관리 멤버 목록 로딩.
   - 최신 변경 요청 로딩 경로.
   - RPC 404가 없는지 브라우저 콘솔 또는 네트워크 탭에서 확인.

6. **문제 징후와 해석**
   - `/rest/v1/rpc/<function_name>` 404는 migration 누락 또는 PostgREST schema cache 갱신 문제로 본다.
   - 권한 오류는 migration 적용 여부와 workspace membership/owner 여부를 분리해서 확인한다.

7. **완료 기준**
   - GitHub Pages workflow 성공.
   - Supabase migration 적용 완료.
   - smoke test 통과.
   - 민감 정보가 문서나 커밋에 포함되지 않음.

## 데이터와 보안

문서에는 다음 값을 쓰지 않는다.

- Supabase project URL.
- project id 또는 ref.
- publishable key, anon key, service role key.
- 운영자 또는 고객 이메일.
- workspace id, user id, order id.
- 실제 주문 원문이나 고객 정보.

예시가 필요하면 `<function_name>`, `<workspace>`, `<project>` 같은 placeholder만 사용한다.

## 테스트와 검증

문서-only 변경이므로 자동 테스트는 필요하지 않다.

검증은 다음으로 충분하다.

- Markdown을 읽어 절차가 순서대로 이해되는지 확인한다.
- 민감 정보가 들어가지 않았는지 확인한다.
- `git diff --check`로 whitespace 오류를 확인한다.

## 위험과 대응

가장 큰 위험은 문서가 너무 자세해져 퍼블릭 repo에 운영 정보를 남기는 것이다. 이를 막기 위해 실제 값은 쓰지 않고, 문서 첫 부분에 보안 원칙을 둔다.

두 번째 위험은 문서가 너무 추상적이라 배포 때 도움이 되지 않는 것이다. 이를 막기 위해 smoke test 항목은 실제 앱 기능 이름 기준으로 쓴다.

## 성공 기준

- `docs/operations/supabase-migration-checklist.md`가 추가된다.
- 문서는 민감 정보 없이 공개 가능한 내용만 포함한다.
- 다음에 RPC가 추가되거나 변경될 때 개발자가 적용 전/후 체크를 따라갈 수 있다.
