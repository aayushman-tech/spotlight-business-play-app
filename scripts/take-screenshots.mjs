// scripts/take-screenshots.js - launches the real Electron app, walks the UI,
// takes Store screenshots into store/screenshots/ (1366x768 or larger).
// Also serves as a functional smoke check that the app boots and plays a story.
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const { _electron: electron } = await import("playwright");

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), "bl-screen-"));
const app = await electron.launch({
  args: [root, `--user-data-dir=${tmpUserData}`],
});

try {
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 900 });
  await win.waitForLoadState("domcontentloaded");

  // Home screen (wait until the today-card has rendered)
  await win.waitForSelector("#home-today .today-card, #home-today .card-loading", { timeout: 20000 });
  await win.waitForTimeout(1200);
  await win.screenshot({ path: path.join(outDir, "01-home.png") });

  // Open the story (demo fallback or today's story)
  const playBtn = win.locator("#home-today button.primary-btn").first();
  await playBtn.click({ timeout: 10000 });
  await win.waitForSelector("#screen-intro:not([hidden])");
  await win.screenshot({ path: path.join(outDir, "02-intro.png") });

  await win.locator("#btn-begin").click();
  await win.waitForSelector("#screen-play:not([hidden])");
  await win.waitForSelector("#arrival-slot .arrival", { timeout: 10000 });
  await win.waitForTimeout(900);
  await win.screenshot({ path: path.join(outDir, "03-play.png") });

  // Make one choice, look at feedback
  await win.locator("#choices-slot button").first().click();
  await win.waitForSelector("#feedback-layer", { state: "visible", timeout: 10000 });
  await win.screenshot({ path: path.join(outDir, "04-feedback.png") });
  await win.locator("#btn-ack-feedback").click();

  // Settings
  await win.locator("#btn-save-exit").click();
  await win.waitForSelector("#screen-home:not([hidden])");
  await win.locator("#btn-settings").click();
  await win.waitForSelector("#screen-settings:not([hidden])");
  await win.screenshot({ path: path.join(outDir, "05-settings.png") });

  console.log("SMOKE OK: app launched, story opened, choice made, screens captured");
} finally {
  await app?.close().catch(() => {});
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch {}
}
