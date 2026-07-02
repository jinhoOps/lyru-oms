# Order Operations UX Refinement Design

Date: 2026-07-02

## Goal

Make the order operations screen faster to scan and less surprising:

- Let the owner quickly edit a missing customer name from the detail title.
- Keep the original order/inquiry text as a preserved source record, with copy-only access.
- Reduce vertical form scanning by aligning labels and inputs on one row where space allows.
- Move change request editing behind an explicit button so it feels intentional.
- Make the order list default to dense list view, remember the chosen view, and move list controls into the section header action area.
- Replace ambiguous "후보" wording with "(예측)".

## Scope

This refinement is limited to the current order list and order detail workflow.

In scope:

- `OrderDetail` header customer-name focus action.
- Read-only raw text display with copy button.
- Detail form label/input layout changes.
- Change request button and collapsible change request edit section.
- Order list view mode default and `localStorage` persistence.
- Source filter in the order list header.
- Sort icon button with menu choices.
- Text changes from "후보" to "(예측)" / "예측".

Out of scope:

- Editing or reparsing the original raw text in the detail view.
- Full change request history with before/after/channel metadata.
- New analytics, bulk actions, or external channel sync.
- Reworking the order capture form beyond moving the existing source selector into the capture section header.

## Detail View Design

### Header Customer Name Action

The detail title currently shows the customer name or `고객명 미정`. Make that title area a button-like control:

- It displays the same visible text as today.
- Clicking it focuses the `고객명` field in the form.
- If the customer name is missing, this gives the owner a direct way to fix the most visible gap.
- If the name exists, the same behavior helps the owner find the edit field without scanning.

Implementation should use a ref map or a dedicated `customerName` input ref rather than querying the DOM by text.

### Read-Only Raw Text

`주문/문의 원문` becomes a preserved source record:

- Render the raw text in a read-only textarea or pre-like block.
- Remove direct editing/reparse from the detail view.
- Add a `복사` button near the raw text.
- Copy uses `navigator.clipboard.writeText(order.rawText)` when available.
- If copying fails, keep the raw text selectable so manual copy still works. A small transient copied state is acceptable but not required for the first pass.

### One-Row Field Layout

Current labels stack above inputs. Change each detail field row to reserve a stable label column and place the input beside it:

- Label column must be wide enough for `사장님 내부 메모` without wrapping.
- Use CSS variables such as `--detail-label-width: 9.5rem` and a responsive grid/flex row.
- Inputs and selects take the remaining width.
- Textareas keep the same label column on desktop/tablet.
- On narrow mobile widths, rows stack vertically to avoid cramped controls.
- Labels should not use negative letter spacing or viewport-scaled font sizes.

This should make the edit modal denser without turning it into a spreadsheet.

### Change Request Button

The change request editor should not appear as an unexplained block above the main fields.

New behavior:

- Add a `변경 요청` button in the detail header action area.
- If `order.changeRequestNote` exists and is not confirmed, show a compact `확인 필요` indicator on or beside the button.
- Clicking the button toggles a collapsible change request section.
- If the order already has a change request note, the section starts open. If there is no note, it starts closed.
- The existing `변경 요청` textarea and `변경 요청 확인됨` checkbox move into this section.
- Existing confirmation reset behavior remains unchanged: editing to different trimmed text resets confirmation, same trimmed text preserves it, empty text is unconfirmed.

## Order List Design

### Default And Persisted View Mode

The list view should be the default because it supports faster scanning.

- Default `viewMode` is `list`.
- Card view remains available through the existing view toggle.
- Persist view mode in `localStorage`, for example key `lyru-oms.orderList.viewMode.v1`.
- Hydrate invalid or absent values to `list`.
- Save only valid values: `list` or `card`.

### Section Header Actions

Move list metadata and controls into the right side of the existing `sectionHeader`.

For `주문 목록`:

- Left side: title and help text.
- Right side: order count, source filter, sort menu button, view toggle.
- Count displays the currently visible count after source filtering and sorting.

For `주문 수집`:

- Move the order source selector into the `sectionHeader` right action area.
- The source selector still controls the source used for newly saved orders.
- On mobile, header actions wrap under the title with full-width touch targets where needed.

### Source Filter

Add source filtering to the order list:

- Choices: `전체`, `네이버 스마트스토어`, `네이버 톡톡`, `카카오톡 채널`, `인스타그램`, `기타`.
- The filter applies before sorting and before count display.
- Empty states should distinguish "no orders yet" from "no orders for this source" if the current filter excludes all orders.
- The selected filter can remain in component state for now. It does not need persistence unless implementation is trivial and does not add complexity.

### Sort Menu Button

Replace the always-visible sort select with an icon button:

- Use a clear sort icon if an icon library already exists. If no icon library exists, use a simple text/icon button with accessible label `정렬 방식`.
- Clicking opens a small menu/list of sort modes.
- Choices stay the same:
  - `희망일 빠른 순`
  - `최근 등록순`
  - `수량 많은 순`
- The active choice should be visually marked and exposed with `aria-pressed` or `aria-current`.
- The menu closes after choosing a sort mode.
- The menu also closes on Escape and when focus leaves the menu area.

## Wording Changes

Replace ambiguous "후보" wording:

- Quantity summary: `180개 / 20개 후보` becomes `180개 / 20개 (예측)`.
- Review reason label: `수량 후보 여러 개` becomes `수량 예측 여러 개`.
- Tests should assert the new Korean copy.

The internal domain name `quantityCandidates` can remain unchanged because it is implementation terminology.

## Data Flow

- `App` owns:
  - `sortMode`
  - source filter
  - captured order source
- `OrderList` owns or receives:
  - persisted `viewMode`.
  - sort menu open state.
- `OrderDetail` owns local UI state:
  - change request section open/closed.
  - raw text copy feedback if implemented.

Storage:

- Use a new localStorage key for order list view mode.
- Keep existing order storage shape unchanged.

## Accessibility And Mobile Requirements

- Header customer-name control must be keyboard focusable and have a clear accessible label such as `고객명 입력으로 이동`.
- Sort menu button must have an accessible name and a reachable set of choices.
- View toggle buttons keep `aria-pressed`.
- Copy button must be a real button.
- Mobile layout must avoid overlapping labels and inputs. If the label column leaves too little input width, field rows stack.
- Touch targets should remain large enough for one-handed mobile use.

## Testing

Add or update tests for:

- Clicking `고객명 미정`/customer name title focuses the `고객명` input.
- Raw text is read-only and copy action calls clipboard when available.
- Change request editor is opened by the header button and no longer appears as an always-visible unexplained block.
- Default list view is list mode.
- View mode persists to and hydrates from localStorage.
- Source filtering changes visible orders and count.
- Sort menu changes sort mode.
- "후보" copy is replaced with "(예측)" / "예측" in parser and review-rule outputs.

Manual verification:

- Desktop detail modal: labels and inputs align in one row without wrapping `사장님 내부 메모`.
- Mobile detail modal: fields remain readable and do not overlap.
- Desktop and mobile order list: header actions wrap cleanly, count/filter/sort/view controls remain usable.
