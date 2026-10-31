const { _electron: electron } = await import("playwright");
const app = await electron.launch({ args: [process.argv[2] || "."] });
try {
  const win = await app.firstWindow();
  win.on("console", (msg) => console.log("PAGE:", msg.type(), msg.text()));
  win.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
  win.on("requestfailed", (req) => console.log("REQFAIL:", req.url(), req.failure()?.errorText));
  win.on("requestfinished", (req) => { if (!req.url().startsWith("file")) console.log("REQ:", req.url()); });
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(4000);
} finally {
  await app.close().catch(() => {});
}
