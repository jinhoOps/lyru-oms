# Account Admin Design

## Goal

로그인한 사용자가 앱 안에서 비밀번호를 변경하고, owner 권한 사용자가 Supabase SQL Editor 없이 workspace 멤버 권한을 관리할 수 있게 한다.

## Design

- 계정 기능은 새 `AccountModal`로 제공한다. 헤더에는 로그인 이메일 버튼을 추가하고, 클릭하면 계정 모달을 연다.
- 비밀번호 변경은 현재 이메일과 현재 비밀번호로 `signInWithPassword`를 한 번 더 수행한 뒤 `updateUser({ password })`를 호출한다. 새 비밀번호와 확인값이 다르거나 너무 짧으면 클라이언트에서 차단한다.
- 관리자 기능은 owner에게만 노출한다. 멤버 목록 조회와 이메일 기반 권한 부여는 Supabase RPC로 처리한다.
- 브라우저에는 `service_role`이나 DB password를 넣지 않는다. RPC는 `security definer`로 `auth.users.email`을 조회하되, 호출자가 해당 workspace owner일 때만 실행된다.
- 초기 관리자 계정 `okho04@gmail.com`, `jsss2536@naver.com`에 owner 권한을 주는 bootstrap SQL을 함께 제공한다.

## Data Flow

1. `AuthGate`가 현재 session email과 workspace membership을 `WorkspaceApp`에 전달한다.
2. `WorkspaceApp`은 `authRepository`를 `AccountModal`에 넘긴다.
3. 비밀번호 변경은 `authRepository.changePassword(email, currentPassword, newPassword)`를 호출한다.
4. owner 관리자 기능은 `authRepository.listWorkspaceMembers(workspaceId)`와 `authRepository.upsertWorkspaceMemberByEmail(workspaceId, email, role)`를 호출한다.

## Verification

- Auth repository tests cover password change, failed current password, member list RPC, member upsert RPC.
- Account modal tests cover validation, successful password change, owner-only admin controls, member upsert refresh.
- Existing app tests continue to pass.
