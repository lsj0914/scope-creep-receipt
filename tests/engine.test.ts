import { describe, expect, it } from "vitest";
import {
  addWorkdays,
  calculate,
  deferTask,
  schedule,
  validateProject,
  workdayDistance,
  removeTask,
} from "../src/engine";
import type { Project, Task } from "../src/model";

const task = (
  id: string,
  hours: number,
  dependsOn: string[] = [],
  optional = false,
): Task => ({ id, name: id, hours, dependsOn, optional });
const fixture = (): Project => ({
  version: 1,
  title: "Launch",
  requester: "Sponsor",
  reason: "CSV export",
  settings: {
    startDate: "2026-10-05",
    deadline: "2026-10-09",
    dailyHours: 6,
    hourlyRate: 75,
    bufferPercent: 0,
    currency: "USD",
  },
  baseline: [
    task("design", 12),
    task("build", 12, ["design"]),
    task("launch", 6, ["build"]),
  ],
  changes: [{ ...task("export", 12, ["build"]), blocks: ["launch"] }],
});

describe("itemized change costs and dependency propagation", () => {
  it("keeps fractional buffer cost separate from rounded display hours", () => {
    const p = fixture();
    p.changes[0].hours = 0.25;
    p.settings.bufferPercent = 10;
    p.settings.hourlyRate = 100;
    const r = calculate(p);
    expect(r.laborCost).toBe(25);
    expect(r.bufferCost).toBe(2.5);
    expect(r.cost).toBe(27.5);
  });
  it("sums individually rounded line costs so the receipt balances", () => {
    const p = fixture();
    p.changes = [
      { ...task("small-a", 0.25), blocks: [] },
      { ...task("small-b", 0.25), blocks: [] },
      { ...task("small-c", 0.25), blocks: [] },
    ];
    p.settings.hourlyRate = 0.1;
    const r = calculate(p);
    expect(r.lineCosts.map((line) => line.cost)).toEqual([0.03, 0.03, 0.03]);
    expect(r.laborCost).toBe(0.09);
    expect(r.cost).toBe(0.09);
  });
  it("charges 12 additional hours and moves a blocked Friday launch to Tuesday", () => {
    const r = calculate(fixture());
    expect(r.cost).toBe(900);
    expect(r.deltaDays).toBe(2);
    expect(r.baseline.finishDate).toBe("2026-10-09");
    expect(r.revised.finishDate).toBe("2026-10-13");
    expect(r.impactedTasks).toEqual([
      { id: "launch", name: "launch", delay: 2 },
    ]);
    expect(r.deadlineSlip).toBe(2);
  });
  it("charges for independent work without inventing a delivery delay", () => {
    const p = fixture();
    p.changes[0].dependsOn = [];
    p.changes[0].blocks = [];
    const r = calculate(p);
    expect(r.cost).toBe(900);
    expect(r.deltaDays).toBe(0);
    expect(r.impactedTasks).toEqual([]);
  });
  it("shows buffer separately and applies the same duration rule to both plans", () => {
    const p = fixture();
    p.settings.bufferPercent = 25;
    const r = calculate(p);
    expect(r.addedHours).toBe(12);
    expect(r.bufferHours).toBe(3);
    expect(r.totalHours).toBe(15);
    expect(r.cost).toBe(1125);
    expect(r.baseline.days).toBe(8);
    expect(r.revised.days).toBe(11);
  });
  it("supports free labor without dividing by the rate", () => {
    const p = fixture();
    p.settings.hourlyRate = 0;
    expect(calculate(p).cost).toBe(0);
  });
  it("returns a zero receipt when no work is added", () => {
    const p = fixture();
    p.changes = [];
    const r = calculate(p);
    expect(r.cost).toBe(0);
    expect(r.deltaDays).toBe(0);
    expect(r.revised).toEqual(r.baseline);
  });
  it("identifies parallel critical paths and slack independently of input order", () => {
    const p = fixture();
    const s = schedule(
      [task("end", 6, ["a", "b"]), task("b", 6), task("a", 18)],
      p.settings,
    );
    expect(s.days).toBe(4);
    expect(s.tasks.find((t) => t.id === "b")?.slack).toBe(2);
    expect(
      s.tasks
        .filter((t) => t.critical)
        .map((t) => t.id)
        .sort(),
    ).toEqual(["a", "end"]);
  });
  it("finds 12 daily hours per concurrent task to preserve the committed date", () => {
    expect(calculate(fixture()).requiredDailyHours).toBe(12);
  });
  it("reports a deadline as infeasible when graph depth prevents it", () => {
    const p = fixture();
    p.settings.deadline = "2026-10-06";
    expect(calculate(p).requiredDailyHours).toBeNull();
  });
  it("includes existing baseline lateness instead of attributing all lateness to the change", () => {
    const p = fixture();
    p.settings.deadline = "2026-10-08";
    const r = calculate(p);
    expect(r.deadlineSlip).toBe(3);
    expect(r.deltaDays).toBe(2);
  });
});

describe("working-day calendar", () => {
  it.each([
    ["2026-10-09", 1, "2026-10-12"],
    ["2026-10-10", 0, "2026-10-12"],
    ["2026-10-11", 5, "2026-10-19"],
    ["2026-10-30", 2, "2026-11-03"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
  ])("adds %s + %i working days", (date, days, expected) =>
    expect(addWorkdays(date, days)).toBe(expected),
  );
  it("measures elapsed weekdays across a DST weekend", () =>
    expect(workdayDistance("2026-10-30", "2026-11-03")).toBe(2));
  it("measures earlier deadlines with a negative distance", () =>
    expect(workdayDistance("2026-10-13", "2026-10-09")).toBe(-2));
  it("uses the actual calendar deadline on weekends", () => {
    const p = fixture();
    p.settings.deadline = "2026-10-11";
    expect(calculate(p).deadlineSlip).toBe(2);
  });
  it("uses inclusive finish dates for a one-day task", () =>
    expect(schedule([task("a", 6)], fixture().settings).finishDate).toBe(
      "2026-10-05",
    ));
});

describe("strict import and graph validation", () => {
  it("accepts a valid project and returns a defensive copy", () => {
    const p = fixture();
    const valid = validateProject(p);
    valid.baseline[0].name = "changed";
    expect(p.baseline[0].name).toBe("design");
  });
  it.each([
    [
      "zero hours",
      (p: Project) => {
        p.baseline[0].hours = 0;
      },
    ],
    [
      "NaN",
      (p: Project) => {
        p.settings.hourlyRate = NaN;
      },
    ],
    [
      "infinity",
      (p: Project) => {
        p.changes[0].hours = Infinity;
      },
    ],
    [
      "negative hours",
      (p: Project) => {
        p.changes[0].hours = -2;
      },
    ],
    [
      "missing dependency",
      (p: Project) => {
        p.baseline[0].dependsOn = ["missing"];
      },
    ],
    [
      "self edge",
      (p: Project) => {
        p.baseline[0].dependsOn = ["design"];
      },
    ],
    [
      "cycle",
      (p: Project) => {
        p.baseline[0].dependsOn = ["launch"];
      },
    ],
    [
      "cycle introduced by blocking",
      (p: Project) => {
        p.changes[0].blocks = ["design"];
      },
    ],
    [
      "unknown blocking target",
      (p: Project) => {
        p.changes[0].blocks = ["missing"];
      },
    ],
    [
      "duplicate ID",
      (p: Project) => {
        p.changes[0].id = "design";
      },
    ],
    [
      "impossible date",
      (p: Project) => {
        p.settings.startDate = "2026-02-30";
      },
    ],
    [
      "missing date",
      (p: Project) => {
        p.settings.deadline = "";
      },
    ],
    [
      "empty title",
      (p: Project) => {
        p.title = " ";
      },
    ],
    [
      "empty baseline",
      (p: Project) => {
        p.baseline = [];
      },
    ],
    [
      "excessive daily hours",
      (p: Project) => {
        p.settings.dailyHours = 25;
      },
    ],
    [
      "too many tasks",
      (p: Project) => {
        p.baseline = Array.from({ length: 61 }, (_, i) => task(`t${i}`, 6));
      },
    ],
  ])("rejects %s before calculation", (_, mutate) => {
    const p = fixture();
    mutate(p);
    expect(() => validateProject(p)).toThrow();
    expect(() => calculate(p)).toThrow();
  });
  it.each([
    null,
    {},
    [],
    "text",
    { version: 9 },
    { version: 1, settings: null },
  ])("rejects malformed shape %j", (p) =>
    expect(() => validateProject(p)).toThrow(),
  );
  it("allows literal markup as names without interpreting it", () => {
    const p = fixture();
    p.title = "<img src=x onerror=alert(1)>";
    expect(validateProject(p).title).toBe(p.title);
  });
});

describe("optional scope deferral", () => {
  it("deletes an invalid task before validating the resulting plan", () => {
    const p = fixture();
    p.baseline[0].name = "";
    const result = removeTask(p, "design");
    expect(result.baseline).toHaveLength(2);
    expect(result.baseline[0].dependsOn).toEqual([]);
    expect(calculate(result).revised.finishDate).toBe("2026-10-09");
  });
  it("rewires a deferred middle task to its retained ancestors", () => {
    const p = fixture();
    p.baseline[1].optional = true;
    const result = deferTask(p, "build");
    expect(result.baseline.map((t) => t.id)).toEqual(["design", "launch"]);
    expect(result.baseline[1].dependsOn).toEqual(["design"]);
    expect(result.changes[0].dependsOn).toEqual(["design"]);
    expect(calculate(result).revised.finishDate).toBe("2026-10-09");
    expect(p.baseline).toHaveLength(3);
    expect(calculate(p).deferrals).toEqual([
      {
        id: "build",
        name: "build",
        finishDate: "2026-10-09",
        savedDays: 2,
        meetsDeadline: true,
      },
    ]);
  });
  it("preserves a new blocking edge when its optional target is deferred", () => {
    const p = fixture();
    p.baseline[1].optional = true;
    p.changes[0].dependsOn = ["design"];
    p.changes[0].blocks = ["build"];
    const result = deferTask(p, "build");
    const receipt = calculate(result);
    expect(
      receipt.revised.tasks.find((t) => t.id === "launch")?.dependsOn.sort(),
    ).toEqual(["design", "export"]);
    expect(receipt.revised.finishDate).toBe("2026-10-09");
  });
  it("refuses to defer required or unknown tasks", () => {
    expect(() => deferTask(fixture(), "design")).toThrow();
    expect(() => deferTask(fixture(), "missing")).toThrow();
  });
});
