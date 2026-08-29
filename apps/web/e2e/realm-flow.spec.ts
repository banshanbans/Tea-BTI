import { expect, test } from "@playwright/test";

test("Tea Realm desktop fallback completes seven scenes without camera or microphone", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => { throw new Error("Tea Realm must not request media"); } },
    });
  });

  await page.goto("/realm");
  await expect(page.getByRole("heading", { name: "从杯中这一口， 回到雾里的一芽。" })).toBeVisible();
  await page.getByRole("link", { name: "进入茶境" }).click();
  await page.getByRole("button", { name: "进入茶境" }).click();

  await page.getByRole("button", { name: "轻触茶汤" }).click();
  await page.getByRole("button", { name: "返回上一幕" }).click();
  await expect(page.getByRole("heading", { name: "杯中起雾" })).toBeVisible();
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  const mist = page.getByRole("group", { name: "拨开雾层" });
  await mist.press("Enter");
  await mist.press("Enter");
  await mist.press("Enter");
  await page.getByRole("button", { name: "山出现了" }).click();

  await page.getByRole("button", { name: "只有一枚芽" }).click();
  await expect(page.getByText("这一枚也在长大。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "一芽一叶" }).click();
  await expect(page.getByText("1 / 53,000+", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "把它带去锅边" }).click();

  const wok = page.getByRole("button", { name: "制茶手势区域" });
  await wok.press("Enter");
  await wok.press("Enter");
  await wok.press("Enter");
  await wok.press("Enter");
  await page.getByRole("button", { name: "去做最后的判断" }).click();

  await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "现在停" }).click();

  await page.getByRole("button", { name: "回到真实干茶" }).click();
  await expect(page.getByText("论文样本与商品批次无关。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "收下这一芽" }).click();
  await page.getByRole("button", { name: "收进茶护照" }).click();

  await expect(page.getByRole("heading", { name: "白毫" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看茶护照" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("link", { name: "查看茶护照" }).click();
  await expect(page.getByText("茶境标本")).toBeVisible();
});

test("deep links use allowlisted return fallbacks", async ({ page }) => {
  await page.goto("/tea/duyun-maojian?origin=outside");
  await expect(page.getByRole("link", { name: "返回刷茶" })).toHaveAttribute("href", "/");

  await page.goto("/realm/duyun-maojian-mist-bud?entry=tea&origin=profile&teaId=duyun-maojian");
  await expect(page.getByRole("link", { name: "退出茶境并返回茶详情" })).toHaveAttribute("href", "/tea/duyun-maojian?origin=profile");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/realm/duyun-maojian-mist-bud?entry=outside&origin=profile&teaId=duyun-maojian");
  await expect(page.getByRole("link", { name: "退出茶境并返回茶境首页" })).toHaveAttribute("href", "/realm");
});
