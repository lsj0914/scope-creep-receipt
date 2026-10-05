import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the real receipt and updates it when change effort is edited", async ({
  page,
}) => {
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
  await page.getByRole("tab", { name: /Added scope/ }).click();
  await page.getByLabel("Effort (hours)", { exact: true }).fill("24");
  await expect(page.getByTestId("receipt-total")).toHaveText("$1,800.00");
  await expect(page.getByTestId("new-finish")).toHaveText("Oct 15, 2026");
  await page.reload();
  await expect(page.getByTestId("receipt-total")).toHaveText("$1,800.00");
});

test("switches language without discarding the draft", async ({ page }) => {
  await page.getByLabel("Project name").fill("My custom launch");
  await page.getByRole("button", { name: "中文" }).click();
  await expect(
    page.getByRole("heading", { name: "需求加塞账单", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("项目名称")).toHaveValue("My custom launch");
  await page.reload();
  await expect(page.getByLabel("项目名称")).toHaveValue("My custom launch");
});

test("parallel example keeps the delivery date while adding cost", async ({
  page,
}) => {
  await page.getByLabel("Example scenario").selectOption("parallel");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
  await expect(page.getByTestId("delay-days")).toHaveText("0");
  await expect(page.getByTestId("new-finish")).toHaveText("Oct 9, 2026");
});

test("invalid numeric inputs suppress exports and recover after correction", async ({
  page,
}) => {
  await page.getByRole("tab", { name: /Added scope/ }).click();
  await page.getByLabel("Effort (hours)", { exact: true }).fill("0");
  await expect(page.getByTestId("calculation-error")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download receipt" }),
  ).toBeDisabled();
  await page.getByLabel("Effort (hours)", { exact: true }).fill("6");
  await expect(page.getByTestId("receipt-total")).toHaveText("$450.00");
});

test("exports usable project JSON and an itemized Markdown receipt", async ({
  page,
}) => {
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const json = await jsonPromise;
  expect(json.suggestedFilename()).toMatch(/\.json$/);
  const stream = await json.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const project = JSON.parse(Buffer.concat(chunks).toString());
  expect(project.changes[0].blocks).toEqual(["qa"]);
  const mdPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt" }).click();
  const md = await mdPromise;
  const mdStream = await md.createReadStream();
  const mdChunks: Buffer[] = [];
  for await (const chunk of mdStream!) mdChunks.push(chunk);
  expect(Buffer.concat(mdChunks).toString()).toContain("$900.00");
});

test("rejects malformed imports and safely renders literal markup", async ({
  page,
}) => {
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("alert")).toContainText("JSON");
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const project = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("scope-creep-receipt.project.v1")!),
  );
  project.title = '<img src=x onerror="window.HACKED=true">';
  await page.locator("#import-file").setInputFiles({
    name: "safe.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel("Project name")).toHaveValue(project.title);
  expect(await page.evaluate(() => "HACKED" in window)).toBe(false);
  await expect(page.locator("#receipt img")).toHaveCount(0);
});

test("optional scope alternative restores the deadline and remains editable", async ({
  page,
}) => {
  await page.getByLabel("Example scenario").selectOption("tradeoff");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expect(page.getByTestId("delay-days")).toHaveText("1");
  await page
    .getByRole("button", { name: "Defer Create social media pack" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByTestId("new-finish")).toHaveText("Oct 9, 2026");
  await expect(page.getByLabel("Task name", { exact: true })).toHaveCount(3);
});

test("supports task creation and confirmed deletion with recalculation", async ({
  page,
}) => {
  await page.getByRole("tab", { name: /Added scope/ }).click();
  await page.getByRole("button", { name: "Add change task" }).click();
  await expect(page.getByLabel("Task name", { exact: true })).toHaveCount(2);
  await page
    .getByLabel("Task name", { exact: true })
    .nth(1)
    .fill("Documentation");
  await page.getByLabel("Effort (hours)", { exact: true }).nth(1).fill("6");
  await expect(page.getByTestId("receipt-total")).toHaveText("$1,350.00");
  await page.getByRole("button", { name: "Remove Documentation" }).click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
});

test("detects a dependency cycle entered through the editor", async ({
  page,
}) => {
  await page.getByRole("tab", { name: /Added scope/ }).click();
  await page.getByText("Blocks existing tasks", { exact: true }).click();
  await page
    .locator('[data-link-group="blocks"]')
    .getByLabel("Confirm scope & design", { exact: true })
    .check();
  await expect(page.getByTestId("calculation-error")).toContainText("cycle");
  await page
    .locator('[data-link-group="blocks"]')
    .getByLabel("Confirm scope & design", { exact: true })
    .uncheck();
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
});

test("has no serious accessibility violations or horizontal overflow", async ({
  page,
}) => {
  await expect(page.getByTestId("receipt-total")).toBeVisible();
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
