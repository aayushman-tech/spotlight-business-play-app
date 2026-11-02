// electron-smoke.test.mjs - End-to-end smoke test for Spotlight Business Play using Playwright & Electron.
// Tests launch, home screen, 90s choose-your-path gameplay, win/lose endings, settings, and captures screenshots.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const screenshotsDir = path.join(root, "store", "screenshots");

test("Spotlight Business Play: boots, plays gamebook, verifies win/lose, takes screenshots", { timeout: 180000 }, async (t) => {
  let electron_mod;
  try {
    electron_mod = await import("playwright");
  } catch {
    t.skip("playwright not installed");
    return;
  }
  const { _electron: electron } = electron_mod;

  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), "sbp-smoke-"));
  let app;
  try {
    app = await electron.launch({
      args: [root, `--user-data-dir=${tmpUserData}`],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: "true" },
    });
  } catch (err) {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
    throw err;
  }

  try {
    const win = await app.firstWindow();
    await win.setViewportSize({ width: 1366, height: 768 });
    await win.waitForLoadState("domcontentloaded");

    // 1. Home screen verification
    await win.waitForSelector(".story-card", { timeout: 30000 });
    const brandText = await win.locator(".brand-name").textContent();
    assert.match(brandText, /SPOTLIGHT BUSINESS PLAY/i);

    const storyCards = win.locator(".story-card");
    const count = await storyCards.count();
    assert.ok(count >= 1, "At least one story available");

    // Capture screenshot: 01-home.png
    fs.mkdirSync(screenshotsDir, { recursive: true });
    await win.screenshot({ path: path.join(screenshotsDir, "01-home.png") });

    // 2. Settings verification
    await win.locator("#btn-settings").click();
    await win.waitForSelector("#screen-settings:not([hidden])");
    await win.screenshot({ path: path.join(screenshotsDir, "05-settings.png") });
    await win.locator("#btn-settings-close").click();
    await win.waitForSelector("#screen-home:not([hidden])");

    // 3. Play story: trigger lose branch first to verify GAME OVER screen
    await storyCards.first().click();
    await win.waitForSelector("#screen-play:not([hidden])");
    await win.screenshot({ path: path.join(screenshotsDir, "02-play.png") });

    // Click choice B (bad choice on scene 1)
    const badChoice = win.locator(".choice-btn").nth(1);
    await badChoice.click();
    // Choice on s002 leads to lose ending
    await win.waitForSelector(".choice-btn", { timeout: 5000 });
    await win.locator(".choice-btn").first().click();

    // Verify LOSE screen
    await win.waitForSelector("#screen-lose:not([hidden])", { timeout: 10000 });
    const loseReason = await win.locator("#lose-reason").textContent();
    assert.ok(loseReason.length > 10, "Lose reason must be displayed");
    await win.screenshot({ path: path.join(screenshotsDir, "03-game-over.png") });

    // Click Start Over ↻ to restart from scene 1
    await win.locator("#btn-lose-restart").click();
    await win.waitForSelector("#screen-play:not([hidden])");

    // 4. Walk the winning spine to the end (34 steps)
    let steps = 0;
    while (steps++ < 50) {
      const isWin = await win.locator("#screen-win:not([hidden])").count();
      if (isWin > 0) break;

      const choices = win.locator(".choice-btn");
      if ((await choices.count()) === 0) break;

      // Always pick choice A (winning spine)
      await choices.first().click();
      await win.waitForTimeout(100);
    }

    // Verify WIN screen
    await win.waitForSelector("#screen-win:not([hidden])", { timeout: 15000 });
    const winTitle = await win.locator("#win-title").textContent();
    assert.ok(winTitle.length > 0, "Win title must be shown");
    const takeaways = await win.locator("#win-takeaways li").count();
    assert.ok(takeaways >= 3, "Takeaways principles must be shown");
    await win.screenshot({ path: path.join(screenshotsDir, "04-win.png") });

    // Return to home
    await win.locator("#btn-win-home").click();
    await win.waitForSelector("#screen-home:not([hidden])");

    // Verify ✓ Completed tag is now shown on the story card
    const completedTag = await win.locator(".badge-completed").count();
    assert.ok(completedTag >= 1, "Completed badge should appear on finished story");

    console.log("SMOKE TEST PASSED: Full gamebook flow, win/lose, screenshots generated.");
  } finally {
    await app?.close().catch(() => {});
    try {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    } catch {}
  }
});
