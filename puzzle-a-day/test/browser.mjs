// Optional browser regression: see README for the Playwright Core and server setup.
import assert from "node:assert/strict";

if (!process.env.PLAYWRIGHT_CORE) throw new Error("Set PLAYWRIGHT_CORE to the absolute path of playwright-core/index.mjs");
const { chromium } = await import(process.env.PLAYWRIGHT_CORE);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: process.env.CHROME_NO_SANDBOX === "1" ? ["--no-sandbox"] : [],
});
const baseURL = process.env.PUZZLE_URL || "http://127.0.0.1:8765/puzzle-a-day/";

async function setup(page) {
  await page.goto(baseURL);
  await page.evaluate(() => {
    localStorage.removeItem("papers-united-calendar-puzzle-v2");
    localStorage.removeItem("papers-united-calendar-stats-v2");
    location.reload();
  });
  await page.waitForSelector('[data-piece="p1"]');
  await page.locator("#challenge-date").fill("2026-01-01");
  await page.locator("#challenge-date").dispatchEvent("change");
}

async function solution(page) {
  return page.evaluate(async () => {
    const [{ solve }, { PIECES }, { targetForDate }] = await Promise.all([import("./logic.js"), import("./pieces.js"), import("./board.js")]);
    return solve(PIECES, targetForDate(new Date(2026, 0, 1))).placements.find(item => item.id === "p1");
  });
}

async function preview(page) {
  return page.locator(".preview-square").evaluateAll(nodes => nodes.map(node => node.dataset.key).sort());
}

async function occupied(page) {
  return page.locator(".cell.occupied").evaluateAll(nodes => nodes.map(node => node.dataset.key).sort());
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await setup(page);
  const solved = await solution(page);
  assert.equal(solved.rotation, 0);
  const origin = page.locator(`#board [data-key="${solved.origin.x},${solved.origin.y}"]`);
  await page.locator('[data-piece="p1"]').click();
  await origin.hover();
  assert.deepEqual(await preview(page), [...solved.cells].sort());
  assert.match(await page.locator("#preview-status").innerText(), /Kan plasseres/);
  await page.locator('#board [data-key="6,6"]').hover();
  assert.match(await page.locator("#preview-status").innerText(), /Kan ikke plasseres/);
  assert.ok((await preview(page)).some(key => Number(key.split(",")[0]) > 6));
  assert.equal(await page.locator("#preview-status .preview-mini i").count(), solved.cells.length);
  await origin.hover();
  await page.locator("#rotate-cw").click();
  assert.notDeepEqual(await preview(page), [...solved.cells].sort());
  await page.locator("#rotate-ccw").click();
  assert.deepEqual(await preview(page), [...solved.cells].sort());
  await page.locator("#flip").click();
  assert.equal((await preview(page)).length, solved.cells.length);
  await page.locator("#flip").click();
  await origin.click();
  assert.deepEqual(await occupied(page), [...solved.cells].sort());
  await page.reload();
  assert.deepEqual(await occupied(page), [...solved.cells].sort());
  await page.locator("#reset").click();
  await page.locator('[data-piece="p2"]').click();
  await origin.hover();
  const beforeFlip = await preview(page);
  await page.locator("#flip").click();
  assert.notDeepEqual(await preview(page), beforeFlip);
  await page.locator("#cancel-placement").click();
  assert.equal(await page.locator(".preview-square").count(), 0);
  assert.equal((await occupied(page)).length, 0);
  await page.evaluate(() => window.scrollTo(0, 0));

  const square = page.locator('[data-piece="p1"] .piece-preview i').nth(1);
  const source = await square.boundingBox();
  const destination = await page.locator(`#board [data-key="${solved.origin.x + 1},${solved.origin.y}"]`).boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 12 });
  assert.deepEqual(await preview(page), [...solved.cells].sort());
  await page.mouse.up();
  assert.deepEqual(await occupied(page), [...solved.cells].sort());
  const before = await occupied(page);
  const placed = await page.locator(`#board [data-key="${solved.cells[1]}"]`).boundingBox();
  await page.mouse.move(placed.x + placed.width / 2, placed.y + placed.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 12 });
  await page.mouse.up();
  assert.deepEqual(await occupied(page), before);

  const move = await page.evaluate(async () => {
    const [{ isLegalPlacement }, { PIECES }, { targetForDate }] = await Promise.all([import("./logic.js"), import("./pieces.js"), import("./board.js")]);
    const targets = targetForDate(new Date(2026, 0, 1));
    for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) {
      if ((x !== 0 || y !== 1) && isLegalPlacement(PIECES[0], { x, y }, new Set(), targets, { rotation: 0 })) return { x, y };
    }
  });
  const moveCell = await page.locator(`#board [data-key="${move.x + 1},${move.y}"]`).boundingBox();
  await page.mouse.move(placed.x + placed.width / 2, placed.y + placed.height / 2);
  await page.mouse.down();
  await page.mouse.move(moveCell.x + moveCell.width / 2, moveCell.y + moveCell.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.notDeepEqual(await occupied(page), before);
  await page.locator("#undo").click();
  assert.deepEqual(await occupied(page), before);
  await page.locator("#reset").click();
  await page.locator('[data-piece="p1"]').focus();
  await page.keyboard.press("Enter");
  await origin.focus();
  assert.deepEqual(await preview(page), [...solved.cells].sort());
  await page.keyboard.press("Enter");
  assert.deepEqual(await occupied(page), [...solved.cells].sort());
  assert.deepEqual(errors, []);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  mobile.on("pageerror", error => errors.push(error.message));
  await setup(mobile);
  const mobileOrigin = mobile.locator(`#board [data-key="${solved.origin.x},${solved.origin.y}"]`);
  await mobile.locator('[data-piece="p1"]').tap();
  await mobile.locator('#board [data-key="6,5"]').tap();
  assert.match(await mobile.locator("#preview-status").innerText(), /Kan ikke plasseres/);
  assert.equal(await mobile.locator("#preview-status .preview-mini i").count(), solved.cells.length);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobileOrigin.tap();
  assert.equal((await occupied(mobile)).length, 0);
  assert.deepEqual(await preview(mobile), [...solved.cells].sort());
  await mobile.locator("#rotate-cw").tap();
  assert.notDeepEqual(await preview(mobile), [...solved.cells].sort());
  await mobile.locator("#rotate-ccw").tap();
  assert.deepEqual(await preview(mobile), [...solved.cells].sort());
  await mobileOrigin.tap();
  assert.deepEqual(await occupied(mobile), [...solved.cells].sort());
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await mobile.locator("#reset").tap();
  const touchSource = mobile.locator('[data-piece="p1"] .piece-preview i').first();
  await touchSource.scrollIntoViewIfNeeded();
  const touchBox = await touchSource.boundingBox();
  const cdp = await mobileContext.newCDPSession(mobile);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchBox.x + 5, y: touchBox.y + 5 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchBox.x + 15, y: touchBox.y - 20 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 80, y: 30 }] });
  await mobile.waitForTimeout(1400);
  const target = await mobileOrigin.boundingBox();
  assert.ok(target.y > 0 && target.y + target.height / 2 + 48 < 844);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 + 48 }] });
  await mobile.waitForTimeout(100);
  assert.deepEqual(await preview(mobile), [...solved.cells].sort());
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.deepEqual(await occupied(mobile), [...solved.cells].sort());
  const existingCell = mobile.locator(`#board [data-key="${solved.cells[0]}"]`);
  const existingBox = await existingCell.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: existingBox.x + 10, y: existingBox.y + 10 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: existingBox.x + 30, y: existingBox.y + 10 }] });
  await mobile.waitForTimeout(100);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  assert.deepEqual(await occupied(mobile), [...solved.cells].sort());
  assert.equal(await mobile.locator(".drag-ghost").count(), 0);
  assert.deepEqual(errors, []);
  console.log("Browser checks passed: preview, drag, cancellation, move, undo, keyboard, reload, touch and mobile layout.");
} finally {
  await browser.close();
}
