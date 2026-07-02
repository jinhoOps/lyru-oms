# Question Note Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the temporary owner-question note from the order capture panel into a small popover opened by a note icon beside `관리 설정`.

**Architecture:** Keep `QuestionNote` as the isolated owner-question component, but change its presentation from an inline collapsible section to a header popover. Move the component usage from the capture panel to the app header action area so the order input workflow no longer shifts down.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, CSS modules via `App.css`.

---

## File Structure

- Modify: `src/components/QuestionNote.tsx`
  - Owns the static question list and popover open/closed state.
  - Renders an icon-style button with accessible name `사장님께 확인할 질문`.
  - Renders the popover only when open.
- Create: `src/components/QuestionNote.test.tsx`
  - Tests default collapsed state, click-to-open, and click-to-close behavior.
- Modify: `src/App.tsx`
  - Moves `<QuestionNote />` from the order capture panel to the header action area beside `관리 설정`.
  - Adds `headerActions` wrapper.
- Modify: `src/App.test.tsx`
  - Confirms owner questions are hidden by default in the full app.
  - Confirms the note popover can open from the header while the capture form remains present.
- Modify: `src/App.css`
  - Replaces inline `questionNote` card styles with header popover styles.
  - Adds `headerActions`, `noteButton`, `notePopover`, and responsive constraints.

---

### Task 1: Add QuestionNote Popover Tests

**Files:**
- Create: `src/components/QuestionNote.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/components/QuestionNote.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { QuestionNote } from './QuestionNote';

afterEach(() => {
  cleanup();
});

describe('QuestionNote', () => {
  it('shows questions only while the note popover is open', async () => {
    const user = userEvent.setup();

    render(<QuestionNote />);

    expect(screen.getByRole('button', { name: '사장님께 확인할 질문' })).toBeInTheDocument();
    expect(screen.queryByText('아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.getByRole('region', { name: '확인 질문 쪽지' })).toBeInTheDocument();
    expect(screen.getByText('몇 개부터 미리 확인해야 하는 큰 주문으로 보시나요?')).toBeInTheDocument();
    expect(screen.getByText('고객님들이 이름, 연락처, 주소 같은 정보를 보통 어떤 표현으로 적어주시나요?')).toBeInTheDocument();
    expect(screen.getByText('어떤 표현이 있으면 맞춤 요청으로 따로 확인해야 하나요?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.queryByRole('region', { name: '확인 질문 쪽지' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
npm test -- src/components/QuestionNote.test.tsx
```

Expected: FAIL because the current component uses button text `사장님께 확인할 질문 보기` instead of accessible name `사장님께 확인할 질문`, and renders as an inline section rather than a popover region.

---

### Task 2: Convert QuestionNote to a Header Popover

**Files:**
- Modify: `src/components/QuestionNote.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Update `QuestionNote.tsx`**

Replace the component with:

```tsx
import { useState } from 'react';

const questions = [
  '몇 개부터 미리 확인해야 하는 큰 주문으로 보시나요?',
  '고객님들이 이름, 연락처, 주소 같은 정보를 보통 어떤 표현으로 적어주시나요?',
  '어떤 표현이 있으면 맞춤 요청으로 따로 확인해야 하나요?',
];

export function QuestionNote() {
  const [open, setOpen] = useState(false);

  return (
    <div className="questionNote">
      <button
        type="button"
        className="iconButton noteButton"
        aria-label="사장님께 확인할 질문"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ♡
      </button>
      {open ? (
        <div className="notePopover" role="region" aria-label="확인 질문 쪽지">
          <p>아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.</p>
          <ul>
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Update `App.css` question note styles**

In `src/App.css`, remove `.questionNote` from the shared card selector:

```css
.capturePanel,
.orderListPanel {
  border: 1px solid #eee5d6;
  border-radius: 8px;
  background: #fffaf2;
  box-shadow: 0 6px 16px rgba(28, 28, 28, 0.03);
}
```

Replace the old `.questionNote`, `.noteToggle`, and `.noteBody` blocks with:

```css
.headerActions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.questionNote {
  position: relative;
}

.noteButton {
  border-color: #d7c8ad;
  background: #fffaf2;
  color: #5b4322;
}

.notePopover {
  position: absolute;
  z-index: 5;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, calc(100vw - 36px));
  border: 1px solid #e1d5c2;
  border-radius: 8px;
  background: #fffdf8;
  padding: 12px;
  color: #463928;
  font-size: 13px;
  box-shadow: 0 14px 30px rgba(22, 32, 51, 0.14);
}

.notePopover p {
  margin: 0 0 8px;
}

.notePopover ul {
  margin: 0;
  padding-left: 18px;
}

.notePopover li + li {
  margin-top: 6px;
}
```

- [ ] **Step 3: Run the component test and verify it passes**

Run:

```bash
npm test -- src/components/QuestionNote.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

Run:

```bash
git add src/components/QuestionNote.tsx src/components/QuestionNote.test.tsx src/App.css
git commit -m "feat: convert question note to popover"
```

---

### Task 3: Move the Question Note Beside Settings

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing app placement test**

Add this test inside `describe('App', () => { ... })` in `src/App.test.tsx`:

```tsx
  it('keeps owner questions hidden behind the header note control', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByLabelText('주문/문의 원문')).toBeInTheDocument();
    expect(screen.queryByText('아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.getByRole('region', { name: '확인 질문 쪽지' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '관리 설정' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the app test and verify it fails before moving the component**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `QuestionNote` still appears inside the order capture panel or because no header action wrapper exists yet.

- [ ] **Step 3: Update `App.tsx` header placement**

Change the header action area from:

```tsx
          <button type="button" className="secondaryButton" onClick={() => setSettingsOpen(true)}>
            관리 설정
          </button>
```

to:

```tsx
          <div className="headerActions">
            <QuestionNote />
            <button type="button" className="secondaryButton" onClick={() => setSettingsOpen(true)}>
              관리 설정
            </button>
          </div>
```

Remove the inline `<QuestionNote />` from the capture panel:

```tsx
            <QuestionNote />
```

- [ ] **Step 4: Run the app test and verify it passes**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: move question note to header"
```

---

### Task 4: Final Verification

**Files:**
- Verify: `src/components/QuestionNote.tsx`
- Verify: `src/App.tsx`
- Verify: `src/App.css`
- Verify: test suite and build output

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/components/QuestionNote.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite build output and no TypeScript errors.

- [ ] **Step 4: Inspect final git status**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes. If build metadata changes appear, inspect them before deciding whether to commit or leave them alone.

---

## Self-Review

- Spec coverage: The plan removes the inline question box, adds the note icon beside settings, keeps questions static, avoids answer storage, and tests collapsed/open/closed behavior.
- Placeholder scan: No `TBD`, `TODO`, incomplete implementation steps, or unspecified test commands remain.
- Type consistency: The test names use `QuestionNote`, `App`, `사장님께 확인할 질문`, and `확인 질문 쪽지`, matching the implementation steps.
