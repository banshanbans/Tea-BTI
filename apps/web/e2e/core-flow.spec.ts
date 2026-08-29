import { expect, test } from "@playwright/test";

test("core journey, editable Tea Profile and revocable public sharing", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).toBeVisible();
  await page.getByRole("button", { name: /我知道自己的 MBTI/ }).click();
  await expect(page.getByRole("heading", { name: "找到你的 MBTI" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
  await page.getByRole("button", { name: /就选这个 · INFJ/ }).click();
  await expect(page.getByText("三杯茶，先来见你。")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
  await page.getByRole("button", { name: "开始刷茶" }).click();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();

  const topCard = page.locator(".deck-motion");
  const likeAction = page.getByRole("button", { name: "这杯想喝" });
  const nextCard = page.locator(".deck-layer.depth-1");
  const cardTitle = await topCard.getByRole("heading").textContent();
  const topBox = await topCard.boundingBox();
  expect(topBox).not.toBeNull();
  const likeBefore = await likeAction.evaluate((element) => getComputedStyle(element).transform);
  const nextBefore = await nextCard.evaluate((element) => getComputedStyle(element).transform);
  await page.mouse.move(topBox!.x + topBox!.width / 2, topBox!.y + topBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(topBox!.x + topBox!.width / 2 + 70, topBox!.y + topBox!.height / 2, { steps: 5 });
  await page.waitForTimeout(80);
  expect(await likeAction.evaluate((element) => getComputedStyle(element).transform)).not.toBe(likeBefore);
  expect(await nextCard.evaluate((element) => getComputedStyle(element).transform)).not.toBe(nextBefore);
  await page.mouse.move(topBox!.x + topBox!.width / 2 + 150, topBox!.y + topBox!.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("这一杯是")).toBeVisible();
  await page.getByRole("button", { name: "关闭茶叶揭晓" }).click({ position: { x: 12, y: 12 } });
  const cardPreview = page.getByRole("dialog", { name: /完整茶叶卡/ });
  if (await cardPreview.isVisible()) await cardPreview.getByRole("button", { name: "关闭完整茶叶卡", exact: true }).click();
  await expect(topCard.getByRole("heading")).not.toHaveText(cardTitle!);
  await expect.poll(async () => {
    const resumedBox = await topCard.boundingBox();
    return Math.max(
      Math.abs((resumedBox?.x ?? 0) - topBox!.x),
      Math.abs((resumedBox?.width ?? 0) - topBox!.width),
      Math.abs((resumedBox?.height ?? 0) - topBox!.height),
    );
  }).toBeLessThan(1);

  let foundDuyun = false;
  let sawNextTea = false;
  let resumeCardTitle = "";
  for (let index = 1; index < 12 && !foundDuyun; index += 1) {
    const nextCardTitle = await page.locator(".deck-layer.depth-1 .card-content h1").textContent();
    await page.getByRole("button", { name: "这杯想喝" }).click();
    const reveal = page.getByRole("dialog", { name: "喜欢的茶已揭晓" });
    await expect(reveal).toBeVisible();
    foundDuyun = await reveal.getByRole("heading", { name: "都匀毛尖" }).isVisible();
    if (foundDuyun) { resumeCardTitle = nextCardTitle || ""; break; }
    await reveal.getByRole("button", { name: "继续刷" }).click();
    const nextTea = page.getByText("这一杯，想让你先喝。", { exact: false });
    if (await nextTea.isVisible()) {
      sawNextTea = true;
      await page.getByRole("button", { name: "继续刷" }).click();
    }
  }
  expect(foundDuyun).toBe(true);
  expect(sawNextTea).toBe(true);
  expect(resumeCardTitle).not.toBe("");
  await page.getByRole("link", { name: /看看这杯/ }).click();
  await expect(page).toHaveURL(/\/tea\//);
  await expect(page.getByRole("heading", { name: "都匀毛尖" })).toBeVisible();
  const detailUrl = page.url();
  await page.getByRole("link", { name: "返回刷茶" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".deck-motion").getByRole("heading")).toHaveText(resumeCardTitle);
  await page.waitForLoadState("networkidle");
  await page.goto(detailUrl);
  await expect(page.getByRole("heading", { name: "都匀毛尖" })).toBeVisible();

  await page.getByRole("link", { name: /开始陪泡/ }).click();
  await expect(page).toHaveURL(/\/brew\//);
  await page.getByRole("button", { name: "打开麦克风" }).click();
  await expect(page.getByText(/正在陪伴|实时语音已连接|可使用文字输入/)).toBeVisible();
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "结束并记下这一泡" }).click();
  await expect(page.getByText("这一泡，记下了。")).toBeVisible();

  await page.getByRole("link", { name: /接着说出这一口/ }).click();
  await expect(page).toHaveURL(/\/taste\//);
  await page.getByRole("button", { name: "打开麦克风" }).click();
  await page.getByPlaceholder("也可以写下这一口…").fill("像青草，喝完有一点甜和回甘");
  await page.getByRole("button", { name: "发送文字" }).click();
  await page.getByRole("button", { name: "结束并保存" }).click();
  await expect(page.getByText("这句话，收好了。")).toBeVisible();
  await page.getByRole("link", { name: /进入《雾里一芽》/ }).click();
  await expect(page).toHaveURL(/\/realm\/duyun-maojian-mist-bud/);
  await page.getByRole("button", { name: "进入茶境" }).click();
  await page.getByRole("button", { name: "通过互动，亲手走完这一芽" }).click();
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  await page.getByRole("button", { name: "返回上一幕" }).click();
  await expect(page.getByRole("heading", { name: "杯中起雾" })).toBeVisible();
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  const mist = page.getByRole("group", { name: "拨开雾层" });
  await mist.press("Enter"); await mist.press("Enter"); await mist.press("Enter");
  await page.getByRole("button", { name: "继续去采芽" }).click();
  await page.getByRole("button", { name: "一芽一叶" }).press("Enter");
  await page.getByRole("button", { name: "把它带去锅边" }).click();
  await page.getByRole("button", { name: "手指拨开" }).click();
  await page.getByRole("button", { name: "左右擦开蒸汽" }).press("Enter");
  const craft = page.getByRole("button", { name: "制茶手势区域" });
  for (let index = 0; index < 4; index += 1) {
    await craft.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.getByRole("button", { name: "去做最后的判断" }).click();
  for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "现在停" }).click();
  await page.getByRole("button", { name: "回到真实干茶" }).click();
  await page.getByRole("button", { name: "收下这一芽" }).click();
  await page.getByRole("button", { name: "收进茶护照" }).click();
  await expect(page.getByRole("heading", { name: "清鲜的白毫" })).toBeVisible();
  await page.getByRole("link", { name: "查看茶护照" }).click();
  await expect(page).toHaveURL(/\/passport$/);
  await expect(page.getByText("像青草，喝完有一点甜和回甘", { exact: false })).toBeVisible();
  await expect(page.getByText("已完成茶境")).toBeVisible();

  await page.getByRole("link", { name: /看看我的 Tea-BTI/ }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Tea-BTI ·", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "编辑茶主页" }).click();
  await expect(page).toHaveURL(/\/profile\/edit$/);
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
  await page.getByLabel("昵称").fill("雾里喝茶的人");
  await page.getByLabel("简介").fill("在清鲜和回甘之间，慢慢找到自己的这一杯。");
  await page.getByLabel("本命茶", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("我说过", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("公开版本").fill("像雨后打开的窗，尾巴有一点甜。");
  for (const checkbox of await page.getByRole("checkbox").all()) if (await checkbox.isEnabled()) await checkbox.check();
  await page.getByRole("button", { name: "保存茶主页" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("都匀毛尖").or(page.getByText("湄潭翠芽")).or(page.getByText("遵义红")).first()).toBeVisible();
  await expect(page.getByText("雾里喝茶的人")).toHaveCount(0);
  await expect(page.getByText("公开", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: /查看我的人格解读/ }).click();
  await expect(page).toHaveURL(/\/profile\/tea-bti$/);
  await expect(page.getByRole("heading", { name: "我的茶桌精神速写" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "你可能有这些茶桌习惯" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "为什么最近是这个人格" })).toBeVisible();
  await expect(page.getByText("像青草，喝完有一点甜和回甘", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /继续刷，看看你会不会变/ })).toHaveAttribute("href", "/");

  await page.getByRole("button", { name: "分享 Tea-BTI" }).click();
  await expect(page.getByTestId("profile-share-preview")).toContainText("像雨后打开的窗");
  await page.getByRole("button", { name: "确认范围并生成链接" }).click();
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
  await expect(visitor.getByRole("dialog", { name: "让我根据你的 MBTI，推荐属于你的贵州本命茶" })).toBeVisible();
  await expect(visitor.getByRole("navigation", { name: "主导航" })).toHaveCount(0);

  await page.getByRole("button", { name: "撤销并让旧链接失效" }).click();
  await expect(page.getByText("旧链接已经收起")).toBeVisible();
  await visitor.goto(publicUrl!);
  await expect(visitor.getByRole("heading", { name: "这个茶主页已经收起" })).toBeVisible();
  await visitorContext.close();
});
