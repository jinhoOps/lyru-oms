# Order List Default Labels Design

## Context

Lyru OMS Phase 1 focuses on helping a one-person shop owner capture scattered order messages, identify missing information, and avoid missed follow-up work. The current order list exposes too many system-derived labels at once, such as grouped review counts, missing-field details, memo flags, and operational metadata. This makes the list explain the parser instead of helping the owner decide which order needs attention.

The owner-facing list should answer one question quickly: which order should be opened or handled next?

## Goals

- Reduce default order-list labels to the few signals that affect immediate work.
- Keep detailed review counts and reasons available in the order detail modal.
- Show calculated production quantity when the system can derive it confidently.
- Make the view-mode menu easier to scan and tap.
- Preserve the existing calendar-style quantity badge visual language.

## Non-Goals

- Do not change order evaluation rules, parser behavior, required-field settings, or bulk-order thresholds.
- Do not add new order statuses.
- Do not introduce analytics or production-capacity planning in this pass.
- Do not redesign the order detail modal beyond relying on it as the place for detailed review reasons.

## Recommended Approach

Use a "work signal first" list. The order list should show status, D-day, core order summary, customer/date/fulfillment metadata, and only urgent action labels. Everything that explains why a review is needed belongs in detail.

This keeps the list calm while still preventing missed requests.

## Alternatives Considered

### Minimal Labels Only

Only show status and D-day in the list. This gives the cleanest surface but hides unconfirmed change requests, which are high-risk because they often arrive outside the original order message.

### Full Diagnostic Labels

Keep review group counts and missing-field labels in the list. This helps debugging parser output but overloads the owner during daily operation.

### Recommended: Work Signal Labels

Show only labels that change immediate action: status, D-day, and unconfirmed change requests. Detailed review counts and reasons move to the detail modal. This balances quiet scanning with operational safety.

## Order List Display Rules

### Always Visible

- Order status
- D-day badge
- Order summary
- Customer name
- Desired date
- Fulfillment type

### Conditionally Visible

- `변경 확인 필요` when `changeRequestNote` exists and `changeRequestConfirmed` is false
- Calculated quantity badge when a pure production quantity can be derived

### Hidden From Default List

- `정보 N개`
- `확인 N개`
- Missing-field label lists such as `부족 항목: 주문 내용, 수량`
- Raw text preview controls tied only to missing fields
- Owner memo existence flag
- Customer request existence flag
- Registered-at timestamp as a primary row label

These details can remain available in order detail or lower-priority surfaces where they do not compete with the scanning task.

## Quantity Badge

The list should reuse the calendar view's compact quantity badge pattern. The badge shows only the calculated pure production quantity, not explanatory parentheses.

Example display:

- Order summary text: `곶감말이 2구 x 6`
- Quantity badge: `12`

Rules:

- Show the badge whenever the calculated pure quantity is available.
- If calculation is not available, show no quantity badge.
- Do not show fallback text such as `수량 확인`.
- Do not duplicate raw quantity in a separate badge.
- When calculated quantity meets or exceeds the configured bulk threshold, emphasize only the quantity badge with stronger font weight.
- Keep color restrained; emphasis should not create a new warning category.

The badge is an at-a-glance production cue, not a parser explanation.

## View Menu

The view-mode menu should use short labels:

- `목록형`
- `카드형`
- `달력형`

Each option row should be clickable/tappable across the full visible row, including the text area. The mobile touch target should be at least 44px tall. The control should keep radio semantics so keyboard and screen-reader behavior remain clear.

## Component Impact

Primary target:

- `src/components/OrderList.tsx`

Likely style target:

- Existing stylesheet files that define `sortMenuOption`, row badges, and calendar quantity badges.

Data source:

- Existing `quantityCandidates`, `menuMatches`, and quantity rule settings should be used if the current code already exposes enough information for a confident calculated quantity.
- If the existing list lacks a reusable quantity helper, add a small local helper or shared domain helper only if it removes duplication with calendar logic.

## Error Handling

- If quantity parsing is ambiguous, missing, or unsupported, omit the badge.
- If order data contains invalid dates or missing review reasons, existing list behavior should continue.
- If localStorage for view mode is blocked, existing in-memory fallback behavior should remain.

## Testing

Add or update focused tests for:

- View menu labels render as `목록형`, `카드형`, `달력형`.
- Clicking the text/row of a view option changes view mode.
- Review count labels such as `정보 1개` and `확인 1개` no longer render in the default order list.
- Unconfirmed change request label still renders.
- Calculated quantity badge renders when pure quantity can be derived.
- Quantity badge is absent when pure quantity cannot be derived.
- Bulk quantity badge receives emphasis when threshold is met.

Manual verification:

- Desktop list, card, and calendar views remain readable.
- Mobile list and card rows do not wrap awkwardly.
- View menu options are easy to tap.

## Approval Notes

Approved direction:

- Hide review reason counts from the default list.
- Keep detailed review counts in detail only.
- Show calculated pure quantity as a calendar-style badge.
- Omit quantity badge entirely when calculation is not possible.
- Emphasize large quantity only by making the quantity badge stronger.
- Shorten view labels and expand view-option click area.
