import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function clearMistByDragging(page: Page) {
  const mist = page.getByRole("group", { name: "拨开雾层" });
  const box = await mist.boundingBox();
  if (!box) throw new Error("Mist interaction region has no bounding box");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 35, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function dispatchTilt(page: Page, gamma: number, repeat = 1) {
  for (let index = 0; index < repeat; index += 1) {
    await page.evaluate((value) => {
      const event = new Event("deviceorientation");
      Object.defineProperties(event, { gamma: { value }, beta: { value: 0 } });
      window.dispatchEvent(event);
    }, gamma);
    await page.waitForTimeout(25);
  }
}

async function chooseBudWithKeyboard(page: Page, label: string) {
  await page.getByRole("button", { name: label }).press("Enter");
}

async function chooseBudByLifting(page: Page, label: string) {
  const bud = page.getByRole("button", { name: label });
  const box = await bud.boundingBox();
  if (!box) throw new Error(`Bud option ${label} has no bounding box`);
  expect(await bud.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2, { steps: 8 });
  await expect(bud).toHaveClass(/dragging/);
  await page.mouse.up();
}

async function clearSteamByWiping(page: Page) {
  await page.getByRole("button", { name: "改用手指擦开" }).click();
  await page.getByRole("button", { name: "左右擦开蒸汽" }).press("Enter");
}

async function doPointerCraft(page: Page) {
  const wok = page.getByRole("button", { name: "制茶手势区域" });
  const box = await wok.boundingBox();
  if (!box) throw new Error("Wok interaction region has no bounding box");
  const point = (x: number, y: number): [number, number] => [box.x + box.width * x, box.y + box.height * y];

  for (let push = 0; push < 3; push += 1) {
    await page.mouse.move(...point(0.5, 0.82));
    await page.mouse.down();
    await page.mouse.move(...point(0.5, 0.28), { steps: 8 });
    await page.mouse.up();
  }
  await expect(wok).toContainText("往复揉");
  await page.waitForTimeout(120);

  await page.mouse.move(...point(0.18, 0.52));
  await page.mouse.down();
  for (const x of [0.82, 0.18, 0.82, 0.18, 0.82, 0.18]) {
    await page.mouse.move(...point(x, 0.52), { steps: 3 });
  }
  await page.mouse.up();
  await expect(wok).toContainText("画一个圆");
  await page.waitForTimeout(120);

  const radius = Math.min(box.width, box.height) * 0.3;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x + radius, center.y);
  await page.mouse.down();
  for (let step = 1; step <= 24; step += 1) {
    const angle = step / 24 * Math.PI * 2;
    await page.mouse.move(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
  }
  await page.mouse.up();
  await expect(wok).toContainText("轻轻搓");
  await page.waitForTimeout(120);

  await page.mouse.move(...point(0.5, 0.42));
  await page.mouse.down();
  for (const y of [0.58, 0.42, 0.58, 0.42, 0.58, 0.42]) {
    await page.mouse.move(...point(0.5, y), { steps: 3 });
  }
  await page.mouse.up();
  await expect(wok).toContainText("四手已经做完");
}

async function doKeyboardCraft(page: Page) {
  const wok = page.getByRole("button", { name: "制茶手势区域" });
  for (let step = 0; step < 4; step += 1) {
    await wok.press("Enter");
    await page.waitForTimeout(120);
  }
}

async function completeSevenScenes(page: Page, options: { reviewPrevious?: boolean; maturity?: number; pointerCraft?: boolean } = {}) {
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  if (options.reviewPrevious) {
    await page.getByRole("button", { name: "返回上一幕" }).click();
    await expect(page.getByRole("heading", { name: "杯中起雾" })).toBeVisible();
    await page.getByRole("button", { name: "轻触茶汤" }).click();
  }
  await clearMistByDragging(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "山出现了" }).click();

  await expectNoHorizontalOverflow(page);
  await chooseBudWithKeyboard(page, "只有一枚芽");
  await expect(page.getByText("这个还嫩了点。", { exact: false })).toBeVisible();
  await expect(page.getByText("茶师傅")).toBeVisible();
  await chooseBudByLifting(page, "一芽一叶");
  await expect(page.getByText("1 / 53,000+", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "一芽一叶" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "把它带去锅边" }).click();

  await expectNoHorizontalOverflow(page);
  await clearSteamByWiping(page);
  if (options.pointerCraft) await doPointerCraft(page);
  else await doKeyboardCraft(page);
  await page.getByRole("button", { name: "去做最后的判断" }).click();

  await expectNoHorizontalOverflow(page);
  for (let step = 0; step < (options.maturity ?? 2); step += 1) await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "现在停" }).click();

  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "回到真实干茶" }).click();
  await expect(page.getByText("论文样本与商品批次无关。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "收下这一芽" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "收进茶护照" }).click();
  await expectNoHorizontalOverflow(page);
}

test("Tea Realm desktop fallback completes seven scenes and updates a replay outcome", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => { throw new Error("Microphone must remain opt-in"); } },
    });
  });

  await page.goto("/realm");
  await expect(page.getByRole("heading", { name: "从杯中这一口， 回到雾里的一芽。" })).toBeVisible();
  await page.getByRole("link", { name: "进入茶境" }).click();
  await page.getByRole("button", { name: "进入茶境" }).click();

  await completeSevenScenes(page, { reviewPrevious: true, maturity: 2, pointerCraft: true });
  await expect(page.getByRole("heading", { name: "清鲜的白毫" })).toBeVisible();
  await expect(page.getByText("这是互动体验结果，不代表真实加工批次或专业制茶能力评价。")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看茶护照" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("link", { name: "查看茶护照" }).click();
  await expect(page.getByText("茶境标本")).toBeVisible();

  await page.goto("/realm");
  await expect(page.getByText("7 / 7 幕完成")).toBeVisible();
  await page.getByRole("link", { name: "再走一遍" }).click();
  await page.getByRole("button", { name: "重新进入" }).click();
  await completeSevenScenes(page, { maturity: 4 });
  await expect(page.getByRole("heading", { name: "带火香的一芽" })).toBeVisible();
});

test("early stop produces its own valid outcome", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The three-outcome sweep runs once in Chromium");
  await page.goto("/realm/duyun-maojian-mist-bud?entry=realm");
  await page.getByRole("button", { name: "进入茶境" }).click();
  await completeSevenScenes(page, { maturity: 0 });
  await expect(page.getByRole("heading", { name: "鲜青的一芽" })).toBeVisible();
});

for (const width of [320, 430]) {
  test(`all seven scenes stay within a ${width}px viewport`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "The responsive scene sweep runs once in Chromium");
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/realm/duyun-maojian-mist-bud?entry=realm");
    await page.getByRole("button", { name: "进入茶境" }).click();
    await completeSevenScenes(page, { maturity: 2 });
    await expect(page.getByRole("heading", { name: "清鲜的白毫" })).toBeVisible();
  });
}

test("microphone analysis is opt-in and can clear steam locally", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Synthetic audio is only installed for Chromium");
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    class LocalDeviceOrientationEvent extends Event {}
    Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: LocalDeviceOrientationEvent });
    class LocalAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createAnalyser() {
        const createdAt = performance.now();
        return { fftSize: 512, getByteTimeDomainData(values: Uint8Array) { values.fill(performance.now() - createdAt > 440 ? 160 : 128); } };
      }
      createMediaStreamSource() { return { connect() {} }; }
      createOscillator() { return { frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {}, addEventListener(_name: string, callback: () => void) { setTimeout(callback, 0); } }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } }; }
      close() { this.state = "closed"; return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: LocalAudioContext });
  });
  await page.goto("/realm/duyun-maojian-mist-bud?entry=realm");
  await page.getByRole("button", { name: "进入茶境" }).click();
  await dispatchTilt(page, 0, 5);
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  await clearMistByDragging(page);
  await page.getByRole("button", { name: "山出现了" }).click();
  await chooseBudWithKeyboard(page, "一芽一叶");
  await page.getByRole("button", { name: "把它带去锅边" }).click();
  await expect(page.getByRole("button", { name: "吹开蒸汽" })).toBeVisible();
  await page.getByRole("button", { name: "吹开蒸汽" }).click();
  await expect(page.getByRole("button", { name: "制茶手势区域" })).toContainText("向前推", { timeout: 5_000 });
  for (const gamma of [35, -35, 35, -35, 35]) await dispatchTilt(page, gamma, 7);
  await expect(page.getByRole("button", { name: "制茶手势区域" })).toContainText("往复揉");
});

test("WebKit completes after direction and microphone permission denial", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "The denial journey runs once in WebKit");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => { throw new DOMException("denied", "NotAllowedError"); },
    } });
    class DeniedOrientationEvent extends Event {
      static requestPermission = async () => "denied";
    }
    Object.defineProperty(window, "DeviceOrientationEvent", { configurable: true, value: DeniedOrientationEvent });
  });
  await page.goto("/realm/duyun-maojian-mist-bud?entry=realm");
  await page.getByRole("button", { name: "进入茶境" }).click();
  await expect(page.getByText("已自动切换为拖拽操作，不影响体验。")).toBeVisible();
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  await clearMistByDragging(page);
  await page.getByRole("button", { name: "山出现了" }).click();
  await chooseBudWithKeyboard(page, "一芽一叶");
  await page.getByRole("button", { name: "把它带去锅边" }).click();
  await page.getByRole("button", { name: "吹开蒸汽" }).click();
  await expect(page.getByRole("button", { name: "左右擦开蒸汽" })).toBeVisible();
  await expect(page.getByText("没有使用麦克风，改用手指擦开蒸汽。")).toBeVisible();
  await page.getByRole("button", { name: "左右擦开蒸汽" }).press("Enter");
  await doKeyboardCraft(page);
  await page.getByRole("button", { name: "去做最后的判断" }).click();
  await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "再试一手" }).click();
  await page.getByRole("button", { name: "现在停" }).click();
  await page.getByRole("button", { name: "回到真实干茶" }).click();
  await page.getByRole("button", { name: "收下这一芽" }).click();
  await page.getByRole("button", { name: "收进茶护照" }).click();
  await expect(page.getByRole("heading", { name: "清鲜的白毫" })).toBeVisible();
});

test("reduced motion falls back cleanly and refresh restores the server-owned scene", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/realm/duyun-maojian-mist-bud?entry=realm");
  await page.getByRole("button", { name: "进入茶境" }).click();
  await expect(page.getByText("已自动切换为拖拽操作，不影响体验。")).toBeVisible();
  await page.getByRole("button", { name: "轻触茶汤" }).click();
  await expect(page.getByRole("heading", { name: "雾后是黔南的山" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "雾后是黔南的山" })).toBeVisible();
  await clearMistByDragging(page);
  await expect(page.getByRole("button", { name: "山出现了" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test("Realm home stays clear of the bottom navigation at supported widths", async ({ page }) => {
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/realm");
    await expect(page.getByRole("link", { name: /进入茶境|继续体验|再走一遍/ })).toBeVisible();
    await page.waitForTimeout(800);
    const layout = await page.evaluate(() => {
      const action = document.querySelector(".realm-home-copy a.button")?.getBoundingClientRect();
      const navigation = document.querySelector(".bottom-nav")?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        overlapsNavigation: Boolean(action && navigation && action.bottom > navigation.top && action.top < navigation.bottom),
      };
    });
    expect(layout).toEqual({ overflow: false, overlapsNavigation: false });
  }
});
