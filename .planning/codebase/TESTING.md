# Testing Patterns

**Analysis Date:** 2026-07-08

## Test Framework

**Runner:**
- Vitest 3.2.6
- Config: `vite.config.ts`
- Test environment: `jsdom`
- Setup file: `vitest.setup.ts`

**Assertion Library:**
- Vitest `expect`
- `@testing-library/jest-dom/vitest` for DOM assertions through `vitest.setup.ts` and direct imports in component tests such as `src/components/OrderCaptureForm.test.tsx`.

**Run Commands:**
```bash
npm test              # Run all tests once with vitest run --passWithNoTests
npm run test:watch    # Run Vitest watch mode
npm run build         # Run TypeScript build and Vite production build
```

## Test File Organization

**Location:**
- Tests are co-located with implementation under `src/`.
- Domain tests live next to domain modules: `src/domain/parser.test.ts`, `src/domain/storage.test.ts`, `src/domain/orderSorting.test.ts`.
- Component tests live next to components: `src/components/OrderDetail.test.tsx`, `src/components/SettingsModal.test.tsx`.
- Auth/lib tests live next to their modules: `src/auth/authRepository.test.ts`, `src/lib/supabaseClient.test.ts`.

**Naming:**
- Use `<module>.test.ts` for non-JSX modules.
- Use `<Component>.test.tsx` for React components.

**Structure:**
```text
src/
├── App.test.tsx
├── auth/
│   ├── authRepository.ts
│   └── authRepository.test.ts
├── components/
│   ├── OrderDetail.tsx
│   └── OrderDetail.test.tsx
├── domain/
│   ├── parser.ts
│   └── parser.test.ts
└── lib/
    ├── supabaseClient.ts
    └── supabaseClient.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest';
import { parseRawText, hasSimilarRawText } from './parser';

describe('parseRawText', () => {
  it('extracts known labels and related keywords', () => {
    const parsed = parseRawText('성함: 김리루');

    expect(parsed.customerName).toBe('김리루');
  });
});
```

**Patterns:**
- Use `describe('<unit>')` around domain functions and components: `src/domain/parser.test.ts`, `src/components/AuthGate.test.tsx`.
- Use behavioral `it(...)` names that describe user-visible or domain outcomes: `saves raw text even when required fields are missing` in `src/components/OrderCaptureForm.test.tsx`.
- Put reusable builders and deferred promise helpers at the top of test files: `createCapturedOrder` and `createDeferred` in `src/App.test.tsx`.
- Use `beforeEach` for clearing storage and resetting mocks when shared state exists: `src/App.test.tsx`, `src/domain/storage.test.ts`.
- Use `afterEach(cleanup)` for React component tests: `src/components/AuthGate.test.tsx`, `src/components/OrderDetail.test.tsx`.

## Mocking

**Framework:** Vitest mocks (`vi.fn`, `vi.mock`, `vi.spyOn`, `vi.stubEnv`, `vi.stubGlobal`).

**Patterns:**
```typescript
const orderRepositoryMock = {
  loadWorkspaceData: vi.fn().mockResolvedValue({ orders: [], settings: DEFAULT_SETTINGS }),
  saveOrder: vi.fn(async (_workspaceId, order) => order),
};

vi.mock('./domain/orderRepository', () => ({
  createOrderRepository: vi.fn(() => orderRepositoryMock),
}));
```

**What to Mock:**
- Mock repository factories and external clients at module boundaries in app-level tests: `src/App.test.tsx`.
- Mock Supabase client creation when testing `src/lib/supabaseClient.ts`: `src/lib/supabaseClient.test.ts`.
- Mock Supabase chain methods with `vi.fn` objects when testing repository behavior: `src/auth/authRepository.test.ts`.
- Stub public Vite env vars with `vi.stubEnv`: `src/lib/supabaseClient.test.ts`.
- Stub browser globals only when the behavior depends on missing or special browser APIs: `crypto` in `src/components/OrderCaptureForm.test.tsx`, `Storage.prototype` in `src/domain/storage.test.ts`, `window.navigator.onLine` in `src/App.test.tsx`.

**What NOT to Mock:**
- Do not mock pure domain functions under test. Test parser, sorting, storage hydration, quantity, date, and review rules directly: `src/domain/parser.test.ts`, `src/domain/reviewRules.test.ts`, `src/domain/dateDisplay.test.ts`.
- Do not mock React Testing Library queries or DOM assertions.
- Prefer rendering real components for component behavior rather than asserting implementation details, as in `src/components/OrderDetail.test.tsx` and `src/components/SettingsModal.test.tsx`.

## Fixtures and Factories

**Test Data:**
```typescript
function createCapturedOrder(overrides: Partial<CapturedOrder> = {}): CapturedOrder {
  return {
    ...EMPTY_ORDER_FIELDS,
    id: 'order-1',
    source: '카카오톡 채널',
    rawText: '성함: 레이스고객',
    status: '신규',
    ...overrides,
  };
}
```

**Location:**
- Keep small factories local to the test file using them: `createCapturedOrder` in `src/App.test.tsx`, `createAuthRepositoryMock` in `src/components/AuthGate.test.tsx`, `createSupabaseMock` in `src/auth/authRepository.test.ts`.
- No shared fixture directory is detected.
- Use `EMPTY_ORDER_FIELDS` and `DEFAULT_SETTINGS` from `src/domain/orderTypes.ts` to build valid test domain objects.

## Coverage

**Requirements:** No coverage threshold is configured in `vite.config.ts`.

**View Coverage:**
```bash
npm test
```

Coverage reporting command is not configured. Add Vitest coverage tooling before relying on generated coverage reports.

## Test Types

**Unit Tests:**
- Domain logic uses direct unit tests without DOM rendering: `src/domain/parser.test.ts`, `src/domain/orderQuantity.test.ts`, `src/domain/menuCatalog.test.ts`, `src/domain/dateDisplay.test.ts`.
- Repository logic is tested with mocked Supabase clients: `src/auth/authRepository.test.ts`, `src/domain/orderRepository.test.ts`.

**Integration Tests:**
- React component and app workflow tests use React Testing Library with `jsdom`: `src/App.test.tsx`, `src/components/AuthGate.test.tsx`, `src/components/OrderCaptureForm.test.tsx`.
- App tests cover repository interactions, local draft recovery, offline cache behavior, role-specific UI, race handling, and order list filtering in `src/App.test.tsx`.

**E2E Tests:**
- Not used. No Playwright, Cypress, or browser E2E config is detected.

## Common Patterns

**Async Testing:**
```typescript
const user = userEvent.setup();
render(<OrderCaptureForm existingRawTexts={[]} settings={DEFAULT_SETTINGS} source="카카오톡 채널" onSave={onSave} />);

await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 김리루');
await user.click(screen.getByRole('button', { name: '저장' }));

expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ customerName: '김리루' }));
```

**Error Testing:**
```typescript
const error = new Error('sign in failed');
const supabase = createSupabaseMock({ signInError: error });
const repository = createAuthRepository(supabase as never);

await expect(repository.signIn('owner@lyru.test', 'secret')).rejects.toThrow('sign in failed');
```

**DOM Testing:**
- Prefer accessible queries: `screen.getByRole`, `screen.getByLabelText`, `within(dialog).getByRole`.
- Use `findBy*` and `waitFor` for async UI updates: `src/App.test.tsx`, `src/components/AuthGate.test.tsx`.
- Use `fireEvent.change` for direct controlled-input updates when user-event typing is unnecessary or too slow: `src/App.test.tsx`, `src/components/OrderDetail.test.tsx`.

---

*Testing analysis: 2026-07-08*
