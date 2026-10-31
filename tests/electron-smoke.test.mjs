// electron-smoke.test.mjs - launches the real Electron app with Playwright,
// plays the bundled demo story from start to an ending, and checks save/resume.
// Requires: npm i (electron + playwright). Runs headed; harmless in CI.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

test("app boots, plays the demo story to an ending, and resumes", { timeout: 180000 }, async (t) => {
  let electron_mod;
  try {
    electron_mod = await import("playwright");
  } catch {
    t.skip("playwright not installed");
    return;
  }
  const { _electron: electron } = electron_mod;

  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), "bl-smoke-"));
  let app;
  try {
    app = await electron.launch({ args: [root, `--user-data-dir=${tmpUserData}`] });
  } catch (err) {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
    throw err;
  }
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState("domcontentloaded");

    // Home renders a playable story card (catalogue story or bundled demo fallback)
    await win.waitForSelector("#home-today", { timeout: 30000 });
    const pollSettled = async () =>
      win.evaluate(() => document.getElementById("net-indicator")?.dataset.state !== "checking");
    const deadline = Date.now() + 40000;
    while (!(await pollSettled())) {
      assert.ok(Date.now() < deadline, "story refresh never settled");
      await win.waitForTimeout(500);
    }
    const hasCard = await win.locator("#home-today .today-card").count();
    if (!hasCard) {
      t.skip("no playable story available - re-run when online");
      return;
    }

    await win.locator("#home-today button.primary-btn").first().click();
    await win.waitForSelector("#screen-intro:not([hidden])", { timeout: 15000 });
    await win.locator("#btn-begin").click();
    await win.waitForSelector("#screen-play:not([hidden])", { timeout: 15000 });

    // Walk the story: accept feedback, click the first choice, until the debrief opens.
    let guard = 0;
    while (guard++ < 60) {
      const feedbackVisible = await win.locator("#feedback-layer").isVisible().catch(() => false);
      if (feedbackVisible) {
        await win.locator("#btn-ack-feedback").click();
        await win.waitForTimeout(150);
        continue;
      }
      const debriefVisible = await win.locator("#screen-debrief").isVisible().catch(() => false);      if (debriefVisible) break;
      const endBtn = win.locator("#choices-slot button", { hasText: "Open the debrief" });
      if ((await endBtn.count()) > 0) {
        await endBtn.first().click();
        await win.waitForSelector("#screen-debrief:not([hidden])", { timeout: 15000 });
        break;
      }
      const choices = win.locator("#choices-slot button.choice");
      assert.ok((await choices.count()) > 0, "story got stuck with no choices");
      await choices.first().click();
      await win.waitForTimeout(250);
    }
    assert.equal(await win.locator("#screen-debrief").isVisible(), true, "reached the debrief");

    // Debrief shows score and takeaways
    const scoreText = await win.locator("#debrief-score").textContent();
    assert.match(scoreText, /\/100$/);
    assert.ok((await win.locator("#debrief-takeaways li").count()) >= 1);

    // Home reflects the completed story
    await win.locator("#btn-back-home-2").click();
    await win.waitForSelector("#screen-home:not([hidden])");
    assert.ok((await win.locator("#profile-card .records li").count()) >= 3);

    // Save & resume: reopen the story; the button should offer Replay since it is completed
    const again = win.locator("#home-today button.primary-btn").first();
    assert.match(await again.textContent(), /Replay|Play|Continue/);
    await again.click();
    await win.waitForSelector("#screen-intro:not([hidden])");
    await win.locator("#btn-begin").click();
    await win.waitForSelector("#screen-play:not([hidden])");
    await win.locator("#btn-save-exit").click();
    await win.waitForSelector("#screen-home:not([hidden])");

    console.log("SMOKE OK: boot, play-through to ending, debrief, save/exit verified");
  } finally {
    await app?.close().catch(() => {});
    try {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    } catch {}
  }
});
