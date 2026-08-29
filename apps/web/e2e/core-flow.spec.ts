import { expect, test } from "@playwright/test";

test("core journey, editable Tea Profile and revocable public sharing", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /开始刷茶/ }).click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
  await page.getByRole("button", { name: "不知道？先刷再说" }).click();
  await expect(page.getByText("探索型三杯")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
  await page.getByRole("button", { name: /开始刷茶，让推荐变准/ }).click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();

  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "想喝" }).click();
    await expect(page.getByText("你刚刚喜欢的是")).toBeVisible();
    await page.getByRole("button", { name: "继续刷" }).click();
  }

  await expect(page.getByText("我开始有点懂你了", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "继续刷" }).click();
  await page.getByRole("button", { name: "想喝" }).click();
  await expect(page.getByText("你刚刚喜欢的是")).toBeVisible();
  await page.getByRole("button", { name: "继续刷" }).click();
  await expect(page.getByText("我开始有点懂你了", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "继续刷" }).click();
  await page.getByRole("button", { name: "想喝" }).click();
  await expect(page.getByRole("heading", { name: "都匀毛尖" })).toBeVisible();
  await page.getByRole("link", { name: /看看这杯/ }).click();
  await expect(page).toHaveURL(/\/tea\//);
  await expect(page.getByRole("heading", { name: "都匀毛尖" })).toBeVisible();

  await page.getByRole("link", { name: /开始陪泡/ }).click();
  await expect(page).toHaveURL(/\/brew\//);
  await page.getByRole("button", { name: "开启麦克风，开始陪伴" }).click();
  await expect(page.getByText("演示模式 · 正在陪伴")).toBeVisible();
  await page.getByRole("button", { name: "完成" }).click();
  await page.getByRole("button", { name: "结束并记为已泡过" }).click();
  await expect(page.getByText("这杯，已经泡出来了。")).toBeVisible();

  await page.getByRole("link", { name: /接着说出这一口/ }).click();
  await expect(page).toHaveURL(/\/taste\//);
  await page.getByRole("button", { name: "开启麦克风，开始陪伴" }).click();
  await page.getByPlaceholder("也可以直接输入你想说的话…").fill("像青草，喝完有一点甜和回甘");
  await page.getByRole("button", { name: "发送文字" }).click();
  await page.getByRole("button", { name: "结束并保存" }).click();
  await expect(page.getByText("你的话，已经变成茶语。")).toBeVisible();
  await page.getByRole("link", { name: /进入《雾里一芽》/ }).click();
  await expect(page).toHaveURL(/\/realm\/duyun-maojian-mist-bud/);
  await page.getByRole("button", { name: "进入茶境" }).click();
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  const mist = page.getByRole("group", { name: "拨开雾层" });
  await mist.press("Enter"); await mist.press("Enter"); await mist.press("Enter");
  await page.getByRole("button", { name: "山出现了" }).click();
  await page.getByRole("button", { name: "一芽一叶" }).click();
  await page.getByRole("button", { name: "把它带去锅边" }).click();
  const craft = page.getByRole("button", { name: "制茶手势区域" });
  for (let index = 0; index < 4; index += 1) await craft.press("Enter");
  await page.getByRole("button", { name: "去做最后的判断" }).click();
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "现在停" }).click();
  await page.getByRole("button", { name: "回到真实干茶" }).click();
  await page.getByRole("button", { name: "收下这一芽" }).click();
  await page.getByRole("button", { name: "收进 Passport" }).click();
  await expect(page.getByRole("heading", { name: "白毫" })).toBeVisible();
  await page.getByRole("link", { name: "查看茶护照" }).click();
  await expect(page).toHaveURL(/\/passport$/);
  await expect(page.getByText("像青草，喝完有一点甜和回甘", { exact: false })).toBeVisible();
  await expect(page.getByText("已完成茶境")).toBeVisible();

  await page.getByRole("link", { name: /看看我的 Tea-BTI/ }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Tea-BTI ·", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("昵称").fill("雾里喝茶的人");
  await page.getByLabel("简介").fill("在清鲜和回甘之间，慢慢找到自己的这一杯。");
  await page.getByLabel(/只可从真实行为候选中选择/).selectOption({ index: 1 });
  await page.getByLabel("原话来源").selectOption({ index: 1 });
  await page.getByLabel(/公开版本/).fill("像雨后打开的窗，尾巴有一点甜。");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "保存四个 Block" }).click();
  await expect(page.getByText("茶主页已保存")).toBeVisible();
  await expect(page.getByText("都匀毛尖").or(page.getByText("湄潭翠芽")).or(page.getByText("遵义红")).first()).toBeVisible();

  await page.getByRole("button", { name: "预览并分享" }).click();
  await expect(page.getByTestId("profile-share-preview")).toContainText("像雨后打开的窗");
  await page.getByRole("button", { name: "确认公开并生成链接" }).click();
  const publicLink = page.locator(".profile-qr a");
  await expect(publicLink).toBeVisible();
  const publicUrl = await publicLink.getAttribute("href");
  expect(publicUrl).toMatch(/\/p\/[A-Za-z0-9_-]{22,}$/);

  const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const visitor = await visitorContext.newPage();
  await visitor.goto(publicUrl!);
  await expect(visitor.getByRole("heading", { name: "雾里喝茶的人" })).toBeVisible();
  expect(await visitor.evaluate(() => localStorage.getItem("tea-bti.anonymousToken"))).toBeNull();
  expect(await visitor.evaluate(() => localStorage.getItem("shuacha.anonymousToken"))).toBeNull();
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await visitor.getByRole("button", { name: "开始我的三杯 →" }).click();
  await expect(visitor).toHaveURL(/\/?fromProfile=/);
  await visitor.getByRole("button", { name: /开始刷茶/ }).click();
  await expect(visitor.getByRole("heading", { name: /你的 MBTI/ })).toBeVisible();
  await expect(visitor.getByRole("navigation", { name: "主导航" })).toHaveCount(0);

  await page.getByRole("button", { name: "撤销并让旧链接失效" }).click();
  await expect(page.getByText("旧链接已立即失效")).toBeVisible();
  await visitor.goto(publicUrl!);
  await expect(visitor.getByRole("heading", { name: "这个茶主页已经收起" })).toBeVisible();
  await visitorContext.close();
});
