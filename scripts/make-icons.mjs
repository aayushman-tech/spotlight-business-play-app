// make-icons.mjs - renders build/logo.svg to every icon/asset size the Windows
// Store and electron-builder need, and packs build/icon.ico (PNG-embedded entries).
// Dev tooling only: outputs are committed so CI does not need to run this.
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "build", "logo.svg");
const svg = fs.readFileSync(svgPath, "utf8");

const storeDir = path.join(root, "build", "store");
fs.mkdirSync(storeDir, { recursive: true });

// (name, width, height); mirrors Microsoft's tile asset guidelines.
const assets = [];
for (const ts of [16, 24, 30, 36, 48, 60, 72, 96, 256]) {
  assets.push([`Square44x44Logo.targetsize-${ts}.png`, ts, ts]);
}
for (const s of [56, 66, 75, 88, 110, 132, 176, 250]) {
  assets.push([`Square44x44Logo.scale-${Math.round((s / 44) * 100)}.png`, s, s]);
}
for (const [name, w, h] of [
  ["Square150x150Logo.scale-100.png", 150, 150],
  ["Square150x150Logo.scale-125.png", 188, 188],
  ["Square150x150Logo.scale-150.png", 225, 225],
  ["Square150x150Logo.scale-200.png", 300, 300],
  ["Square310x310Logo.scale-100.png", 310, 310],
  ["Wide310x150Logo.scale-100.png", 310, 150],
  ["StoreLogo.scale-100.png", 50, 50],
  ["StoreLogo.scale-200.png", 100, 100],
  ["SplashScreen.scale-100.png", 620, 300],
  ["icon.png", 512, 512],
  ["icon-256.png", 256, 256],
  ["icon-128.png", 128, 128],
  ["icon-64.png", 64, 64],
  ["icon-48.png", 48, 48],
  ["icon-32.png", 32, 32],
  ["icon-16.png", 16, 16],
]) {
  assets.push([name, w, h]);
}

const html = `<!doctype html><html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; width: 100%; height: 100%; overflow: hidden; }
  svg { display: block; width: 100vw; height: 100vh; }
</style></head><body>${svg}</body></html>`;

function buildIco(pngs) {
  // pngs: [{size, data}] sorted ascending. ICO format with PNG-embedded entries.
  const entries = pngs.map((p) => ({ size: p.size, data: p.data }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dirSize = 16 * entries.length;
  let offset = 6 + dirSize;
  const dir = Buffer.alloc(dirSize);
  entries.forEach((e, i) => {
    const base = i * 16;
    dir.writeUInt8(e.size === 256 ? 0 : e.size, base + 0);
    dir.writeUInt8(e.size === 256 ? 0 : e.size, base + 1);
    dir.writeUInt8(0, base + 2); // colors
    dir.writeUInt8(0, base + 3); // reserved
    dir.writeUInt16LE(1, base + 4); // planes
    dir.writeUInt16LE(32, base + 6); // bpp
    dir.writeUInt32LE(e.data.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += e.data.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
}

const app = await electron.launch({ args: [root] });
try {
  const page = await app.firstWindow();
  await page.setContent(html);
  await page.waitForTimeout(400);
  const rendered = [];
  for (const [name, w, h] of assets) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    const buf = await page.screenshot({ type: "png", omitBackground: true });
    const dest = name === "icon.png" ? path.join(root, "build", "icon.png")
      : name.startsWith("icon-") ? path.join(root, "build", "store", name)
      : path.join(storeDir, name);
    fs.writeFileSync(dest, buf);
    if (!name.startsWith("Wide") && !name.startsWith("Splash") && !name.startsWith("Square31") && !name.startsWith("StoreLogo") && !name.startsWith("Square15")) {
      rendered.push({ size: w, data: buf });
    }
  }
  // ICO: multiples of square icons
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngs = icoSizes
    .map((s) => rendered.find((r) => r.size === s))
    .filter(Boolean)
    .sort((a, b) => a.size - b.size);
  fs.writeFileSync(path.join(root, "build", "icon.ico"), buildIco(pngs));
  console.log(`OK: ${assets.length} PNGs + icon.ico written to build/`);
} finally {
  await app.close().catch(() => {});
}
