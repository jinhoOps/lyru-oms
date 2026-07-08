# Offline Cache Cap Design

## Context

Lyru OMS currently saves one recent-order cache snapshot in `localStorage` for offline read-only recovery. The snapshot includes orders in the desired shipping window plus the 30 most recently updated orders. This protects nearby operations, but the desired-date window can grow without a hard count limit.

The product goal for this slice is operational safety, not a full offline database: when the network fails, the owner should still see the orders they recently handled and the orders likely to matter soon.

## Decision

Use a small mixed-priority cache policy:

- Always include the 30 most recently updated orders.
- Include orders inside the existing desired shipping window.
- Deduplicate by order id.
- Sort the combined set by `updatedAt` descending.
- Store at most 100 orders total.

This keeps the current `localStorage` payload shape and offline read path unchanged while preventing unbounded cache growth.

## Scope

In scope:

- Add a named total cache limit constant, separate from the existing recent-order limit.
- Apply the total cap only when saving the recent-order cache.
- Keep existing workspace id, TTL, shape validation, and read-only offline behavior.
- Update the offline status message so it clearly tells the owner that an internet connection is required for normal work.
- Add focused tests for the cap and recent-order preservation.

Out of scope:

- IndexedDB or multi-snapshot storage.
- Offline mutation queueing.
- New UI states, offline editing, or offline search features.
- Changing load order, repository behavior, or Supabase synchronization.

## Data Flow

`saveRecentOrderCache(workspaceId, orders, now)` will:

1. Select desired-shipping-window orders using the existing date parsing behavior.
2. Select the 30 most recently updated orders.
3. Merge both selections by `id`.
4. Sort the merged values by `updatedAt` descending.
5. Slice to 100 orders before writing the JSON payload.

`loadRecentOrderCacheSnapshot(workspaceId, now)` will continue to:

1. Read and parse the existing `localStorage` key.
2. Reject missing, malformed, expired, or wrong-workspace payloads.
3. Filter payload orders through the existing minimal `CapturedOrder` guard.
4. Return orders sorted by `updatedAt` descending.

## Error Handling

Storage failures remain non-fatal. Existing `try/catch` wrappers around `localStorage` reads and writes stay unchanged so blocked storage does not break the live workspace.

Date parsing failures, relative dates, and invalid desired dates remain excluded from the desired-shipping-window selection. Such orders can still be cached if they are part of the 30 most recently updated orders.

When the app falls back to the offline cache, the visible status message should say that an internet connection is needed. The cache remains read-only, and mutation attempts continue to show a read-only/offline warning.

## Testing

Add or update `localDraftCache` tests to verify:

- A large desired-date-window set is capped at 100 stored orders.
- The 30 most recently updated orders remain present when the cap is applied.
- Existing TTL, workspace mismatch, malformed storage, and blocked-storage behavior remain covered by the current tests.

## Risks

The main risk is dropping older desired-date-window orders when there are more than 100 combined candidates. This is acceptable for the small slice because the cache is a short-lived offline recovery aid with a 24-hour TTL, not a complete backup.

If offline operations later need complete date-window coverage, that should be handled as a separate IndexedDB or server-backed offline data design.
