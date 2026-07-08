# Coding Conventions

**Analysis Date:** 2026-07-08

## Naming Patterns

**Files:**
- Use PascalCase for React component files and matching tests: `src/components/OrderCaptureForm.tsx`, `src/components/OrderCaptureForm.test.tsx`, `src/components/AuthGate.tsx`.
- Use lower camelCase for domain, auth, and lib modules: `src/domain/parser.ts`, `src/domain/orderRepository.ts`, `src/auth/authRepository.ts`, `src/lib/supabaseClient.ts`.
- Keep tests co-located beside the implementation with the same basename and `.test.ts` or `.test.tsx`: `src/domain/storage.test.ts`, `src/lib/supabaseClient.test.ts`.

**Functions:**
- Use lower camelCase for helpers and handlers: `parseRawText` in `src/domain/parser.ts`, `hydrateStoredOrder` in `src/domain/storage.ts`, `handleSaveOrder` in `src/App.tsx`.
- Prefix factory functions with `create`: `createAuthRepository` in `src/auth/authRepository.ts`, `createBrowserSupabaseClient` in `src/lib/supabaseClient.ts`.
- Prefix boolean predicates with `is` or `has`: `isPlainObject` in `src/domain/storage.ts`, `hasSimilarRawText` in `src/domain/parser.ts`.
- Prefix event handlers with `handle`: `handleFieldChange` and `handleRawTextCopy` in `src/components/OrderDetail.tsx`.
- Prefix persistence helpers with `load`, `save`, or `clear`: `loadOrders`, `saveSettings` in `src/domain/storage.ts`; `loadSavedOrderDraft` in `src/domain/localDraftCache.ts`.

**Variables:**
- Use lower camelCase for local values and state variables: `selectedOrder`, `displayOrders`, `workspaceGenerationRef` in `src/App.tsx`.
- Use UPPER_SNAKE_CASE for module constants: `CAPTURE_PANEL_COLLAPSED_KEY` in `src/App.tsx`, `ORDERS_STORAGE_KEY` in `src/domain/storage.ts`.
- Use Korean domain literal unions for operator-facing values where they appear in UI and data: `ORDER_SOURCES`, `ORDER_STATUSES`, `FulfillmentType` in `src/domain/orderTypes.ts`.

**Types:**
- Use PascalCase for interfaces, type aliases, and React props: `CapturedOrder`, `OrderSettings`, `OrderFieldKey` in `src/domain/orderTypes.ts`; `OrderDetailProps` in `src/components/OrderDetail.tsx`.
- Use `readonly` inputs where mutation is not intended: `hasSimilarRawText(rawText: string, existingRawTexts: readonly string[])` in `src/domain/parser.ts`.
- Export domain types from owning modules and import them with `type`: `type CapturedOrder` from `src/domain/orderTypes.ts`, `type AuthRepository` from `src/auth/authTypes.ts`.

## Code Style

**Formatting:**
- No standalone Prettier or Biome config is detected. Formatting follows the existing TypeScript style in `src/App.tsx`, `src/domain/parser.ts`, and `src/components/OrderDetail.tsx`.
- Use two-space indentation.
- Use single quotes for strings and semicolons at statement boundaries.
- Prefer trailing commas in multiline object, array, function-call, and JSX prop lists.
- Keep JSX labels and user-facing copy in Korean, matching `src/App.tsx`, `src/components/AuthGate.tsx`, and `src/components/OrderCaptureForm.tsx`.
- Keep CSS class names lower camelCase, such as `appShell`, `workspaceLayout`, `detailModalBackdrop` in `src/App.css`.

**Linting:**
- No ESLint config is detected. TypeScript strict mode is the primary static quality gate via `tsconfig.json`.
- `tsconfig.json` uses `strict: true`, `isolatedModules: true`, `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, and `noEmit: true`.
- `npm run build` runs `tsc -b && vite build` from `package.json`; use it for type and production-build verification.

## Import Organization

**Order:**
1. External packages first: `react`, `@testing-library/react`, `vitest`, `es-toolkit`, `@supabase/supabase-js`.
2. Same-layer and app modules next: `./App`, `./authRepository`, `./storage`.
3. Parent or sibling domain/component modules after package imports: `../domain/orderTypes`, `../lib/focusMenu`, `./DesiredDateTimePicker`.
4. Type imports are inline with `type` specifiers instead of separate runtime imports when practical: `import { type KeyboardEvent, useEffect } from 'react';`.

**Path Aliases:**
- Not detected. Use relative imports from `src/*`: `../domain/reviewRules`, `./OrderCaptureForm`, `./lib/supabaseClient`.
- Do not introduce new aliases without updating `tsconfig.json`, `vite.config.ts`, and tests together.

## Error Handling

**Patterns:**
- Repository methods should throw underlying Supabase errors directly after checking `{ error }`: `src/auth/authRepository.ts`.
- Missing required runtime configuration should throw a clear `Error`: `getSupabaseConfig` in `src/lib/supabaseClient.ts`.
- Browser storage access should be wrapped in `try/catch` and return defaults or no-op on failure: `safeGetItem`, `safeSetItem`, `parseStoredJson` in `src/domain/storage.ts`; `loadCapturePanelCollapsed` in `src/App.tsx`.
- UI save/load failures should show Korean status text and avoid exposing raw technical messages to the operator: `handleSaveOrder`, `handleClearOrders`, `handleSaveSettings` in `src/App.tsx`; login errors in `src/components/AuthGate.tsx`.
- Async race protection uses generation refs and sequence refs before applying responses: `workspaceGenerationRef`, `orderSaveSequenceByIdRef`, and `settingsSaveSequenceRef` in `src/App.tsx`; membership race handling in `src/components/AuthGate.tsx`.

## Logging

**Framework:** Not detected; no logging framework is used.

**Patterns:**
- Avoid `console.*` in application code. No `console.` usage is detected under `src/`.
- Surface recoverable user-facing failures through component state and Korean UI messages, as in `src/App.tsx` and `src/components/AuthGate.tsx`.
- Keep silent catches only for intentionally optional browser APIs such as `localStorage` and `navigator.clipboard`: `src/domain/storage.ts`, `src/components/OrderDetail.tsx`.

## Comments

**When to Comment:**
- Comments are sparse. Add comments only for non-obvious failure handling or browser-environment constraints.
- Existing examples are short explanatory comments for intentionally ignored browser storage failures: `src/App.tsx`, `src/domain/storage.ts`.

**JSDoc/TSDoc:**
- Not used in current source. Prefer expressive names and TypeScript types over adding JSDoc for ordinary functions.

## Function Design

**Size:** Keep pure domain helpers small and composable, as in `src/domain/parser.ts` and `src/domain/storage.ts`. Larger workflow components such as `WorkspaceApp` in `src/App.tsx` group related inner handlers close to state they use.

**Parameters:** Pass domain objects or explicit primitives. Repository factories receive clients (`createAuthRepository(supabase)` in `src/auth/authRepository.ts`); parser functions receive raw strings (`parseRawText(rawText)` in `src/domain/parser.ts`).

**Return Values:** Prefer explicit domain objects and typed arrays. Storage loaders return safe defaults instead of throwing (`loadOrders`, `loadSettings` in `src/domain/storage.ts`); auth and repository methods throw on remote errors (`src/auth/authRepository.ts`, `src/domain/orderRepository.ts`).

## Module Design

**Exports:** Use named exports for reusable components, repositories, and domain functions: `WorkspaceApp` in `src/App.tsx`, `OrderDetail` in `src/components/OrderDetail.tsx`, `parseRawText` in `src/domain/parser.ts`. `src/App.tsx` also provides a default `App` export for the app entry.

**Barrel Files:** Not used. Import directly from owning modules such as `src/domain/orderTypes.ts`, `src/auth/authTypes.ts`, and `src/lib/supabaseClient.ts`.

---

*Convention analysis: 2026-07-08*
