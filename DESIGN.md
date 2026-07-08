# Lyru OMS Design System

## Overview

Lyru OMS는 주문 관리 도구 카테고리에서 가장 따뜻하고 편집적인(editorial) 인터페이스를 지향합니다. 기본 분위기는 **따뜻한 크림 캔버스**(`{colors.canvas}` — #fffdf8)입니다. 다른 B2B SaaS가 흔히 사용하는 차가운 회백색이 아닌, 프리미엄 수제 디저트 브랜드에 어울리는 의도적으로 따뜻하게 설정된 톤입니다. 제목에는 **세리프 디스플레이**(명조체 - KoPub Batang 등)를 사용하고, 본문에는 **Pretendard** 산스세리프를 매치합니다. 이 조합은 흔한 대시보드라기보다는 문학 출판물 같은 느낌을 줍니다.

브랜드의 활력은 **크림 + 골드/브라운 조합**에서 나옵니다. 골드(`{colors.primary}` — #b98a2f)는 Lyru의 시그니처 강조 색상으로, 주요 CTA와 풀 블리드(full-bleed) 강조 카드에 사용됩니다. 이 색상은 따뜻하고 차분하며, 일반적인 SaaS의 쨍한 파란색이나 차가운 색상과 의도적으로 차별화됩니다.

시스템은 세 가지 표면(Surface) 모드를 교차하여 화면의 리듬을 만듭니다:
1. **크림 캔버스** (`{colors.canvas}`) — 기본 배경 플로어
2. **라이트 크림 카드** (`{colors.surface-card}`) — 주문 리스트 등 콘텐츠 카드 배경
3. **다크 네이비 제품 표면** (`{colors.surface-dark}`) — 중요 경고, 주요 요약 카드, 푸터 등

크림에서 다크 네이비로 이어지는 명도 대비는 화면의 핵심적인 페이싱(Pacing) 리듬입니다.

**Key Characteristics:**
- 따뜻한 크림 캔버스(`{colors.canvas}` — #fffdf8)와 따뜻한 잉크 블랙 텍스트(`{colors.ink}` — #241c17). 브랜드의 가장 중요한 컬러 결정입니다.
- 골드 Primary CTA(`{colors.primary}` — #b98a2f). 개별 버튼에는 제한적으로, 풀 블리드 강조 카드에는 아낌없이 사용합니다.
- 세리프(명조) 디스플레이 제목과 휴머니스트 산스세리프 본문의 결합으로 문학적이고 신중한 목소리를 냅니다.
- 다크 네이비 표면 카드(`{colors.surface-dark}` — #182436)를 통해 중요한 요약 정보와 알림을 추상적인 마케팅 일러스트 대신 실제 제품 크롬(UI)으로 보여줍니다.
- 라이트 크림 콘텐츠 카드(`{colors.surface-card}` — #f8f1e6) — 캔버스보다 약간 어두우며, 콘텐츠 기반 기능 설명이나 개별 주문 단위에 사용됩니다.
- 모서리 둥글기(Border radius)는 계층적입니다: 버튼과 인풋은 `{rounded.md}`(8px), 콘텐츠 카드는 `{rounded.lg}`(12px), 큰 마키(marquee) 컨테이너는 `{rounded.xl}`(16px), 배지는 `{rounded.pill}`.
- 섹션 리듬 `{spacing.section}`(96px) — 모던 SaaS 표준. 카드 내부 패딩은 `{spacing.xl}`(32px)로 여유롭게 유지합니다.

---

## Colors

### Brand & Accent
- **Gold / Primary** (`{colors.primary}` — #b98a2f): Lyru의 시그니처 따뜻한 골드. 모든 주요 CTA 배경, 풀 블리드 강조 카드에 사용됩니다.
- **Gold Active** (`{colors.primary-active}` — #9a7a38): 누르거나 호버했을 때 더 어두워지는 상태.
- **Gold Disabled** (`{colors.primary-disabled}` — #e6d8c7): 채도를 낮춘 크림색 틴트 비활성 상태.
- **Brown / Secondary** (`{colors.secondary}` — #6b3f25): 보조적인 브랜드 웜톤 악센트. 텍스트 링크나 부가적인 강조에 사용됩니다.

### Surface
- **Canvas** (`{colors.canvas}` — #fffdf8): 기본 페이지 플로어. 따뜻한 크림색 — 의도적으로 순백색이 아닙니다.
- **Surface Soft** (`{colors.surface-soft}` — #fcf8f2): 섹션 구분선, 매우 부드러운 밴드 배경.
- **Surface Card** (`{colors.surface-card}` — #f8f1e6): 기능 카드, 주문 콘텐츠 카드. 캔버스보다 한 단계 어둡습니다.
- **Surface Cream Strong** (`{colors.surface-cream-strong}` — #f2e2ca): 선택된 카테고리 탭이나 강조된 섹션 밴드에 쓰이는 더 강한 크림색.
- **Surface Dark** (`{colors.surface-dark}` — #182436): 중요한 경고 카드, 오늘 발송 요약 등 지배적인 다크 표면.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — #233147): 다크 밴드 내부의 떠 있는 카드.
- **Hairline** (`{colors.hairline}` — #e6d8c7): 크림 표면의 1px 테두리 톤. 잉크 선이라기보다 엘리베이션 단계처럼 느껴집니다.
- **Hairline Soft** (`{colors.hairline-soft}` — #eee5d6): 같은 밴드 내부에서 거의 보이지 않는 구분선.

### Text
- **Ink** (`{colors.ink}` — #241c17): 모든 제목과 주요 텍스트. 완전한 검은색이 아닌 따뜻하고 어두운 먹색.
- **Body Strong** (`{colors.body-strong}` — #3c3328): 강조된 단락, 리드 텍스트.
- **Body** (`{colors.body}` — #4c3b25): 기본 본문 텍스트 색상.
- **Muted** (`{colors.muted}` — #74685e): 부제목, 브레드크럼, 보조 텍스트.
- **Muted Soft** (`{colors.muted-soft}` — #9a8c7c): 캡션, 작은 글씨.
- **On Primary** (`{colors.on-primary}` — #ffffff): 골드 버튼 위의 텍스트.
- **On Dark** (`{colors.on-dark}` — #fffdf8): 다크 네이비 표면 위에 쓰는 크림색 텍스트(캔버스 톤을 메아리침).
- **On Dark Soft** (`{colors.on-dark-soft}` — #a6b5c9): 푸터 본문 텍스트, 다크 카드 내 보조 라벨.

### Semantic
- **Success** (`{colors.success}` — #2f7d50): 발송 완료, 확인 완료 등의 "사용 가능" 표시.
- **Warning** (`{colors.warning}` — #c07a22): 확인 필요, 생산량 근접 경고.
- **Error** (`{colors.error}` — #b6423c): 필수 확인 누락, 생산량 초과, 유효성 검사 오류.

---

## Typography

### Font Family
시스템은 제목을 위한 **명조체(Serif)** 디스플레이 폰트(KoPub Batang 또는 Nanum Myeongjo 등)와 본문, 내비게이션, UI 라벨을 위한 **Pretendard(Sans-serif)**를 사용합니다. 코드 블록과 숫자는 **JetBrains Mono**가 처리합니다.

디스플레이/본문의 분리는 편집적(editorial)입니다:
- 명조체 Serif (weight 400~700) ➔ h1, h2, h3, 히어로 디스플레이
- Pretendard Sans (weight 400-600) ➔ 본문, 내비게이션, 버튼, 캡션, 라벨
- JetBrains Mono ➔ 데이터 테이블 숫자, 시스템 로그

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.display-xl}` | 64px | 700 | 1.05 | 메인 히어로 h1 — Serif |
| `{typography.display-lg}` | 48px | 700 | 1.1 | 섹션 헤드 — Serif |
| `{typography.display-md}` | 36px | 700 | 1.15 | 하위 섹션 헤드 — Serif |
| `{typography.display-sm}` | 28px | 700 | 1.2 | 주요 강조 제목 — Serif |
| `{typography.title-lg}` | 22px | 600 | 1.3 | 주요 패널 제목 — Pretendard |
| `{typography.title-md}` | 18px | 600 | 1.4 | 카드 제목, 리드 단락 — Pretendard |
| `{typography.title-sm}` | 16px | 600 | 1.4 | 목록 라벨 — Pretendard |
| `{typography.body-md}` | 16px | 400 | 1.55 | 기본 텍스트 — Pretendard |
| `{typography.body-sm}` | 14px | 400 | 1.55 | 부가 정보, 푸터 본문 — Pretendard |
| `{typography.caption}` | 13px | 600 | 1.4 | 배지 라벨, 캡션 — Pretendard |
| `{typography.code}` | 14px | 400 | 1.6 | 고정폭 데이터 — JetBrains Mono |
| `{typography.button}` | 14px | 600 | 1.0 | 기본 버튼 라벨 — Pretendard |

### Principles
제목에 산스세리프 대신 명조체를 사용하는 것은 Lyru OMS가 단순한 B2B 도구가 아니라 신중하고 고급스러운 브랜드 보이스를 내기 위함입니다. 본문은 정보 확인이 빠르도록 기능적인 Pretendard를 사용합니다.

---

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- **Section padding:** `{spacing.section}` (96px) — 모던 SaaS 리듬.
- **Card internal padding:** `{spacing.xl}` (32px) 기능 카드용; `{spacing.lg}` (24px) 소형 타일용.
- **Callout / CTA bands:** `{spacing.xxl}` (48px) 골드 강조 카드 내부.

### Grid & Container
- **Max content width:** ~1200px 중앙 정렬.
- **편집적 본문:** 데스크톱에서는 좌측 내비게이션, 중앙 목록, 우측 상세 패널 분할. 모바일에서는 단일 컬럼.

### Whitespace Philosophy
크림 캔버스 + 명조 디스플레이 + 넉넉한 내부 패딩은 편집적인 페이싱(pacing)을 만듭니다. 밴드 간의 여백은 96px로 균일하게 유지하고, 카드 내부도 여유(32px)를 두어 글자가 숨 쉴 수 있게 합니다.

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | 그림자 없음, 테두리 없음 | 본문 섹션, 상단 내비게이션, 히어로 밴드 |
| Soft hairline | 1px `{colors.hairline}` 테두리 | 인풋, 서브 내비게이션, 개별 주문 카드 |
| Cream card | `{colors.surface-card}` 배경 — 그림자 없음 | 그룹화된 콘텐츠 카드 |
| Dark surface card | `{colors.surface-dark}` 배경 — 그림자 없음 | 중요한 경고 요약 패널, 집중이 필요한 UI |
| Subtle drop shadow | 희미한 그림자 (낮은 알파값) | 호버 시 떠오르는 상태에만 드물게 사용 |

엘리베이션 철학은 **컬러 블록 우선, 그림자는 드물게(color-block first, shadow rare)**입니다. 대부분의 깊이감은 크림 표면과 다크 표면의 대비에서 나옵니다. 그림자는 최소화합니다.

---

## Shapes

### Border Radius Scale
| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | 배지 악센트, 작은 드롭다운 |
| `{rounded.sm}` | 6px | 작은 인라인 버튼, 드롭다운 항목 |
| `{rounded.md}` | 8px | 기본 CTA 버튼, 텍스트 인풋, 탭 |
| `{rounded.lg}` | 12px | 주요 콘텐츠 카드 (주문 묶음, 패널) |
| `{rounded.xl}` | 16px | 큰 히어로 컨테이너 |
| `{rounded.pill}` | 9999px | 상태 배지, 태그 |
| `{rounded.full}` | 50% | 원형 아이콘 버튼 |

---

## Components

### Buttons
**`button-primary`** — 시그니처 골드 CTA. 배경 `{colors.primary}`, 텍스트 `{colors.on-primary}`(흰색), 타입 `{typography.button}`, 패딩 12px × 20px, 높이 40px, 둥글기 `{rounded.md}`(8px). Active 상태는 `{colors.primary-active}`로 어두워짐.

**`button-secondary`** — 크림 버튼에 헤어라인 테두리. 배경 `{colors.canvas}`, 텍스트 `{colors.ink}`, 1px 테두리.

**`button-secondary-on-dark`** — `{colors.surface-dark}` 카드 위에서 사용. 배경 `{colors.surface-dark-elevated}`, 텍스트 `{colors.on-dark}`. 다크 표면에서는 밝은 버튼으로 반전시키지 않고 계속 다크 톤을 유지.

**`text-link`** — 인라인 본문 링크는 `{colors.secondary}`(브라운). 누를 때 밑줄이 생기며 시스템의 가장 구별되는 디테일 중 하나.

### Cards & Containers
**`feature-card`** — 콘텐츠 그리드에 사용. 배경 `{colors.surface-card}`(약간 더 진한 크림), 둥글기 `{rounded.lg}`(12px), 내부 패딩 `{spacing.xl}`(32px).

**`product-mockup-card-dark`** — 다크 네이비 카드. 배경 `{colors.surface-dark}`, 둥글기 `{rounded.lg}`. 텍스트는 `{colors.on-dark}` 사용. 심각한 경고나 강력하게 집중해야 할 정보를 담을 때 사용.

**`callout-card-gold`** — 주요 액션을 유도하는 풀 블리드 골드 카드. 배경 `{colors.primary}`, 텍스트 `{colors.on-primary}`, 내부 패딩 `{spacing.xxl}`(48px). 골드 표면 자체가 브랜드의 활력(voltage)입니다.

### Inputs & Forms
**`text-input`** — 기본 텍스트 입력란. 배경 `{colors.canvas}`, 텍스트 `{colors.ink}`, 둥글기 `{rounded.md}`(8px), 높이 40px, 1px `{colors.hairline}` 테두리.

**`text-input-focused`** — 포커스 상태. 테두리가 굵어지거나 `{colors.primary}`(골드)로 전환되어 강조됨.

### Tags / Badges
**`badge-pill`** — 상태 라벨 배지. 톤 다운된 컬러 블록 활용. `info`, `warning`, `success` 등의 배경에 맞춘 텍스트 색상 사용.

---

## Do's and Don'ts

### Do
- 모든 페이지를 크림 캔버스에 안착시키십시오. 순백색은 "다른 흔한 도구"처럼 읽힙니다; 따뜻한 틴트가 브랜드 차별화 요소입니다.
- 디스플레이 제목에는 항상 명조(Serif)를 사용하십시오. 본문은 Pretendard를 사용합니다.
- `{colors.primary}`(골드)는 기본 CTA와 풀 블리드 콜아웃 카드에만 보존하십시오. 다른 곳에 액센트로 남발하지 마십시오.
- `{colors.surface-card}`(크림)와 `{colors.surface-dark}`(네이비)를 교대로 배치하십시오. 크림-다크의 리듬감이 브랜드 페이싱 메커니즘입니다.

### Don'ts
- 캔버스에 차가운 회색이나 순백색을 사용하지 마십시오. 크림이 브랜드입니다.
- 세리프 디스플레이 폰트를 너무 두껍게(Black 등) 쓰지 마십시오.
- 차가운 파란색이나 쨍한 시안을 액센트로 쓰지 마십시오.
- 두 개의 동일한 표면 모드를 연속된 밴드에 반복하지 마십시오. 리듬은 교차해야 합니다.

---

## Responsive Behavior

### Breakpoints
- **Mobile (< 768px)**: 햄버거 메뉴; 히어로 h1 축소; 카드 목록 단일 컬럼; 터치 영역 최적화. 모바일에서의 주문 확인이 실제 작업 흐름의 기본값이 되도록 설계합니다.
- **Tablet (768–1199px)**: 2컬럼 또는 목록+상세 패널 구조.
- **Desktop (>= 1200px)**: 넉넉한 여백과 함께 좌측 내비게이션, 중앙 목록, 우측 상세 패널.

### Touch Targets
- `{component.button-primary}`는 최소 40 × 40px.
- 모바일에서 체크박스 및 버튼은 손가락 조작에 충분한 영역(44px)을 확보해야 합니다.

---

## Lyru OMS 기능적 디자인 원칙 (Integration)

새로운 디자인 시스템 안에서도 아래의 Lyru OMS 핵심 기능 원칙은 철저히 준수됩니다.

1. **오늘 할 일을 먼저 보여준다:** 통계보다 오늘 제작/발송/확인해야 할 주문이 최우선.
2. **누락 위험을 조용하지만 분명하게 표시한다:** 다크 네이비 패널이나 경고 텍스트/아이콘을 통해 미확인 변경, 필수 정보 누락, 생산량 초과를 직관적으로 전달.
3. **자동화보다 검증 가능성 우선:** 초기 제품은 수동 입력/가져오기를 허용하되 출처와 이력을 남김.
4. **문구 원칙:** "Pending" 대신 "확인 필요" 등 사장님이 직관적으로 아는 한국어 사용.
5. **요청 체크리스트:** 발송 완료 전에 미완료 체크 항목이 다시 드러나도록 설계.
6. **날짜/물량 표시:** 생산 가능량 초과는 Danger, 근접은 Warning으로 표시하며, 달력보다 "오늘/내일/이번주" 리스트 우선.
7. **접근성:** 텍스트 대비는 WCAG AA 충족, 상태 정보는 색상에만 의존하지 않음.

## 운영 UI 정보 밀도

Lyru OMS의 주문 목록은 파서 결과를 설명하는 화면이 아니라, 사장님이 다음에 열어볼 주문을 고르는 작업 화면입니다. 기본 목록은 항상 "지금 판단에 필요한 신호"만 보여주고, 원인 설명과 세부 개수는 상세 화면으로 보냅니다.

### 주문 목록 기본 노출

- 항상 보임: 상태, D-day, 주문 요약, 고객명, 희망일, 수령 방식.
- 조건부 보임: 미확인 추가/변경 요청, 계산 가능한 순수 제작 수량.
- 기본 숨김: 정보 부족 개수, 확인 사유 개수, 부족 항목 목록, 원문 펼침, 내부 메모 여부, 고객 요청 여부, 등록 시각.

`정보 N개`, `확인 N개`처럼 시스템 판정 과정을 보여주는 라벨은 기본 목록에 두지 않습니다. 사장님에게 필요한 기본 신호는 "확인 필요 상태인가", "변경 요청 확인이 남았는가", "언제까지 얼마나 만들어야 하는가"입니다.

### 수량 표시

목록과 달력의 수량 배지는 같은 시각 언어를 사용합니다. 계산 가능한 경우에만 작은 배지로 순수 제작 수량을 표시합니다. 계산할 수 없으면 대체 문구를 표시하지 않습니다.

- 예: `곶감말이 2구 x 6` 옆에 수량 배지 `12`.
- 대량 주문 기준 이상이면 배지만 굵게 강조합니다.
- 수량 배지는 경고 라벨이 아니라 제작량 확인 보조 정보입니다.

### 보기 선택

보기 전환은 짧고 직접적인 문구를 사용합니다: `목록형`, `카드형`, `달력형`. 메뉴 항목은 라디오 버튼뿐 아니라 글씨와 줄 전체가 터치 대상이어야 하며, 모바일에서 최소 44px 높이를 확보합니다.
