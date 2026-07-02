# Workflow Source of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AGENTS.md` and `.planning/STATE.md` clearly state that GSD documents are roadmap context and Superpowers is the current execution workflow.

**Architecture:** This is a docs-only workflow alignment change. `AGENTS.md` defines standing agent rules, while `.planning/STATE.md` captures the current project state and next Superpowers entry point.

**Tech Stack:** Markdown documentation, Git.

---

## File Structure

- Modify: `AGENTS.md`
  - Add a `Workflow Source of Truth` section after `Working Rules`.
  - Keep existing product, CodeGraph, and verification rules intact.
- Modify: `.planning/STATE.md`
  - Replace the stale GSD `Next command` with the Superpowers workflow entry point.
  - Add explicit notes that `.planning` is roadmap context, not the execution queue.

## Task 1: Update Agent Workflow Rules

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Insert workflow source-of-truth rules**

Add this section immediately after the existing `Working Rules` list:

```md
## Workflow Source of Truth

- GSD `.planning` documents are the product charter, requirements, roadmap, and long-term context store.
- Superpowers skills are the source of truth for current work execution: design, planning, implementation, and verification.
- Before substantial work, read `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` for product context, then continue through the relevant Superpowers skill.
- Start new feature, behavior-change, or workflow-design work with `$superpowers:brainstorming` unless the user explicitly requests a different skill.
- After an approved design, move to `$superpowers:writing-plans` before implementation.
- Run `$gsd-*` commands only when the user explicitly asks for a GSD workflow.
- Do not interpret `.planning/STATE.md` as a GSD execution queue when it conflicts with this section.
```

- [ ] **Step 2: Verify `AGENTS.md` wording**

Run:

```powershell
Get-Content -LiteralPath AGENTS.md
```

Expected:
- `Workflow Source of Truth` appears once.
- The existing `Working Rules`, `Product Principles`, and `Verification` sections remain present.
- The new section says GSD is context and Superpowers is execution.

## Task 2: Update Current Project State

**Files:**
- Modify: `.planning/STATE.md`

- [ ] **Step 1: Replace workflow state values**

Change the `Workflow State` section to:

```md
## Workflow State

- **Status:** active-superpowers-workflow
- **Language:** Korean
- **Planning mode:** Superpowers execution; GSD documents retained as roadmap context
- **Next command:** `$superpowers:brainstorming` for new feature/design work

GSD `.planning` documents remain the product charter, requirements, roadmap, and long-term context store. Superpowers skills are the source of truth for current work execution.

Run `$gsd-*` commands only when the user explicitly asks for a GSD workflow.
```

- [ ] **Step 2: Add active phase status note**

Under the Phase 1 requirements paragraph, add:

```md
**Current implementation note:** Recent commits indicate Phase 1 order standardization and parser refinement work has been implemented. The next product decision should be Phase 1 verification/closeout or Phase 2 design kickoff.
```

- [ ] **Step 3: Verify stale GSD command is gone**

Run:

```powershell
Select-String -Path .planning\STATE.md -Pattern '\$gsd-discuss-phase'
```

Expected: no matches.

- [ ] **Step 4: Verify state remains readable**

Run:

```powershell
Get-Content -LiteralPath .planning\STATE.md
```

Expected:
- `active-superpowers-workflow` appears.
- `$superpowers:brainstorming` appears as the next command.
- Phase 1 goal and requirements remain present.

## Task 3: Docs Verification and Commit

**Files:**
- Modify: `AGENTS.md`
- Modify: `.planning/STATE.md`

- [ ] **Step 1: Scan for unresolved placeholders**

Run:

```powershell
Select-String -Path AGENTS.md,.planning\STATE.md -Pattern 'TBD|TODO|\?\?'
```

Expected: no matches.

- [ ] **Step 2: Review the final diff**

Run:

```powershell
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms diff -- AGENTS.md .planning/STATE.md
```

Expected:
- Only `AGENTS.md` and `.planning/STATE.md` are changed.
- The diff matches the approved design in `docs/superpowers/specs/2026-07-02-workflow-source-of-truth-design.md`.

- [ ] **Step 3: Commit the workflow alignment**

Run:

```powershell
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms add AGENTS.md .planning/STATE.md
git -c safe.directory=D:/jhkSandBox/CODE/lyru-oms commit -m "docs: align project workflow guidance"
```

Expected: commit succeeds with the two documentation files.

## Self-Review

- Spec coverage: Task 1 updates `AGENTS.md`; Task 2 updates `.planning/STATE.md`; Task 3 verifies no stale GSD command or placeholders remain.
- Placeholder scan: no `TBD`, `TODO`, or vague future-work instructions are present in the plan.
- Scope check: the plan changes only the two approved files and does not alter product requirements, roadmap phases, or existing Superpowers specs.
