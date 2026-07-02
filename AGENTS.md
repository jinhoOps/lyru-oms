# AGENTS.md

## Language

- 기본 응답 언어는 한국어다.
- 코드 식별자, 명령어, 로그, 외부 API 명칭은 원문을 유지하되 설명은 한국어로 쓴다.
- 사용자가 별도로 요청하지 않으면 기획, 설계, 검토, 최종 보고를 한국어로 작성한다.

## Project Context

Lyru OMS는 1인 가게 사장님을 위한 주문 관리 시스템이다. 목표는 네이버 스마트스토어, 네이버 톡톡, 카카오톡 채널, 인스타그램 등으로 흩어진 주문과 요청사항을 한곳에서 확인하고, 희망 발송일과 변경 요청을 놓치지 않게 돕는 것이다.

우선순위는 자동화보다 운영 안정성이다. 사장님이 프리미엄 수제 디저트 생산에 집중할 수 있도록 주문 대장, 요청 변경 관리, 발송일/생산량 확인, 출고 전 검수를 먼저 만든다.

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it before grep/find or reading files when you need to understand or locate code:

- MCP tools, when available: `codegraph_explore` answers most code questions in one call, including relevant symbols' verbatim source and call paths. `codegraph_node` returns one symbol's source and callers, or reads a whole file with line numbers. If the tools are listed but deferred, load them by name via tool search.
- Shell fallback: `codegraph explore "<symbol names or question>"` and `codegraph node <symbol-or-file>` print the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely.

## Working Rules

- Read `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` before planning substantial work.
- Keep scope tied to the current phase unless the user explicitly changes the roadmap.
- Prefer small vertical slices that leave a usable workflow.
- For UI work, prioritize mobile web, readable Korean labels, fast order lookup, and low cognitive load.
- Avoid introducing complex collaboration, automation, or analytics features before the core order and request workflow is reliable.

## Workflow Source of Truth

- GSD `.planning` documents are the product charter, requirements, roadmap, and long-term context store.
- Superpowers skills are the source of truth for current work execution: design, planning, implementation, and verification.
- Before substantial work, read `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` for product context, then continue through the relevant Superpowers skill.
- Start new feature, behavior-change, or workflow-design work with `$superpowers:brainstorming` unless the user explicitly requests a different skill.
- After an approved design, move to `$superpowers:writing-plans` before implementation.
- Run `$gsd-*` commands only when the user explicitly asks for a GSD workflow.
- Do not interpret `.planning/STATE.md` as a GSD execution queue when it conflicts with this section.

## Product Principles

- The system acts like a reliable operations assistant, not a generic dashboard.
- The first screen should answer: what must be made, checked, or shipped today?
- Every order should make source, status, desired ship date, request changes, and unresolved checks easy to see.
- Warning states should prevent missed requests and overloaded production dates.
- Brand tone should be premium and calm: white, warm gold, brown, and dark navy; avoid loud SaaS colors.

## Verification

- Do not claim a feature is complete until relevant tests or manual verification have been run.
- For docs-only changes, verify generated Markdown is readable and internally consistent.
- For frontend work, verify desktop and mobile layouts.
