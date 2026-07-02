# Workflow Source of Truth Design

## Goal

Lyru OMS에서 GSD 문서와 Superpowers workflow가 동시에 존재해 다음 에이전트가 실행 기준을 혼동하지 않게 한다.

프로젝트는 기존 `.planning` 문서의 제품 맥락과 로드맵 가치를 유지하되, 현재 작업의 설계, 계획, 구현, 검증 흐름은 Superpowers skills를 기준으로 진행한다.

## Decision

권장 접근인 역할 분리 명시와 상태 문서 현재화를 적용한다.

- GSD `.planning` 문서는 제품 헌장, 요구사항, 로드맵, 장기 맥락의 기준 자료로 둔다.
- Superpowers는 현재 작업의 설계, 계획, 구현, 검증 실행 흐름의 기준으로 둔다.
- `$gsd-*` 명령은 사용자가 명시적으로 요청할 때만 실행한다.
- substantial work 전에는 `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`를 읽되, 이후 진행은 관련 Superpowers skill로 한다.
- `.planning/STATE.md`는 실행 명령 큐가 아니라 프로젝트 상태와 다음 Superpowers 진입점을 알려주는 참고 문서로 정리한다.

## Files

### `AGENTS.md`

`Working Rules` 아래에 workflow 기준을 추가한다.

추가할 내용:

- GSD `.planning` 문서의 역할은 제품 배경, 요구사항, 로드맵, 장기 맥락 보관이다.
- 현재 작업의 source of truth는 Superpowers workflow다.
- 새 기능, 동작 변경, 문서화된 작업 설계는 `$superpowers:brainstorming`으로 시작한다.
- 설계 승인 후 구현 계획은 `$superpowers:writing-plans`로 전환한다.
- `$gsd-*`는 사용자가 직접 요청할 때만 실행한다.
- `.planning/STATE.md`의 `Next command`를 GSD 실행 명령처럼 해석하지 않는다.

### `.planning/STATE.md`

현재 GSD 실행 대기 상태처럼 보이는 문구를 Superpowers 기준으로 바꾼다.

변경할 내용:

- `Status`: `active-superpowers-workflow`
- `Planning mode`: `Superpowers execution; GSD documents retained as roadmap context`
- `Next command`: `$superpowers:brainstorming` for new feature/design work
- `Workflow State`에 GSD와 Superpowers 역할 분리를 명시한다.
- Active Phase는 Phase 1로 유지한다.
- Phase 1은 최근 구현이 있으므로 다음 작업은 Phase 1 검증/마감 또는 Phase 2 설계 전환 판단이라고 적는다.

## Non-Goals

- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`를 삭제하거나 재작성하지 않는다.
- GSD 체계를 프로젝트에서 완전히 제거하지 않는다.
- 기존 Superpowers spec/plan 문서를 이동하거나 이름을 바꾸지 않는다.
- 제품 기능 범위나 Phase 순서를 바꾸지 않는다.

## Expected Agent Behavior

다음 에이전트는 substantial work를 시작할 때 `.planning` 문서로 제품 맥락을 읽는다. 이후 실제 진행 방식은 Superpowers skills를 따른다.

예:

- 기능이나 동작 변경 논의: `$superpowers:brainstorming`
- 승인된 설계의 구현 계획: `$superpowers:writing-plans`
- 사용자가 명시한 GSD 작업: 해당 `$gsd-*` 명령

이렇게 하면 `.planning`은 방향을 잃지 않게 해주는 기준 자료가 되고, Superpowers는 오늘 실제로 무엇을 할지 정하는 실행 프로세스가 된다.

## Verification

- `AGENTS.md`만 읽은 에이전트도 GSD와 Superpowers 역할 차이를 이해해야 한다.
- `.planning/STATE.md`만 읽은 에이전트도 `$gsd-discuss-phase 1`을 다음 실행 명령으로 오해하지 않아야 한다.
- 두 파일 모두 Phase 1의 제품 맥락은 유지해야 한다.
- Markdown은 제목, 목록, 상태 항목이 읽기 쉬워야 한다.
