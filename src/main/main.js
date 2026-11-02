// main.js - Spotlight Business Play main process. The ONLY place with network access.
"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const https = require("node:https");

const config = require("../config.js");
const schema = require("../engine/story.schema.json");

// Story validation lives in an ESM module; import it once main is async.
let engineModules = null;
async function loadEngineModules() {
  if (!engineModules) {
    engineModules = {
      validator: await import("../engine/story-validator.mjs"),
    };
  }
  return engineModules;
}

// ---------- persistent JSON store ----------
const userDir = () => app.getPath("userData");
function storePath(rel) {
  return path.join(userDir(), rel);
}
async function readJson(rel, fallback) {
  try {
    return JSON.parse(await fsp.readFile(storePath(rel), "utf8"));
  } catch {
    return fallback;
  }
}
async function writeJson(rel, value) {
  const file = storePath(rel);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(value, null, 1), "utf8");
  await fsp.rm(file, { force: true });
  await fsp.rename(tmp, file);
}

// ---------- network (main process only, raw.githubusercontent.com only) ----------
const RAW_HOST = "raw.githubusercontent.com";
function storiesBaseUrl() {
  const { owner, repo, branch } = config.stories;
  return `https://${RAW_HOST}/${owner}/${repo}/${branch}`;
}

async function fetchRawText(urlPath, timeoutMs) {
  const cb = config.fetch.cacheBusting
    ? `${urlPath.includes("?") ? "&" : "?"}cb=${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    : "";
  const url = `${storiesBaseUrl()}/${urlPath}${cb}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "SpotlightBusinessPlay/1.1.0 (+stories sync)", Accept: "application/json" } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${urlPath}`));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", (e) => reject(e));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`network timeout after ${timeoutMs}ms`));
    });
  });
}

// Validated story objects cache
const validStoryCache = new Map();

async function checkStoryFile(entry, timeoutMs) {
  // returns { status, story? } with status ok | hash_mismatch | schema_invalid | unreachable
  let text;
  try {
    text = await fetchRawText(entry.file, timeoutMs);
  } catch {
    return { status: "unreachable" };
  }
  const storyRel = path.join(config.storage.storyDir, path.basename(entry.file));
  const sha = crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
  if (entry.sha256 && sha !== entry.sha256) {
    return { status: "hash_mismatch" };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: "schema_invalid" };
  }
  const { validator } = await loadEngineModules();
  const result = validator.validateStory(data, { allowShort: true, schema });
  if (!result.ok) {
    return { status: "schema_invalid" };
  }
  try {
    await writeJson(storyRel, data);
  } catch {
    /* cache write failure is not fatal */
  }
  return { status: "ok", story: data };
}

async function loadCachedStory(relPath) {
  const data = await readJson(relPath, null);
  if (!data) return null;
  const { validator } = await loadEngineModules();
  const result = validator.validateStory(data, { allowShort: true, schema });
  return result.ok ? data : null;
}

// "refresh" IPC: returns a manifest view for the renderer.
async function refreshStories({ online = true } = {}) {
  const timeoutMs = config.fetch.timeoutMs;
  let manifestText = null;
  let usedNetwork = false;

  if (online) {
    try {
      manifestText = await fetchRawText("index.json", timeoutMs);
      usedNetwork = true;
      await writeJson(config.storage.manifest, JSON.parse(manifestText));
    } catch {
      manifestText = null;
    }
  }

  let manifest = null;
  if (manifestText) {
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      manifest = null;
    }
  }
  if (!manifest) {
    manifest = await readJson(config.storage.manifest, null);
  }

  if (!manifest || manifest.schemaVersion !== 2 || !Array.isArray(manifest.stories)) {
    // No network manifest and no cache: fall back to the bundled default story so first launch always works.
    const demoEntry = await buildDemoFallbackEntry();
    return {
      offline: true,
      error: !demoEntry,
      fallBackToDemo: !!demoEntry,
      minAppVersion: null,
      storyStatus: {},
      stories: demoEntry ? [demoEntry] : [],
    };
  }

  // Check every story (hash + schema) in parallel
  const statuses = {};
  const results = await Promise.allSettled(
    manifest.stories.map(async (entry) => {
      const check = await checkStoryFile(entry, timeoutMs);
      return [entry.id, check];
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") statuses[r.value[0]] = r.value[1];
    else statuses.collapsed = true;
  }
  const storyStatus = {};
  for (const [id, check] of Object.entries(statuses)) {
    if (check && check.status !== "ok") {
      storyStatus[id] = ["hash_mismatch", "schema_invalid", "missing"].includes(check.status)
        ? check.status
        : "unreachable";
    }
  }
  // When offline, fall back to cached story files
  if (!usedNetwork) {
    for (const entry of manifest.stories) {
      if (storyStatus[entry.id] && storyStatus[entry.id] !== "ok") continue;
      const story = await loadCachedStory(
        path.join(config.storage.storyDir, path.basename(entry.file))
      );
      if (story) {
        validStoryCache.set(entry.id, story);
        storyStatus[entry.id] = "ok";
      } else {
        // Also check if it matches the bundled default story
        const bundled = await buildDemoFallbackEntry();
        if (bundled && bundled.id === entry.id) {
          storyStatus[entry.id] = "ok";
        } else {
          storyStatus[entry.id] = "unreachable";
        }
      }
    }
  }

  const demoEntry = manifest.stories.length === 0 ? await buildDemoFallbackEntry() : null;
  return {
    offline: !usedNetwork,
    error: false,
    fallBackToDemo: !!demoEntry,
    manifestIssues: [],
    minAppVersion: manifest.minAppVersion,
    storyStatus,
    stories: demoEntry ? [demoEntry] : manifest.stories,
  };
}

// Builds a fallback entry from the bundled default story, so the app always has something playable
// (first launch, offline with no cache, or an empty catalogue).
async function buildDemoFallbackEntry() {
  const demoPath = path.join(__dirname, "..", "..", config.bundledDemoPath);
  let demo;
  try {
    demo = JSON.parse(fs.readFileSync(demoPath, "utf8"));
  } catch {
    return null;
  }
  const { validator } = await loadEngineModules();
  const result = validator.validateStory(demo, { allowShort: true, schema });
  if (!result.ok) return null;
  validStoryCache.set(demo.id, demo);
  return {
    id: demo.id,
    title: demo.title,
    subtitle: demo.subtitle,
    publishDate: demo.publishDate,
    estimatedMinutes: result.metrics?.estimatedMinutes ?? 35,
    difficulty: demo.difficulty,
    tags: demo.tags,
    file: config.bundledDemoPath,
    sha256: null,
    isDemoFallback: true,
  };
}

// IPC surface
function registerIpc() {
  ipcMain.handle("app:info", () => ({
    version: app.getVersion(),
    gameTitle: config.gameTitle,
    electron: process.versions.electron,
  }));
  ipcMain.handle("stories:refresh", async (_e, { online = true } = {}) => refreshStories({ online }));
  ipcMain.handle("story:load", async (_e, storyId) => {
    if (validStoryCache.has(storyId)) return validStoryCache.get(storyId);
    // Try bundled default story
    const bundled = await buildDemoFallbackEntry();
    if (bundled && bundled.id === storyId && validStoryCache.has(storyId)) {
      return validStoryCache.get(storyId);
    }
    // Try cache directly
    const story = await loadCachedStory(path.join(config.storage.storyDir, `${storyId}.json`));
    if (story) validStoryCache.set(storyId, story);
    return story || null;
  });
  ipcMain.handle("progress:load", () => readJson(config.storage.progress, { completed: [], inProgress: {} }));
  ipcMain.handle("progress:save", (_e, progress) => writeJson(config.storage.progress, progress));
  ipcMain.handle("settings:load", () => readJson(config.storage.settings, { theme: "system", fontSize: "medium" }));
  ipcMain.handle("settings:save", (_e, settings) => writeJson(config.storage.settings, settings));
  ipcMain.handle("config:get", () => ({
    stories: config.stories,
    rawIndexUrl: `${storiesBaseUrl()}/index.json`,
  }));
  ipcMain.handle("shell:openExternal", (_e, url) => {
    if (typeof url !== "string") return false;
    const allowed = config.externalUrlAllowList.some((glob) => {
      const re = new RegExp(
        "^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, "[^.]*") + "$"
      );
      return re.test(url);
    });
    if (!allowed) return false;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") return false;
      shell.openExternal(url);
      return true;
    } catch {
      return false;
    }
  });
}

// ---------- window ----------
function createWindow() {
  const iconPath = path.join(__dirname, "..", "..", "build", "icon.png");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#0e172e",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  // Hard network deny in the renderer (belt & braces with CSP meta).
  win.webContents.session.webRequest.onBeforeRequest(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const isLocal = details.url.startsWith("file://") || details.url.startsWith("devtools:");
      callback({ cancel: !isLocal });
    }
  );
  // Any navigation away from the app is blocked; external links go through the allow-list.
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(async () => {
    await loadEngineModules();
    registerIpc();
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
