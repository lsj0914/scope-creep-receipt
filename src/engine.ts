import { ProjectError, MAX_PROJECT_BYTES } from "./model";
import type {
  ChangeTask,
  Project,
  Task,
  Settings,
  Schedule,
  Receipt,
  ScheduledTask,
} from "./model";

const DAY = 86_400_000;
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const unique = (ids: string[]) => [...new Set(ids)];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProjectError("shape");
  return value as Record<string, unknown>;
}

function text(
  value: unknown,
  field: string,
  max: number,
  required = true,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new ProjectError("text", field);
  return value;
}

function number(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new ProjectError("number", `${field}: ${min}–${max}`);
  return value;
}

function ids(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new ProjectError("shape", field);
  return unique(value.map((v) => text(v, field, 80)));
}

function date(value: unknown): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "2000-01-01" ||
    value > "2099-12-31"
  )
    throw new ProjectError("date");
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    throw new ProjectError("date");
  return d;
}

function settings(input: unknown): Settings {
  const s = object(input);
  date(s.startDate);
  date(s.deadline);
  if (!["USD", "CNY", "EUR", "GBP"].includes(s.currency as string))
    throw new ProjectError("shape", "currency");
  return {
    startDate: s.startDate as string,
    deadline: s.deadline as string,
    dailyHours: number(s.dailyHours, "Daily hours", 0.25, 24),
    hourlyRate: number(s.hourlyRate, "Hourly rate", 0, 100_000),
    bufferPercent: number(s.bufferPercent, "Buffer (%)", 0, 100),
    currency: s.currency as Settings["currency"],
  };
}

function readTask(input: unknown): Task {
  const t = object(input);
  if (typeof t.optional !== "boolean")
    throw new ProjectError("shape", "optional");
  return {
    id: text(t.id, "Task ID", 80),
    name: text(t.name, "Task name", 120),
    hours: number(t.hours, "Task hours", 0.25, 10_000),
    dependsOn: ids(t.dependsOn, "Dependencies"),
    optional: t.optional,
  };
}

/** DFS also gives an order where every predecessor has already been scheduled. */
function topological(tasks: Task[]): Task[] {
  const lookup = new Map<string, Task>();
  for (const t of tasks) {
    if (lookup.has(t.id)) throw new ProjectError("duplicate", t.id);
    lookup.set(t.id, t);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: Task[] = [];
  function visit(id: string) {
    const t = lookup.get(id);
    if (!t) throw new ProjectError("missing", id);
    if (visiting.has(id)) throw new ProjectError("cycle", t.name);
    if (visited.has(id)) return;
    visiting.add(id);
    t.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
    ordered.push(t);
  }
  tasks.forEach((t) => visit(t.id));
  return ordered;
}

function revisedTasks(p: Project): Task[] {
  return [
    ...p.baseline.map((t) => ({
      ...t,
      dependsOn: unique([
        ...t.dependsOn,
        ...p.changes.filter((c) => c.blocks.includes(t.id)).map((c) => c.id),
      ]),
    })),
    ...p.changes.map(({ blocks: _blocks, ...t }) => t),
  ];
}

export function validateProject(input: unknown): Project {
  const p = object(input);
  if (p.version !== 1) throw new ProjectError("version");
  if (!Array.isArray(p.baseline) || !Array.isArray(p.changes))
    throw new ProjectError("shape", "Tasks");
  if (p.baseline.length < 1 || p.baseline.length > 60 || p.changes.length > 40)
    throw new ProjectError("limit");
  const baseline = p.baseline.map(readTask);
  const changes: ChangeTask[] = p.changes.map((raw) => ({
    ...readTask(raw),
    blocks: ids(object(raw).blocks, "Blocking targets"),
  }));
  const result: Project = {
    version: 1,
    title: text(p.title, "Project title", 120),
    requester: text(p.requester, "Requested by", 120, false),
    reason: text(p.reason, "Reason", 2000, false),
    settings: settings(p.settings),
    baseline,
    changes,
  };
  topological(baseline);
  for (const c of changes)
    for (const id of c.blocks) {
      if (!baseline.some((t) => t.id === id))
        throw new ProjectError("missing", id);
    }
  topological(revisedTasks(result));
  if (
    new TextEncoder().encode(JSON.stringify(result)).length > MAX_PROJECT_BYTES
  )
    throw new ProjectError("projectSize");
  return result;
}

/** Calendar math runs in UTC. Full weeks are skipped in O(1), not day-by-day. */
export function addWorkdays(value: string, days: number): string {
  const d = date(value);
  if (!Number.isSafeInteger(days) || days < 0)
    throw new ProjectError("number", "Working days");
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
    d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + Math.floor(days / 5) * 7);
  for (let n = days % 5; n > 0; n--) {
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
      d.setUTCDate(d.getUTCDate() + 1);
  }
  const output = d.toISOString().slice(0, 10);
  if (d.getUTCFullYear() > 2099) throw new ProjectError("horizon");
  return output;
}

/** Weekdays in (from, to], with a negative result when to precedes from. */
export function workdayDistance(from: string, to: string): number {
  const a = date(from);
  const b = date(to);
  if (a > b) return -workdayDistance(to, from);
  const span = Math.round((b.getTime() - a.getTime()) / DAY);
  let count = Math.floor(span / 7) * 5;
  for (let i = 1; i <= span % 7; i++) {
    const day = (a.getUTCDay() + i) % 7;
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function graphSchedule(tasks: Task[], s: Settings): Schedule {
  const order = topological(tasks);
  const entries = new Map<string, ScheduledTask>();
  for (const t of order) {
    const start = Math.max(0, ...t.dependsOn.map((id) => entries.get(id)!.end));
    const duration = Math.max(
      1,
      Math.ceil((t.hours * (1 + s.bufferPercent / 100)) / s.dailyHours - 1e-10),
    );
    entries.set(t.id, {
      ...t,
      start,
      end: start + duration,
      duration,
      slack: 0,
      critical: false,
    });
  }
  const days = Math.max(0, ...[...entries.values()].map((t) => t.end));
  const latestStarts = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const t of tasks)
    for (const id of t.dependsOn)
      successors.set(id, [...(successors.get(id) ?? []), t.id]);
  for (const t of [...order].reverse()) {
    const entry = entries.get(t.id)!;
    const latestEnd = Math.min(
      days,
      ...(successors.get(t.id) ?? []).map((id) => latestStarts.get(id)!),
    );
    const latestStart = latestEnd - entry.duration;
    latestStarts.set(t.id, latestStart);
    entry.slack = latestStart - entry.start;
    entry.critical = entry.slack === 0;
  }
  return {
    tasks: tasks.map((t) => entries.get(t.id)!),
    days,
    finishDate: addWorkdays(s.startDate, Math.max(0, days - 1)),
  };
}

export function schedule(tasks: Task[], input: Settings): Schedule {
  if (tasks.length > 100) throw new ProjectError("limit");
  return graphSchedule(tasks.map(readTask), settings(input));
}

function deferValidated(p: Project, id: string): Project {
  const removed = p.baseline.find((t) => t.id === id);
  if (!removed?.optional || p.baseline.length <= 1)
    throw new ProjectError("optional", id);
  // Preserve both the original predecessor constraints and new work inserted before this task.
  const before = unique([
    ...removed.dependsOn,
    ...p.changes.filter((c) => c.blocks.includes(id)).map((c) => c.id),
  ]);
  const rewire = (deps: string[]) =>
    unique(deps.flatMap((dep) => (dep === id ? before : [dep])));
  const baselineRewire = (deps: string[]) =>
    unique(deps.flatMap((dep) => (dep === id ? removed.dependsOn : [dep])));
  const successors = p.baseline
    .filter((t) => t.dependsOn.includes(id))
    .map((t) => t.id);
  return {
    ...p,
    baseline: p.baseline
      .filter((t) => t.id !== id)
      .map((t) => ({ ...t, dependsOn: baselineRewire(t.dependsOn) })),
    changes: p.changes.map((c) => ({
      ...c,
      dependsOn: rewire(c.dependsOn),
      blocks: unique(
        c.blocks.flatMap((target) => (target === id ? successors : [target])),
      ),
    })),
  };
}

export function deferTask(input: Project, id: string): Project {
  return validateProject(deferValidated(validateProject(input), id));
}

/** Remove from a live draft before validation, so an invalid removed field cannot prevent recovery. */
export function removeTask(input: Project, id: string): Project {
  const p = structuredClone(input);
  const baseline = p.baseline.find((t) => t.id === id);
  if (baseline) {
    baseline.optional = true;
    return deferValidated(p, id);
  }
  const removed = p.changes.find((t) => t.id === id);
  if (!removed) throw new ProjectError("missing", id);
  p.changes = p.changes
    .filter((t) => t.id !== id)
    .map((t) => ({
      ...t,
      dependsOn: unique(
        t.dependsOn.flatMap((dep) => (dep === id ? removed.dependsOn : [dep])),
      ).filter((dep) => dep !== t.id && dep !== id),
    }));
  return p;
}

function minimumDailyHours(tasks: Task[], s: Settings): number | null {
  const start = addWorkdays(s.startDate, 0);
  if (s.deadline < start) return null;
  const allowance = workdayDistance(start, s.deadline) + 1;
  const fits = (hundredths: number) =>
    graphSchedule(tasks, { ...s, dailyHours: hundredths / 100 }).days <=
    allowance;
  if (!fits(2400)) return null;
  let low = Math.ceil(s.dailyHours * 100);
  let high = 2400;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (fits(middle)) high = middle;
    else low = middle + 1;
  }
  return low / 100;
}

export function calculate(input: Project): Receipt {
  const p = validateProject(input);
  const baseline = graphSchedule(p.baseline, p.settings);
  const combined = revisedTasks(p);
  const revised = graphSchedule(combined, p.settings);
  const rawHours = p.changes.reduce((sum, t) => sum + t.hours, 0);
  const rawBuffer = (rawHours * p.settings.bufferPercent) / 100;
  const lineCosts = p.changes.map((t) => ({
    id: t.id,
    cost: round(t.hours * p.settings.hourlyRate),
  }));
  const laborCost = round(lineCosts.reduce((sum, line) => sum + line.cost, 0));
  const bufferCost = round(rawBuffer * p.settings.hourlyRate);
  const impactedTasks = baseline.tasks.flatMap((t) => {
    const delay = revised.tasks.find((next) => next.id === t.id)!.end - t.end;
    return delay > 0 ? [{ id: t.id, name: t.name, delay }] : [];
  });
  const deferrals = p.baseline
    .filter((t) => t.optional && p.baseline.length > 1)
    .map((t) => {
      const alternate = deferValidated(p, t.id);
      const result = graphSchedule(revisedTasks(alternate), p.settings);
      return {
        id: t.id,
        name: t.name,
        finishDate: result.finishDate,
        savedDays: revised.days - result.days,
        meetsDeadline: result.finishDate <= p.settings.deadline,
      };
    });
  return {
    baseline,
    revised,
    addedHours: round(rawHours),
    bufferHours: round(rawBuffer),
    totalHours: round(rawHours + rawBuffer),
    lineCosts,
    laborCost,
    bufferCost,
    cost: round(laborCost + bufferCost),
    deltaDays: revised.days - baseline.days,
    deadlineSlip:
      revised.finishDate > p.settings.deadline
        ? Math.max(0, workdayDistance(p.settings.deadline, revised.finishDate))
        : 0,
    impactedTasks,
    requiredDailyHours: minimumDailyHours(combined, p.settings),
    deferrals,
  };
}
