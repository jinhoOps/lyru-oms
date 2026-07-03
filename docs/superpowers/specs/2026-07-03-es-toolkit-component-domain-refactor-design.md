# es-toolkit Component and Domain Refactor Design

## Context

Lyru OMS is currently focused on Phase 1 order standardization. Recent work improved the mobile order list actions and moved the source filter into a menu. The next improvement is to evaluate whether `toss/es-toolkit` can make component and domain data transformation code clearer without changing behavior.

The project has es-toolkit skills installed globally for guidance, but the app does not yet depend on the `es-toolkit` runtime package. Adding the dependency must be justified by clearer, safer code in repeated transformation paths.

## Goal

Apply es-toolkit only where it improves readability or reduces repeated data transformation logic in existing components and domain utilities.

The refactor must preserve the current user workflow:

- order list filtering, sorting, channel menu, view menu, and action menu behavior
- order detail editing, review reason display, and reparse difference hints
- review rule evaluation, including missing fields and quantity checks
- storage hydration and backward compatibility for saved orders/settings

## Non-Goals

- Do not redesign the UI.
- Do not change Korean labels or interaction behavior.
- Do not add broad utility wrappers around es-toolkit.
- Do not replace simple `map` rendering or JSX conditionals just to use a library.
- Do not migrate code that is clearer with plain JavaScript.

## Candidate Areas

### 1. Order Detail Derived Data

`src/components/OrderDetail.tsx` derives lookup and grouped data before rendering:

- `reparseDifferences` becomes a field lookup map.
- `reviewReasons` is split into `info` and `check` groups.
- missing fields are merged with fallback info reasons.

This is the strongest component-level candidate because the logic is data-oriented and testable. A suitable es-toolkit use may be `keyBy` for field lookup or `groupBy`/`partition` for review reason grouping, if those functions are available and tree-shake cleanly.

### 2. Review Rule Domain Logic

`src/domain/reviewRules.ts` builds missing field sets, preserves duplicate reasons, and combines generated review reasons.

This is a strong domain candidate because behavior is already covered by tests and the code is mostly pure. es-toolkit may help where the code repeatedly filters by reason kind/group or creates keyed collections, but the quantity rule flow should remain explicit because the current conditions encode business rules.

### 3. Storage Hydration and Validation

`src/domain/storage.ts` validates arrays and hydrates older saved data. It has many small validators and compatibility branches.

This is a cautious candidate. es-toolkit should only be used if it makes validation intent clearer without weakening type guards. Backward compatibility is more important than reducing line count.

### 4. Order Sorting

`src/domain/orderSorting.ts` has a custom nullable-key sort with recent-order fallback.

This is a low-priority candidate. The existing comparison logic is explicit and business-specific. Avoid replacing it unless es-toolkit can preserve null placement, direction, and fallback ordering without obscuring behavior.

### 5. App-Level Derived Orders

`src/App.tsx` derives `filteredOrders`, `selectedOrder`, and `displayOrders`.

This is a low-priority candidate. The current logic is short and readable. Keep it unchanged unless another refactor naturally extracts reusable order collection helpers.

## Acceptance Criteria

- `es-toolkit` is added to app dependencies only if at least one refactor materially improves clarity.
- Every changed behavior path has existing or added tests.
- Current tests pass with `npm test -- --run`.
- The production build passes with `npm run build`.
- Desktop and mobile layout behavior is manually checked if component rendering changes.
- No UI label or workflow behavior changes unless explicitly approved later.

## Implementation Strategy

1. Inspect es-toolkit's installed package API or official docs before choosing functions.
2. Start with the smallest high-confidence candidate, likely `OrderDetail` derived data.
3. Use TDD for any changed behavior surface:
   - write or adjust tests that lock the current behavior,
   - refactor with es-toolkit,
   - verify tests still pass.
4. Continue to `reviewRules` only if the first refactor demonstrates clear value.
5. Leave `storage`, `orderSorting`, and `App` unchanged unless a concrete simplification is obvious.

## Risk Controls

- Keep imports direct from `es-toolkit` to preserve bundler tree shaking.
- Prefer domain/helper-level refactors over JSX-heavy changes.
- Do not replace custom type guards with generic predicates unless TypeScript narrowing remains correct.
- Keep quantity and date sorting rules explicit where business meaning matters.
