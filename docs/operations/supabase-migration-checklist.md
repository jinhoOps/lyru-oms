# Supabase Migration Checklist

## Purpose

Use this checklist whenever a change adds or modifies files under `supabase/migrations/`.

The app deploy and the Supabase database migration are separate steps. If the app calls a new RPC before the matching SQL has been applied to the Supabase project, the browser can show a request like `/rest/v1/rpc/<function_name>` with a 404 response.

## Public Repository Safety

This repository is public. Do not write real operational values in this file, commit messages, issues, or PR descriptions.

Do not record:

- Supabase project URL.
- Supabase project id or ref.
- publishable key, anon key, service role key, or database password.
- owner, staff, or customer email addresses.
- workspace id, user id, order id, or other database ids.
- real order text, customer notes, phone numbers, or addresses.

Use placeholders such as `<project>`, `<workspace>`, and `<function_name>` when examples are needed.

## Before Applying SQL

- [ ] Review `git diff --name-only` and list every new or changed file under `supabase/migrations/`.
- [ ] Apply migration files in timestamp filename order.
- [ ] For every RPC migration, check whether it creates or replaces a function with `security definer`.
- [ ] For every client-facing RPC, check that execution is limited intentionally, including `revoke execute ... from public` when needed.
- [ ] For every index migration, check whether the statement uses `create index if not exists` or whether duplicate application must be avoided manually.
- [ ] Confirm that no migration SQL contains real project values or customer data.

## Applying SQL

Apply the SQL using one of these private operational paths:

- Supabase SQL Editor for the target project.
- A personal local Supabase CLI setup outside this public repository.

Do not add Supabase project configuration, access tokens, database passwords, or generated local config files to this repository.

When applying more than one migration, apply them oldest to newest by filename timestamp.

## Smoke Test After Applying SQL

After the GitHub Pages deploy succeeds and the Supabase SQL has been applied, open the deployed app and verify:

- [ ] Login succeeds.
- [ ] The workspace loads without an RPC 404 in the browser console or network tab.
- [ ] The order list loads.
- [ ] Saving a new order succeeds.
- [ ] Editing an existing order succeeds.
- [ ] Account management opens.
- [ ] Account management member list loads.
- [ ] Latest change request loading does not show `/rest/v1/rpc/list_latest_order_change_requests` as 404.

If the change added a new RPC, add one manual smoke check for the UI path that calls that RPC.

## Interpreting Common Failures

### `/rest/v1/rpc/<function_name>` returns 404

Treat this as a database deployment issue first.

Check:

- [ ] Was the migration that creates `<function_name>` applied to the target Supabase project?
- [ ] Was the SQL applied to the same project used by the deployed app?
- [ ] Does the function signature match the client call?
- [ ] Has the PostgREST schema cache refreshed after the function was created?

### RPC returns a permission or membership error

Treat this separately from a 404.

Check:

- [ ] The user is logged in.
- [ ] The user has the required workspace membership or owner role.
- [ ] The migration includes the intended `revoke` and `grant` statements.
- [ ] The RPC checks the target workspace boundary before reading or writing data.

## Completion Criteria

Migration work is not complete until all of these are true:

- [ ] GitHub Pages workflow completed successfully.
- [ ] Supabase migration SQL was applied to the target project.
- [ ] Smoke test passed on the deployed app.
- [ ] No RPC 404 appears for newly added or changed RPCs.
- [ ] No secrets, project identifiers, account emails, workspace ids, order ids, or customer data were added to the repository.
