# Calculation methodology

The goal is an explainable change-request estimate. All calculations are deterministic and inspectable in `src/engine.ts`.

## Inputs and validation

Projects use the version-1 schema shown in `examples/*.json`: metadata, settings, baseline tasks, and change tasks. Task IDs remain stable while names change. Baseline predecessor links must point to baseline tasks; added-task predecessor links may point to any task. A change task's `blocks` links point to baseline tasks.

Validation checks shape, primitive types, finite numeric ranges, real ISO dates, unique IDs, known links and acyclic graphs. Limits: 1–60 baseline tasks, up to 40 change tasks, 0.25–10,000 effort hours per task, 0.25–24 daily hours, 0–100% buffer, and 0–100,000 hourly rate. Input dates run from 2000 through 2099. Modeled finish dates beyond 2099 are rejected. File imports and normalized portable projects are capped at 256,000 bytes (250 KiB). Imports are calculated before replacing a draft. Exported project files use compact JSON within that same budget.

Unknown JSON properties are discarded rather than merged into application objects. Task names and imported text are HTML-escaped. Markdown exports also escape user-supplied Markdown and flatten metadata newlines.

## Graph construction

The original graph contains baseline tasks and their predecessor links. The revised graph contains the same tasks plus the added tasks. For each added task C blocking baseline task B, add C to B's predecessors.

A depth-first traversal detects cycles and produces a topological order. In that order:

```text
duration(t) = max(1, ceil(hours(t) × (1 + buffer/100) / dailyHours))
start(t)    = max(0, end(each predecessor))
end(t)      = start(t) + duration(t)
planDays    = max(end(each task))
```

Offsets are zero-based and `end` is exclusive. Each task starts on the next working day after its predecessors finish; same-day handoffs are intentionally not modeled. A tiny arithmetic tolerance at integer boundaries avoids adding a day solely because of binary floating-point error.

Traverse the order in reverse to compute latest starts. Terminal tasks may finish at `planDays`; each predecessor must finish by the earliest successor latest start. Slack equals latest start minus earliest start. A task with zero slack is critical; multiple parallel critical paths are allowed.

## Calendar

Dates are UTC midnight values representing calendar dates, not real-world timestamps. A weekend start normalizes forward to Monday. The finish date is the normalized start plus `planDays - 1` working days, giving inclusive finish dates.

Whole weeks are skipped arithmetically; remaining weekdays are counted explicitly. `workdayDistance(a,b)` counts weekdays in `(a,b]`, returning the negative reverse distance when b precedes a. A weekend deadline is compared against the literal calendar date, not silently moved to Monday. Holidays remain ordinary weekdays in this model.

## Incremental cost

```text
addedHours  = sum(change task hours)
bufferHours = addedHours × buffer/100
totalHours  = addedHours + bufferHours
cost        = totalHours × hourlyRate
```

Displayed hours round to two decimal places and approximate buffer hours are marked with ≈. Each labor line rounds to currency cents; the labor subtotal sums those rounded lines. Buffer money is calculated from unrounded buffer effort, then rounded to cents. The total sums the displayed labor subtotal and buffer money so the receipt balances. Costs are labor estimates in the selected currency, not exchange-rate conversions. Selecting a different currency changes the unit and formatting; it does not convert the rate. No tax, fixed fee, delay penalty or approval probability is invented.

## Impacts and alternatives

- **Extra working days:** revised plan duration minus baseline plan duration under identical current assumptions.
- **Deadline slip:** weekdays from the committed deadline to the revised finish, clamped at zero. Existing baseline lateness is separately flagged.
- **Moved original tasks:** baseline tasks whose revised finish offset increases; the displayed delay is that increase.
- **Accept the new date:** keeps all scope and displays the revised finish.
- **Increase daily time:** binary-search the minimum daily hours, in 0.01-hour increments from current hours to 24, that fit the revised graph into the start/deadline interval. A deadline before the normalized start, or one the graph cannot meet at 24 hours, is infeasible. This is time per concurrent task, not an estimated number of staff.
- **Defer an optional task:** remove one explicitly optional baseline task. Its retained descendants inherit its original predecessors. Added work blocking the removed task is transferred to its retained immediate baseline successors. Added tasks depending on the removed task inherit its revised predecessors. Compare the alternative revised finish to the explicit deadline.

Deferral changes the scope of the plan; it does not reduce the cost of the new request. Alternatives are evaluated one optional task at a time, not as a global optimal combination.

## Practical limits

Independent tasks assume separate capacity. Shared-resource scheduling, different labor rates, holidays, probabilistic duration distributions, fractional-day handoffs, task progress, and rework are outside this version. Use the receipt to structure a conversation; verify estimates and available capacity before changing a real commitment.

## Verification

The test suite uses hand-checked sequential and parallel graphs, multiple critical paths, optional intermediate-task rewiring, weekend/DST/leap-year calendars, explicit deadlines, invalid imports and malicious-looking literal strings. Browser checks exercise edits, persistence, downloaded JSON/Markdown, language switching, task CRUD, alternatives, cycles, keyboard navigation, storage/clipboard failure, print styles, and mobile overflow.

CI runs the same `npm run check` command as local development. Rendered screenshots are separately inspected, because successful build and calculation tests cannot prove that a layout is usable.
