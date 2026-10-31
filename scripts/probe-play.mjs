import { _electron as electron } from "playwright";
const app = await electron.launch({ args: [process.argv[2] || "."] });
try {
  const win = await app.firstWindow();
  win.on("console", (msg) => console.log("PAGE:", msg.type(), msg.text()));
  win.on("pageerror", (err) => console.log("PAGEERROR:", err.message, err.stack?.split("\n").slice(0, 5).join(" | ")));
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(3000);
  await win.locator("#home-today button.primary-btn").first().click();
  await win.waitForTimeout(1000);
  await win.locator("#btn-begin").click();
  await win.waitForTimeout(1500);
  const state = await win.evaluate(() => ({
    choices: document.getElementById("choices-slot")?.childElementCount,
    choicesHTML: document.getElementById("choices-slot")?.innerHTML?.slice(0, 400),
  }));
  console.log(JSON.stringify(state, null, 2));
} finally {
  await app.close().catch(() => {});
}
