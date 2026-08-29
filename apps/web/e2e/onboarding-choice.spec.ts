import { expect, test } from "@playwright/test";

const dialogName = "让我根据你的 MBTI，推荐属于你的贵州本命茶";

test("choice dialog traps the initial focus and Escape reveals the MBTI picker", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: /我知道自己的 MBTI/ })).toBeFocused();
  await expect(page.locator(".onboarding-screen")).toHaveAttribute("inert", "");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("listbox", { name: "能量维度" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("unknown MBTI completes onboarding and opens the eight-card feed without showing seed cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "还不知道，直接看茶叶卡" }).click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(page.getByText("三杯茶，先来见你。")).toHaveCount(0);
  await expect(page.locator(".deck-motion .card-identity")).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "主导航" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.reload();
    if (await navigation.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) break;
  }
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("dialog", { name: dialogName })).toHaveCount(0);
});

test("choice dialog stays within 320, 390 and 430px viewports", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const measurements = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
      return {
        documentFits: document.documentElement.scrollWidth <= window.innerWidth,
        dialogFits: rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight,
        buttonsFit: buttons.every((button) => button.left >= rect.left && button.right <= rect.right && button.top >= rect.top && button.bottom <= rect.bottom),
      };
    });
    expect(measurements).toEqual({ documentFits: true, dialogFits: true, buttonsFit: true });
  }
});
