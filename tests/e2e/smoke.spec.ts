import { expect, test, type Page } from "@playwright/test";

// SCREENSHOT_DIR=/some/dir npm run e2e → full-page screenshots for visual review.
const shotDir = process.env.SCREENSHOT_DIR;
async function shot(page: Page, name: string) {
  if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true });
}

/** Answer the visible question whatever its type. */
async function answerCurrent(page: Page) {
  const radios = page.getByRole("radiogroup", { name: "Answer options" }).getByRole("radio");
  if (await radios.count()) return radios.first().click();
  const boxes = page.getByRole("checkbox").filter({ hasNot: page.locator("[aria-label^='Mark']") });
  const list = page.getByRole("list", { name: "Put the items in order" });
  if (await list.count()) return;
  const input = page.getByPlaceholder(/e\.g\.|Your answer/);
  if (await input.count()) return input.first().fill("1");
  if (await boxes.count()) return boxes.first().check();
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test("dashboard, schedule and key dates render", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#next-up")).toBeVisible();
  await expect(page.getByText(/TU Delft CST/).first()).toBeVisible();
  await expect(page.getByText(/TU\/e selection/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your learning path" })).toBeVisible();
  await shot(page, "01-dashboard");

  await page.goto("/schedule?view=all");
  await expect(page.getByText("Week 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Week 19", { exact: true })).toBeVisible();
  await page.getByText("Week 3", { exact: true }).click();
  const firstTask = page.getByRole("checkbox", { name: /Mark ".*" done/ }).first();
  await firstTask.check();
  await expect(firstTask).toBeChecked();
  await shot(page, "02-schedule-all");
  await page.goto("/schedule?view=calendar");
  await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  await shot(page, "03-calendar");
});

test("unit page tabs, practice with hint and error log", async ({ page }) => {
  await page.goto("/units/L1");
  await expect(page.getByRole("heading", { name: /L1 · Propositional logic/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Key ideas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Common traps" })).toBeVisible();
  await shot(page, "04-unit-overview");

  await page.getByRole("tab", { name: "Practice" }).click();
  await page.getByRole("button", { name: /Practise 10 questions/ }).click();
  await expect(page.getByText("1/10")).toBeVisible();
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.getByRole("note")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await answerCurrent(page);
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Worked solution.")).toBeVisible();
    if (i === 0) await shot(page, "05-practice-feedback");
    await page.getByRole("button", { name: "Next question" }).click();
  }
  await page.getByRole("button", { name: /End session/ }).click();
  await expect(page.getByText(/Practice complete/)).toBeVisible();

  await page.goto("/units/L1?tab=ask");
  await page.getByLabel("Write down a question you want to resolve").fill("Why is p → q true when p is false?");
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByText("Why is p → q true when p is false?")).toBeVisible();
  await expect(page.getByText(/AI tutor — not set up/)).toBeVisible();
  await shot(page, "06-unit-ask");
});

test("timed unit test with no going back produces a result", async ({ page }) => {
  await page.goto("/units/A2?tab=test");
  await page.getByText("Options", { exact: true }).click();
  await page.getByLabel("Questions").selectOption("5");
  await page.getByRole("button", { name: "Start timed test" }).click();
  await page.getByRole("button", { name: "Start section" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("No going back in this test.")).toBeVisible();
  // The timer survives a reload.
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await shot(page, "07-timed-test");
  for (let i = 0; i < 4; i++) {
    await answerCurrent(page);
    await page.getByRole("button", { name: "Next →" }).click();
  }
  await page.getByRole("button", { name: "Submit section" }).last().click();
  await expect(page.getByText("Score", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Answer review" })).toBeVisible();
  await shot(page, "08-results");

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await shot(page, "09-review");
});

test("a written mock in CST format runs section by section", async ({ page }) => {
  await page.goto("/mock");
  await shot(page, "10-mocks");
  await page.getByRole("button", { name: "Take in CST format (2 sections)" }).first().click();
  for (let s = 0; s < 2; s++) {
    if (s > 0) await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start section" }).click();
    await answerCurrent(page);
    await page.getByRole("button", { name: "Submit section" }).first().click();
  }
  await expect(page.getByText("CST weighted score")).toBeVisible();
  await expect(page.getByText(/Readiness:/)).toBeVisible();
  await shot(page, "11-mock-result");
});

test("analytics, resources, settings and tutor API", async ({ page, request }) => {
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await page.goto("/resources");
  await expect(page.getByText(/Delftse Foundations of Computation/).first()).toBeVisible();
  await shot(page, "12-resources");
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/");
  await shot(page, "13-dashboard-dark");

  const status = await request.get("/api/tutor");
  expect(await status.json()).toMatchObject({ configured: false });
  const post = await request.post("/api/tutor", { data: { unit: "L1", messages: [{ role: "user", content: "hi" }] } });
  expect(post.status()).toBe(503);
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ["/", "/schedule", "/units/M3", "/mock"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, path).toBe(false);
  }
  const tabBar = page.getByRole("navigation", { name: "Main" }).last();
  await expect(tabBar.getByRole("link", { name: "Progress" })).toBeVisible();
  await tabBar.getByRole("link", { name: "Learn" }).click();
  await expect(page.getByRole("heading", { name: "Learn", exact: true })).toBeVisible();
  await shot(page, "14-mobile");
});
