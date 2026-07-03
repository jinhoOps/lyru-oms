# Order List Calendar View Design

## Context

The order list already supports compact list and card views through the `보기` menu. The next improvement is to add a calendar-style view that helps the owner see each visible order from registration through its desired ship date. The current data model does not have a separate deadline field, so the desired date is the deadline for this feature.

This work continues on the es-toolkit refactor PR. The implementation should use es-toolkit where it makes derived list data clearer, without turning simple date math into utility-heavy code.

## Goals

- Add `달력형 보기` under the existing order list `보기` menu.
- Show visible orders across the period from `createdAt` to desired date.
- Keep the view useful on mobile by favoring a dense timeline over a large monthly calendar grid.
- Keep channel filtering and sorting controls unchanged.
- Use existing order fields and avoid adding a new deadline field.

## Non-Goals

- Do not add production capacity rules or overload warnings.
- Do not add a separate schedule page.
- Do not add a new order deadline field.
- Do not change parser behavior.

## User Experience

The `보기` menu offers three radio options:

- `목록형 보기`
- `카드형 보기`
- `달력형 보기`

When `달력형 보기` is selected, the list body changes to a date timeline. The timeline spans from the earliest visible order registration date to the latest valid desired date among visible orders.

Each date row shows:

- Date label such as `7월 3일`
- A small count of active orders for that date
- Order chips or compact rows for orders that touch that date

For each order:

- The registration date is marked as `등록`.
- Dates between registration and desired date are marked with a quiet progress style.
- The desired date is marked as `마감` and shows the most useful order summary.

Orders without a computable desired date are not forced into the timeline. They appear below the timeline in a `날짜 확인 필요` group, using compact order rows so the owner can open the detail and fix the date.

## Date Rules

- Start date: `createdAt`, converted to an Asia/Seoul calendar date.
- End date: valid explicit desired date from `desiredDateTime`; if that is empty, use `parsedDate`.
- Relative dates or missing dates are treated as unresolved and shown in `날짜 확인 필요`.
- If a valid desired date is earlier than the registration date, show the order only on the registration date with `날짜 확인 필요` styling. This avoids rendering an inverted range while still keeping the order visible.

## Data Derivation

The component should derive calendar data from the visible `orders` prop:

- Normalize each order into either a valid range item or unresolved item.
- Build date entries from the min start date to max end date.
- Associate each range item with the date entries it spans.
- Sort date entries chronologically.

es-toolkit should be used where it improves readability:

- `groupBy` is appropriate for grouping range markers by ISO date.
- `sortBy` is appropriate for chronological date-entry ordering.

Plain helper functions remain appropriate for:

- Asia/Seoul date normalization.
- Expanding an inclusive date range.
- Detecting invalid or inverted ranges.

## Component Boundaries

Keep this within `OrderList.tsx` for the first pass unless the file becomes awkward during implementation. If extraction is needed, prefer small private helpers in the same file before creating a new component file.

The existing `OrderList` public props should not change.

## Styling

The calendar view should reuse the current restrained palette. It should not add a heavy decorative calendar frame.

Mobile behavior:

- Date rows stack vertically.
- Order chips wrap without horizontal scrolling.
- The view must not exceed viewport width.

Desktop behavior:

- The timeline remains a single-column operational list rather than a month grid.
- Rows can use more horizontal space for chips and summaries.

## Accessibility

- The `보기` menu remains a native radio group.
- Calendar date rows should be navigable as normal content, not custom keyboard widgets.
- Order entries remain buttons so selecting an order works like list/card mode.
- Unresolved dates should use visible text, not color alone.

## Testing

Add focused `OrderList` tests for:

- `달력형 보기` appears in the view menu and persists to localStorage.
- A valid order renders from registration date through desired date with `등록` and `마감` markers.
- An order without a valid desired date appears under `날짜 확인 필요`.
- Channel-filtered empty state behavior remains unchanged.

Run the existing component tests, the full test suite, and a production build before updating the PR.
