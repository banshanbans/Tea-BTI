import { expect, test } from "@playwright/test";

const teaNames = ["都匀毛尖", "湄潭翠芽", "绿宝石茶", "普安红", "凤冈锌硒茶", "遵义红", "雷山银球茶", "梵净山抹茶"];

async function enterFeed(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "还没测过？先凭感觉开始" }).click();
  await page.getByRole("button", { name: "开始刷茶" }).click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
}

test("390×844 shows all eight identified teas, like/save and the fifth-swipe recommendation", async ({ page }) => {
  await enterFeed(page);
  const seen = new Set<string>();

  for (let index = 0; index < 8; index += 1) {
    const identity = page.locator(".deck-motion .card-identity");
    await expect(identity).toBeVisible();
    const label = await identity.textContent();
    const name = teaNames.find((candidate) => label?.includes(candidate));
    expect(name).toBeTruthy();
    seen.add(name!);

    const art = page.locator(".deck-motion .presentation-art");
    await expect(art).toBeVisible();
    expect(await art.evaluate((element) => getComputedStyle(element).objectFit)).toBe("contain");

    if (index === 0) await page.getByRole("button", { name: "这杯想喝" }).click();
    else if (index === 1) await page.getByRole("button", { name: "先收藏" }).click();
    else await page.getByRole("button", { name: "这杯不对胃" }).click();

    const feedback = page.getByRole("dialog", { name: "喜欢的茶已揭晓" });
    if (index < 2) {
      await expect(feedback).toBeVisible();
      await feedback.getByRole("button", { name: "继续刷" }).click();
    }

    const recommendation = page.getByText("这一杯，想让你先喝。", { exact: false });
    if (index >= 4) {
      await expect(recommendation).toBeVisible();
      await page.getByRole("button", { name: "继续刷" }).click();
    }
    if (index < 7) await expect(page.locator(".deck-motion .card-identity")).not.toHaveText(label!);
  }

  expect([...seen].sort()).toEqual([...teaNames].sort());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("green, black and matcha details use real photos and five information sections", async ({ page }) => {
  for (const [teaId, name] of [["duyun-maojian", "都匀毛尖"], ["puan-hong", "普安红"], ["fanjingshan-matcha", "梵净山抹茶"]] as const) {
    await page.goto(`/tea/${teaId}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    const photo = page.getByAltText(`${name}实拍参考图`);
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute("src", new RegExp(`/api/v1/media/details/${teaId}`));
    for (const heading of ["代表特点", "香气与滋味", "性格关键词", "冲泡建议"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(page.getByText("查看公开来源与图片边界")).toBeVisible();
    await expect(page.getByRole("link", { name: /开始陪泡/ })).toBeVisible();
    await page.getByText("想先去别处看看").click();
    await expect(page.getByRole("link", { name: "陪品" })).toBeVisible();
    if (teaId === "duyun-maojian") await expect(page.locator(".journey-explore").getByRole("link", { name: "茶境" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("360px viewport keeps the eight-tea feed and matcha detail within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await enterFeed(page);
  await expect(page.locator(".deck-motion .card-identity")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/tea/fanjingshan-matcha");
  await expect(page.getByRole("heading", { name: "梵净山抹茶" })).toBeVisible();
  await expect(page.getByAltText("梵净山抹茶实拍参考图")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
