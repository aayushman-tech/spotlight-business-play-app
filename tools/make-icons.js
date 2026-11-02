// tools/make-icons.js - Renders build/logo.svg and build/wide-logo.svg to:
//   1. build/appx/ - Complete Microsoft Store AppX / MSIX tile asset set with all scale & targetsize variants.
//   2. build/ - icon.png (512x512) and multi-resolution icon.ico (16..256).
//   3. store/ - Partner Center Store listing images (logo 300x300, poster 720x1080, box art 1080x1080).
// Reproducible via: node tools/make-icons.js
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const root = path.join(__dirname, "..");
const svgSquarePath = path.join(root, "build", "logo.svg");
const svgWidePath = path.join(root, "build", "wide-logo.svg");

const svgSquare = fs.readFileSync(svgSquarePath, "utf8");
const svgWide = fs.existsSync(svgWidePath) ? fs.readFileSync(svgWidePath, "utf8") : svgSquare;

const appxDir = path.join(root, "build", "appx");
const storeDir = path.join(root, "store");
fs.mkdirSync(appxDir, { recursive: true });
fs.mkdirSync(storeDir, { recursive: true });

function buildIco(pngs) {
  // pngs: [{size, data}] sorted ascending. ICO format with PNG-embedded entries.
  const entries = pngs.map((p) => ({ size: p.size, data: p.data }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(entries.length, 4);
  const dirSize = 16 * entries.length;
  let offset = 6 + dirSize;
  const dir = Buffer.alloc(dirSize);
  entries.forEach((e, i) => {
    const base = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, base + 0); // width
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, base + 1); // height
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

// Full asset manifest: [destFolder, filename, width, height, useWideSvg]
const tasks = [
  // Base AppX Assets (Required by electron-builder AppX template & Windows Store)
  ["appx", "StoreLogo.png", 50, 50, false],
  ["appx", "Square44x44Logo.png", 44, 44, false],
  ["appx", "Square150x150Logo.png", 150, 150, false],
  ["appx", "Wide310x150Logo.png", 310, 150, true],
  ["appx", "Square71x71Logo.png", 71, 71, false],
  ["appx", "SmallTile.png", 71, 71, false],
  ["appx", "Square310x310Logo.png", 310, 310, false],
  ["appx", "LargeTile.png", 310, 310, false],
  ["appx", "SplashScreen.png", 620, 300, true],
  ["appx", "BadgeLogo.png", 24, 24, false],

  // StoreLogo scales
  ["appx", "StoreLogo.scale-100.png", 50, 50, false],
  ["appx", "StoreLogo.scale-125.png", 63, 63, false],
  ["appx", "StoreLogo.scale-150.png", 75, 75, false],
  ["appx", "StoreLogo.scale-200.png", 100, 100, false],
  ["appx", "StoreLogo.scale-400.png", 200, 200, false],

  // Square44x44Logo scales
  ["appx", "Square44x44Logo.scale-100.png", 44, 44, false],
  ["appx", "Square44x44Logo.scale-125.png", 55, 55, false],
  ["appx", "Square44x44Logo.scale-150.png", 66, 66, false],
  ["appx", "Square44x44Logo.scale-200.png", 88, 88, false],
  ["appx", "Square44x44Logo.scale-400.png", 176, 176, false],

  // Square44x44Logo target sizes
  ["appx", "Square44x44Logo.targetsize-16.png", 16, 16, false],
  ["appx", "Square44x44Logo.targetsize-24.png", 24, 24, false],
  ["appx", "Square44x44Logo.targetsize-32.png", 32, 32, false],
  ["appx", "Square44x44Logo.targetsize-48.png", 48, 48, false],
  ["appx", "Square44x44Logo.targetsize-256.png", 256, 256, false],

  // Square44x44Logo unplated target sizes
  ["appx", "Square44x44Logo.altform-unplated_targetsize-16.png", 16, 16, false],
  ["appx", "Square44x44Logo.altform-unplated_targetsize-24.png", 24, 24, false],
  ["appx", "Square44x44Logo.altform-unplated_targetsize-32.png", 32, 32, false],
  ["appx", "Square44x44Logo.altform-unplated_targetsize-48.png", 48, 48, false],
  ["appx", "Square44x44Logo.altform-unplated_targetsize-256.png", 256, 256, false],

  // Square150x150Logo scales
  ["appx", "Square150x150Logo.scale-100.png", 150, 150, false],
  ["appx", "Square150x150Logo.scale-125.png", 188, 188, false],
  ["appx", "Square150x150Logo.scale-150.png", 225, 225, false],
  ["appx", "Square150x150Logo.scale-200.png", 300, 300, false],
  ["appx", "Square150x150Logo.scale-400.png", 600, 600, false],

  // Wide310x150Logo scales
  ["appx", "Wide310x150Logo.scale-100.png", 310, 150, true],
  ["appx", "Wide310x150Logo.scale-125.png", 388, 188, true],
  ["appx", "Wide310x150Logo.scale-150.png", 465, 225, true],
  ["appx", "Wide310x150Logo.scale-200.png", 620, 300, true],
  ["appx", "Wide310x150Logo.scale-400.png", 1240, 600, true],

  // Square71x71Logo scales
  ["appx", "Square71x71Logo.scale-100.png", 71, 71, false],
  ["appx", "Square71x71Logo.scale-125.png", 89, 89, false],
  ["appx", "Square71x71Logo.scale-150.png", 107, 107, false],
  ["appx", "Square71x71Logo.scale-200.png", 142, 142, false],
  ["appx", "Square71x71Logo.scale-400.png", 284, 284, false],

  // Square310x310Logo scales
  ["appx", "Square310x310Logo.scale-100.png", 310, 310, false],
  ["appx", "Square310x310Logo.scale-125.png", 388, 388, false],
  ["appx", "Square310x310Logo.scale-150.png", 465, 465, false],
  ["appx", "Square310x310Logo.scale-200.png", 620, 620, false],
  ["appx", "Square310x310Logo.scale-400.png", 1240, 1240, false],

  // SplashScreen scales
  ["appx", "SplashScreen.scale-100.png", 620, 300, true],
  ["appx", "SplashScreen.scale-125.png", 775, 375, true],
  ["appx", "SplashScreen.scale-150.png", 930, 450, true],
  ["appx", "SplashScreen.scale-200.png", 1240, 600, true],
  ["appx", "SplashScreen.scale-400.png", 2480, 1200, true],

  // BadgeLogo scales
  ["appx", "BadgeLogo.scale-100.png", 24, 24, false],

  // Desktop App / EXE Icons
  ["build", "icon.png", 512, 512, false],
  ["build", "icon-256.png", 256, 256, false],
  ["build", "icon-128.png", 128, 128, false],
  ["build", "icon-64.png", 64, 64, false],
  ["build", "icon-48.png", 48, 48, false],
  ["build", "icon-32.png", 32, 32, false],
  ["build", "icon-24.png", 24, 24, false],
  ["build", "icon-16.png", 16, 16, false],

  // Store Listing Art
  ["store", "logo-300x300.png", 300, 300, false],
  ["store", "boxart-1080x1080.png", 1080, 1080, false],
  ["store", "poster-720x1080.png", 720, 1080, false],
];

const makeHtml = (svg) => `<!doctype html><html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; width: 100%; height: 100%; overflow: hidden; }
  svg { display: block; width: 100vw; height: 100vh; }
</style></head><body>${svg}</body></html>`;

async function main() {
  const playwright = await import("playwright");
  const electron = playwright._electron;

  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), "sbp-icons-"));
  const app = await electron.launch({
    args: [root, `--user-data-dir=${tmpUserData}`],
  });

  try {
    const page = await app.firstWindow();
    const icoFrames = [];

    for (const [folder, filename, w, h, isWide] of tasks) {
      const html = makeHtml(isWide ? svgWide : svgSquare);
      await page.setContent(html);
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(40);
      const buf = await page.screenshot({ type: "png", omitBackground: false });

      let targetDir;
      if (folder === "appx") targetDir = appxDir;
      else if (folder === "store") targetDir = storeDir;
      else targetDir = path.join(root, "build");

      const outPath = path.join(targetDir, filename);
      fs.writeFileSync(outPath, buf);

      // Collect ICO resolutions
      if (folder === "build" && filename.startsWith("icon-")) {
        const size = parseInt(filename.replace("icon-", "").replace(".png", ""), 10);
        icoFrames.push({ size, data: buf });
      }
    }

    // Build multi-res icon.ico
    icoFrames.sort((a, b) => a.size - b.size);
    const icoBuf = buildIco(icoFrames);
    fs.writeFileSync(path.join(root, "build", "icon.ico"), icoBuf);

    console.log(`Successfully generated:`);
    console.log(`  - ${tasks.filter((t) => t[0] === "appx").length} AppX assets in build/appx/`);
    console.log(`  - build/icon.png (512x512) and build/icon.ico (${icoFrames.map((f) => f.size).join(",")}px)`);
    console.log(`  - Partner Center Store assets in store/ (logo, boxart, poster)`);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
