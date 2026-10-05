# Scope Creep Receipt

Build and publish a complete, original portfolio project under lsj0914. The user's instruction authorizes implementation and GitHub publication; use judgment for routine choices and execute inline.

## Product

A browser-only change-request calculator. A project manager enters baseline tasks, dependencies, effort, working hours per task per day, labor rate, buffer, start date and committed deadline. Added tasks can depend on other tasks and block existing tasks. The app shows an itemized receipt, before/after finish dates, critical tasks, downstream impacts, and alternatives: accept the later date, increase daily time per task, or defer an explicitly optional baseline task.

Baseline and added tasks support create, edit, delete. Three editable examples demonstrate a launch-blocking request, a parallel request with no finish-date impact, and optional-scope tradeoffs. English/Chinese UI, local draft persistence, JSON import/export, Markdown receipt download, clipboard, browser print/PDF, and a readable mobile layout are required. No server, credentials, analytics, paid API, or fabricated AI judgments. Imported strings must be rendered as text.

## Calculation contract

- Strict version-1 JSON schema with finite numeric fields, unique task IDs, existing dependencies, no self edges or cycles. 1–60 baseline tasks, 0–40 change tasks; maximum 100 tasks total.
- Each task requires 0.25–10,000 labor hours. Daily hours per task are 0.25–24. Hourly rate is 0–100,000, buffer is 0–100 percent. Names are nonempty; title/requester/reason have length limits.
- Task duration is ceil(effort × (1 + buffer/100) / dailyHours), minimum 1 working day. Both baseline and revised plans use the same buffer. Independent tasks run in parallel with separate capacity; this is a dependency model, not finite-resource scheduling.
- Monday–Friday working days; weekends skipped, holidays not modeled. UTC date-only arithmetic; start on a weekend moves to Monday. Finish dates are inclusive. Supported input dates: 2000-01-01 through 2099-12-31.
- Added-task labor plus its buffer × hourly rate is the incremental estimate. No fabricated tax, approval, certainty, or monetary charge for schedule slip.
- Graph scheduling calculates earliest start/finish and slack; zero slack means critical. Added edges propagate to baseline successors. Missing/cyclic graphs suppress exports and show actionable errors.
- Optional task deferral rewires descendants to retained ancestors. Alternatives compare against the explicit committed deadline. Find minimum daily time, at 0.01-hour resolution up to 24 hours; report infeasible deadlines honestly. Alternative capacity is per concurrent task, not promised staffing headcount.
- Privacy: only this browser's localStorage, optionally user-downloaded files. Draft write failure must be visible. Import is limited to 250 KB and must validate before replacement. Example/reset replacement needs an in-app confirmation when a draft has been edited.

## Visual direction

Ink #202641, slate #65708B, lavender #EEF0FA, violet #5346B8, mint #DDF3E9, white #FFFFFF. System sans body with Trebuchet display headings; receipt uses a monospace face only for money and itemization. A quiet lavender workspace surrounds a white receipt with perforated tear edge. Left-aligned editor and receipt; avoid generic metric-card dashboards. The receipt is the memorable element. Mobile stacks inputs before results; keyboard focus is visible, reduced motion respected, print isolates the full receipt.

## Delivery evidence

Hand-derived unit fixtures for graph/date/cost/validation/deferral/import, browser tests for actual editor changes, persistence, import/export, language switching, mobile overflow and accessibility. Fresh typecheck/build and CI must pass. README includes screenshot, demo link, methodology, limitations, worked example and development instructions; MIT license. Push verified files to public GitHub repo, deploy GitHub Pages, inspect the live application independently of local tests.
