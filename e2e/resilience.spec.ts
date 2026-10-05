import { test, expect } from "@playwright/test";

test("preserves a rejected saved draft until explicit replacement", async ({
  page,
}) => {
  const rejected = '{"version":1,"title":"Salvage this draft","baseline":';
  await page.addInitScript((value) => {
    localStorage.setItem("scope-creep-receipt.project.v1", value);
  }, rejected);
  await page.goto("/");
  await expect(page.getByTestId("draft-recovery")).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("scope-creep-receipt.project.v1"),
    ),
  ).toBe(rejected);
  await page.getByLabel("Project name").fill("Do not overwrite yet");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("scope-creep-receipt.project.v1"),
    ),
  ).toBe(rejected);
  await page
    .getByRole("button", { name: "Use current plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByTestId("draft-recovery")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("scope-creep-receipt.project.v1")!)
          .title,
    ),
  ).toBe("Do not overwrite yet");
});

test("allows deleting a blank baseline task to recover a valid receipt", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Task name", { exact: true }).first().fill("");
  await expect(page.getByTestId("calculation-error")).toBeVisible();
  await page.locator(".task-row").first().getByRole("button").click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByLabel("Task name", { exact: true })).toHaveCount(2);
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
});

test("applies the capacity alternative to both schedules", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Apply daily hours", exact: true })
    .click();
  await expect(page.getByLabel("Hours per task / day")).toHaveValue("12");
  await expect(page.getByTestId("new-finish")).toHaveText("Oct 8, 2026");
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
});

test("warns before replacing an edited draft and cancel retains it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Keep my work");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Keep my work");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByTestId("receipt-total")).toHaveText("$0.00");
  await expect(page.getByLabel("Task name", { exact: true })).toHaveCount(1);
});

test("reports unavailable local storage while keeping the calculator usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await expect(page.locator("#save-status")).toContainText(
    "storage unavailable",
  );
  await expect(page.getByTestId("receipt-total")).toHaveText("$900.00");
  await expect(
    page.getByRole("button", { name: "Save project", exact: true }),
  ).toBeEnabled();
});

test("clipboard failure offers an actionable download fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Copy receipt", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Download");
});

test("print layout isolates the receipt and includes its assumptions", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#planner")).toBeHidden();
  await expect(page.locator("#receipt")).toBeVisible();
  await expect(page.locator("#receipt .method p").first()).toBeVisible();
  await expect(page.locator(".output-tools")).toBeHidden();
});

test("tabs support keyboard navigation and keep a visible focus target", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Original plan/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Added scope/ })).toBeFocused();
  await expect(page.getByLabel("Effort (hours)", { exact: true })).toHaveCount(
    1,
  );
});

test("does not emit runtime errors during normal editing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Effort buffer (%)").fill("15");
  await page.getByLabel("Currency").selectOption("EUR");
  await page.getByRole("tab", { name: /Added scope/ }).click();
  await page.getByLabel("Effort (hours)", { exact: true }).fill("18");
  await expect(page.getByTestId("receipt-total")).toHaveText("€1,552.50");
  expect(errors).toEqual([]);
});
