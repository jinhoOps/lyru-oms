# Lyru OMS

## What This Is

Lyru OMS는 1인 가게 사장님을 위한 주문 관리 시스템이다. 네이버 스마트스토어, 네이버 톡톡, 카카오톡 채널, 인스타그램 등으로 흩어지는 주문과 문의를 한 화면에서 확인하고, 희망 발송일과 변경 요청을 놓치지 않게 관리한다.

초기 제품은 자동화보다 운영 안정성을 우선한다. 사장님이 프리미엄 수제 디저트 생산에 집중할 수 있도록 주문 확인, 일정 확인, 요청사항 체크, 출고 준비를 단순하고 빠르게 만든다.

## Core Value

사장님이 오늘 만들고 보내야 할 주문과 변경 요청을 놓치지 않고 확인할 수 있어야 한다.

## Business Context

- **Customer**: 프리미엄 수제 곶감 디저트와 화과자를 판매하는 1인 가게 사장님
- **Revenue model**: 직접 판매 매출을 운영 효율화로 보호하고 객단가 상승 여지를 만든다
- **Success metric**: 누락 주문, 누락 요청, 발송일 착오를 줄이고 하루 주문 정리 시간을 단축한다
- **Strategy notes**: 생산량 확대보다 품질 유지와 운영 안정화를 우선한다

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] 여러 주문/문의 채널에서 들어온 원문을 한곳에 붙여넣고 가능한 항목을 구조화한다.
- [ ] 희망 발송일 기준으로 오늘, 내일, 이번 주 물량을 확인한다.
- [ ] 주문별 요청사항과 변경 요청을 체크 가능한 작업으로 관리한다.
- [ ] 상태값을 통해 신규, 확인 필요, 제작 준비, 발송 완료 주문을 구분한다.
- [ ] 모바일 화면에서도 빠르게 주문을 확인하고 수정한다.

### Out of Scope

- 네이버/카카오/인스타그램 실시간 API 자동 연동 - v1은 운영 흐름 검증이 먼저이며, 채널별 연동은 정책과 권한 확인 후 진행한다.
- 회계, 세무, 정산 자동화 - 주문 누락 방지가 첫 번째 목표다.
- 재고/원가/마진 정밀 분석 - 생산 안정화 이후 확장한다.
- 고객용 주문 페이지 - v1은 사장님 내부 운영 도구다.

## Context

- 현재 주문은 네이버 스마트스토어와 카카오톡 채널 문의 등으로 분산되어 있다.
- 요청 변경은 네이버 톡톡, 카카오톡, 인스타그램 등 대화 채널에서 발생할 수 있어 수기 기록 누락 위험이 있다.
- 제품은 한국적 베이스의 프리미엄 곶감 디저트와 화과자다.
- 1인 제작 체제라 생산량에는 한계가 있고, 품질 보장이 운영 판단의 핵심 기준이다.
- 비수기에는 원데이 클래스 등 매출 다각화 가능성이 있지만, v1 주문 관리의 핵심 범위는 아니다.

## Constraints

- **사용자 규모**: 1인 운영자 중심 - 협업, 권한, 복잡한 워크플로보다 빠른 단일 사용자 조작을 우선한다.
- **운영 방식**: 초기에는 수동 입력과 CSV/엑셀 가져오기를 허용 - 자동 연동보다 검증 가능한 단순 흐름이 중요하다.
- **디바이스**: 모바일 웹 사용성을 우선 - 작업 중 휴대폰으로 확인하고 수정할 수 있어야 한다.
- **품질 관리**: 생산 한계와 희망 발송일이 최우선 - 과도한 주문 수락보다 일정 위험을 먼저 보여준다.
- **브랜드**: 화이트, 골드, 브라운, 다크 네이비 기반의 절제된 프리미엄 감성 - 과한 장식보다 차분한 운영 도구가 필요하다.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 한국어를 기본 문서 및 UI 언어로 사용한다 | 실제 운영자가 바로 이해하고 사용할 수 있어야 한다 | - Pending |
| v1은 내부 OMS에 집중한다 | 1인 가게의 가장 큰 위험은 주문/요청 누락이다 | - Pending |
| 자동 채널 연동은 v1 이후로 미룬다 | 플랫폼 정책과 인증보다 운영 흐름 검증이 먼저다 | - Pending |
| 모바일 웹 우선으로 설계한다 | 작업 중 PC보다 휴대폰 접근 가능성이 높다 | - Pending |
| Phase 1은 주문 표준화 MVP로 시작한다 | 메시지 원문 보존과 정보 부족 표시가 주문 대장보다 먼저 검증해야 할 운영 리스크다 | Accepted |

## Evolution

After each phase:

1. Move shipped and verified requirements to Validated.
2. Move invalidated requirements to Out of Scope with reason.
3. Add newly discovered operational needs to Active only if they serve the core value.
4. Re-check whether the product still prioritizes production focus over tool complexity.

---
*Last updated: 2026-06-30 after aligning Phase 1 with order standardization MVP*
