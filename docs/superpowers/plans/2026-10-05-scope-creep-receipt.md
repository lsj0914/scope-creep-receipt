# Scope Creep Receipt Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use checkbox syntax for tracking.

**Goal:** Publish a fully usable bilingual change-request calculator and its source on GitHub.

**Architecture:** Pure TypeScript scheduling/validation core, separate export/persistence utilities, a semantic DOM editor and receipt. Static Vite build and GitHub Pages deployment.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright, axe-core, GitHub Actions/Pages.

**Spec:** ../specs/2026-10-05-scope-creep-receipt-design.md

## Global Constraints

- Browser-only; no server, credentials, analytics, paid API, or fabricated AI judgments.
- Monday–Friday, no holiday calendar; date-only UTC arithmetic and inclusive finish dates.
- Parallel independent tasks have separate capacity. Daily hours are per task, not shared team capacity.
- Strict version-1 import validation; 250 KB import cap; 100 tasks maximum.
- Keyboard-accessible, responsive, English/Chinese, isolated print receipt, local-only persistence.

## Review Focus

- Noncritical added work still costs money without delaying delivery: hand-computed parallel fixture.
- Zero slack changes when new dependencies are inserted: chain and diamond fixtures.
- Malformed imports, unsafe strings, cycles, stale IDs: model and browser tests.
- Weekend dates and DST cannot shift finish dates: explicit date fixtures.
- Deferring an intermediate optional task must preserve retained predecessor constraints: rewiring fixture.

### Task 1: Validated scheduling and alternatives

Files: src/model.ts, src/engine.ts, src/examples.ts; tests/engine.test.ts.

Interfaces: Project/Task/ChangeTask types; validateProject(unknown): Project; schedule(Task[], Settings): Schedule; calculate(Project): Receipt; deferTask(Project, string): Project.

- [x] Write hand-derived failing unit fixtures for costs, paths, dates, bad graph inputs, deferral and deadlines; run npm test and observe unimplemented feature failures.
- [x] Implement strict model validation, graph scheduling and calculation; run full suite to green.
- [x] Add three scenario examples and commit the verified core.

### Task 2: Editor, receipt and document boundaries

Files: src/main.ts, src/editor.ts, src/receipt.ts, src/i18n.ts, src/documents.ts, src/style.css, index.html; tests/documents.test.ts; e2e/app.spec.ts.

Consumes: calculate(Project): Receipt and validateProject(unknown): Project.
Produces: usable editor and receipt; parseProject(string): Project; receiptMarkdown(Project, Receipt, Language): string.

- [x] Write and observe failing document tests and browser acceptance tests for task changes, invalid data, persistence and downloaded files.
- [x] Implement JSON/Markdown boundaries and persistent, bilingual UI; preserve focus while receipt recalculates.
- [x] Run unit, typecheck/build, desktop/mobile browser and accessibility tests; visually inspect screenshots and fix material issues.
- [x] Commit tested application.

### Task 3: Portfolio presentation and publication

Files: README.md, README.zh-CN.md, LICENSE, docs/methodology.md, docs/demo.png, .github/workflows/ci.yml, .github/workflows/deploy.yml.

- [x] Document genuine calculated examples, limitations, screenshot and commands.
- [x] Run fresh npm run check, review full branch, fix material findings with regression tests.
- [ ] Create public repo lsj0914/scope-creep-receipt, push, configure Pages and inspect successful CI/deployment.
- [ ] Verify the published URL, interactive results and remote commit match; complete goal only when all evidence exists.
