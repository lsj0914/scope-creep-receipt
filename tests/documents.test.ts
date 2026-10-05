import { expect, it } from "vitest";
import {
  escapeHTML,
  parseProject,
  receiptMarkdown,
  serializeProject,
} from "../src/documents";
import { example } from "../src/examples";
import { calculate } from "../src/engine";
import { receiptHTML } from "../src/receipt";

it("exports a dense accepted project within its own import limit", () => {
  const p = example("launch");
  const tasks = Array.from({ length: 100 }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    name: "x".repeat(120),
    hours: 0.25,
    optional: false,
    dependsOn: [] as string[],
  }));
  tasks.forEach((t, i) => {
    t.dependsOn = tasks.slice(0, i).map((other) => other.id);
  });
  p.baseline = tasks.slice(0, 60);
  p.changes = tasks.slice(60).map((t) => ({ ...t, blocks: [] }));
  const portable = serializeProject(p);
  expect(new TextEncoder().encode(portable).length).toBeLessThanOrEqual(256000);
  expect(parseProject(portable)).toEqual(p);
});

it("uses unrounded effort for buffer money in both HTML and Markdown", () => {
  const p = example("launch");
  p.changes[0].hours = 0.25;
  p.settings.hourlyRate = 100;
  p.settings.bufferPercent = 10;
  const r = calculate(p);
  for (const output of [receiptHTML(p, r, "en"), receiptMarkdown(p, r, "en")]) {
    expect(output).toContain("$25.00");
    expect(output).toContain("$2.50");
    expect(output).toContain("$27.50");
    expect(output).not.toContain("$3.00");
  }
});

it("round trips all dependency and blocking information through JSON", () => {
  const p = example("tradeoff");
  expect(parseProject(JSON.stringify(p))).toEqual(p);
});
it("rejects invalid JSON and oversized imports", () => {
  expect(() => parseProject("{broken")).toThrow();
  expect(() => parseProject("a".repeat(256_001))).toThrow();
});
it("escapes untrusted attribute delimiters and markup", () => {
  expect(escapeHTML("<img src=\"x\" onerror='alert(1)'>&")).toBe(
    "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;",
  );
});
it("exports actual computed totals, dates and model assumptions", () => {
  const p = example("launch");
  const md = receiptMarkdown(p, calculate(p), "en");
  expect(md).toContain("$900.00");
  expect(md).toContain("2026-10-09");
  expect(md).toContain("2026-10-13");
  expect(md).toMatch(/separate capacity/i);
  expect(md).toContain("12");
  expect(md).toContain("Add CSV export");
});
it("exports readable Chinese receipts", () => {
  const p = example("launch", "zh");
  const md = receiptMarkdown(p, calculate(p), "zh");
  expect(md).toContain("需求加塞账单");
  expect(md).toContain("增加 CSV 导出");
  expect(md).toContain("工作日");
});
it("escapes user-supplied markdown so names cannot inject sections or links", () => {
  const p = example("launch");
  p.title = "# Heading\n[click](https://example.com) <script>";
  const md = receiptMarkdown(p, calculate(p), "en");
  expect(md).not.toContain("\n[click]");
  expect(md).toContain("\\<script\\>");
});
