# Supabase and PWA Roadmap Design

## Context

Lyru OMS is currently a static GitHub Pages application focused on one-person order operations. The next two large platform changes are Supabase integration and PWA support.

The accepted direction is to make Supabase the source of truth first, then add an operations-grade PWA layer on top. This avoids building offline behavior around a local-only data model that would need to be replaced later.

## Decision

Build in this order:

1. Supabase full database foundation.
2. Supabase Auth login.
3. Workspace membership and RLS authorization.
4. Development-only seed data.
5. Draft storage and recent-order read cache.
6. Operations-grade PWA.

## Hosting and Security Model

The app remains a static GitHub Pages deployment.

The browser app may contain only public Supabase client configuration:

- Supabase project URL.
- Supabase publishable key or legacy anon key.

The browser app must never contain:

- Supabase `service_role` key.
- Supabase secret keys.
- Database password.
- Any credential that bypasses RLS.

Security depends on Supabase Auth plus Postgres RLS, not on hiding frontend routes or hiding the public client key.

## Authentication

Use Supabase email/password authentication.

The app does not provide public sign-up. Accounts are created by the developer or administrator through Supabase tooling.

During development, the developer's Supabase project and account can be used. Later, the production app can move to the shop owner's Supabase project by applying the same migrations, creating the owner account, adding workspace membership, importing data if needed, and changing deployment environment variables.

## Workspace and Roles

The data model must support the current single administrator and a future small family/staff setup.

Use a workspace membership model:

- `workspaces`: one shop or operating unit.
- `workspace_members`: links authenticated users to a workspace.
- `profiles`: optional user-facing metadata for authenticated users.

Initial roles:

- `owner`: can read and write operational data, manage settings, and manage members.
- `staff`: can read and update orders and request workflow data, but cannot manage members or protected settings.

Every operational table stores `workspace_id`. RLS policies allow access only when `auth.uid()` belongs to the matching workspace.

## Database Scope

Supabase is the source of truth for all saved operational data.

Move these domains to Supabase in the first database phase:

- Orders.
- Change requests.
- Checklist or request task items.
- Order status and relevant history fields.
- Admin settings, including required fields and bulk-order threshold.
- Calendar/order list data needed by current views.

Existing localStorage operational data does not need to be migrated. Local development data may be discarded.

## Seed Data

Production starts empty.

Development gets a separate seed path that can insert representative orders, including the existing `나스닥3배` example. Seed data must not run automatically against production.

Seed execution must be explicit and environment-specific.

## Local Storage and Cache

Local storage is no longer the source of truth for saved orders.

Allowed local data:

- In-progress order raw-text draft.
- In-progress order form draft.
- UI preferences such as list view, calendar mode, sort, and filters.
- Recent-order read cache for offline or slow-network lookup.

Recent-order cache policy:

- Cache orders in the desired-shipping-date range from today minus 14 days through today plus 45 days.
- Also cache the 30 most recently updated orders.
- Merge cached sets by order id.
- Include undated orders only when they are in the recent-updated set.
- Treat cached orders as read-only while offline.
- Refresh cache from Supabase when online.
- Clear cached order data on logout.
- Use a 24-hour cache TTL.

## PWA Scope

PWA work happens after the Supabase database foundation is in place.

Target an operations-grade PWA:

- Installable app manifest.
- App icons and theme metadata.
- Static asset caching.
- Offline shell after first load.
- Network status indicator.
- Offline read-only access to recent cached orders after login.
- Draft creation while offline.
- Save retry after reconnect for drafts created offline.

Full offline-first editing of saved orders is out of scope for the first PWA phase. If a cached order is stale or cannot be safely updated, the app should require reconnecting and refreshing from Supabase.

## Environment and Migration Requirements

Supabase configuration must be environment-driven, not hardcoded into source files.

Required migration discipline:

- Schema changes live in versioned SQL migration files.
- RLS policies are committed with the schema.
- Development seed data is separate from migrations.
- Production setup can be reproduced in a new Supabase project.

Production migration path:

1. Create a new Supabase project for the shop owner.
2. Apply migrations.
3. Create the owner auth account.
4. Create the production workspace.
5. Add the owner to `workspace_members`.
6. Import existing operational data only if needed.
7. Update GitHub Pages build environment to the production Supabase URL and publishable key.

## Error Handling

Unauthenticated users see only the login flow.

Authenticated users without workspace membership see a blocked state that explains access is not configured yet.

Database write failures must keep the user's draft available locally and show that saving did not complete.

Offline mode must be explicit. Cached orders should be labelled as offline/read-only data so the operator does not mistake them for live database state.

## Testing and Verification

Supabase work needs tests or verification for:

- Login and logout.
- Blocked state without workspace membership.
- Owner access to workspace data.
- Staff access to permitted workflow data.
- RLS rejection for data outside the user's workspace.
- CRUD flows for orders, change requests, checklist items, and settings.
- Local draft retention after failed save.
- Cache clearing on logout.

PWA work needs tests or manual verification for:

- Installability.
- Offline shell loading after first visit.
- Recent-order cache read while offline.
- Offline draft creation.
- Reconnect save retry.
- Mobile viewport usability.

## Non-Goals

- Public sign-up.
- Customer-facing order pages.
- Real-time channel API integrations.
- Multi-shop enterprise administration.
- Offline-first editing with conflict resolution for saved orders.
- Storing Supabase secret or service keys in the frontend.
