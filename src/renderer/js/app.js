// app.js - Spotlight Business Play renderer controller.
// Pure 90s choose-your-path adventure: immediate scene transitions, no scoring HUD, clean autosave.
"use strict";

import {
  emptyState,
  choose,
  visibleChoices,
  restartStory,
} from "../../engine/engine.mjs";
import { compileManifest } from "../../engine/manifest.mjs";
import { renderExhibit } from "./charts.js";

const $ = (id) => document.getElementById(id);
const api = window.spotlight;

const app = {
  progress: { completed: [], inProgress: {} },
  settings: { theme: "system", textsize: 3 },
  manifestData: null,
  compiledView: null,
  story: null,
  state: null,
  appInfo: null,
  lastFocusCheck: Date.now(),
};

// ---------------- Helpers ----------------

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    t.hidden = true;
  }, 3000);
}

function showScreen(name) {
  for (const s of document.querySelectorAll(".screen")) {
    s.hidden = true;
  }
  const target = $("screen-" + name);
  if (target) {
    target.hidden = false;
  }
  window.scrollTo(0, 0);
}

// ---------------- Settings ----------------

async function loadSettings() {
  try {
    const saved = await api.loadSettings();
    if (saved) app.settings = { ...app.settings, ...saved };
  } catch {
    /* defaults */
  }
  applySettings();
}

function applySettings() {
  const root = document.documentElement;
  const size = app.settings.textsize ?? 3;
  root.dataset.textsize = String(size);
  $("textsize-value").textContent = String(size);

  if (app.settings.theme === "light" || app.settings.theme === "dark") {
    root.dataset.theme = app.settings.theme;
    $("set-theme").value = app.settings.theme;
  } else {
    delete root.dataset.theme;
    $("set-theme").value = "system";
  }
}

function saveSettings() {
  api.saveSettings(app.settings).catch(() => {});
}

// ---------------- Progress ----------------

async function loadProgress() {
  try {
    const p = await api.loadProgress();
    if (p && typeof p === "object") {
      app.progress = {
        completed: Array.isArray(p.completed) ? p.completed : [],
        inProgress: p.inProgress && typeof p.inProgress === "object" ? p.inProgress : {},
      };
    }
  } catch {
    app.progress = { completed: [], inProgress: {} };
  }
}

function saveProgress() {
  api.saveProgress(app.progress).catch(() => {});
}

// ---------------- Stories & Manifest ----------------

async function refreshStories(online = true) {
  const netLabel = $("net-label");
  const netIndicator = $("net-indicator");

  try {
    const res = await api.refreshStories({ online });
    app.manifestData = res;

    if (res.offline) {
      netLabel.textContent = "Offline – showing saved stories";
      netIndicator.classList.add("offline");
    } else {
      netLabel.textContent = "Online – up to date";
      netIndicator.classList.remove("offline");
    }

    const appVersion = app.appInfo?.version || "1.1.0";
    app.compiledView = compileManifest(
      {
        schemaVersion: 2,
        minAppVersion: res.minAppVersion,
        stories: res.stories || [],
      },
      {
        appVersion,
        localDate: new Date(),
        storyStatus: res.storyStatus || {},
      }
    );
  } catch {
    netLabel.textContent = "Offline – showing saved stories";
    netIndicator.classList.add("offline");
  }

  renderHome();
}

// ---------------- Home Screen ----------------

function renderHome() {
  const list = $("stories-list");
  list.replaceChildren();

  const stories = app.compiledView?.playable || app.manifestData?.stories || [];

  if (stories.length === 0) {
    const emptyCard = el("div", "story-card story-empty");
    emptyCard.appendChild(el("p", "muted", "No stories available. Check back soon."));
    list.appendChild(emptyCard);
    return;
  }

  stories.forEach((story, idx) => {
    const isCompleted = app.progress.completed.includes(story.id);
    const inProg = app.progress.inProgress[story.id];
    const isNew = !isCompleted && !inProg;

    const row = el("div", "story-card");
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", `${story.title}. ${isCompleted ? "Completed." : ""}`);

    // Left number
    const num = el("div", "story-num", String(idx + 1));
    row.appendChild(num);

    // Center info
    const info = el("div", "story-info");
    const titleRow = el("div", "story-title-row");
    titleRow.appendChild(el("h2", "story-title", story.title));

    if (isCompleted) {
      const tag = el("span", "badge badge-completed", "✓ Completed");
      titleRow.appendChild(tag);
    } else if (isNew) {
      const tag = el("span", "badge badge-new", "NEW");
      titleRow.appendChild(tag);
    }
    info.appendChild(titleRow);

    const estMin = story.estimatedMinutes ? `about ${story.estimatedMinutes} min` : "about 35 min";
    const subText = story.subtitle ? `${story.subtitle} • ${estMin}` : estMin;
    info.appendChild(el("p", "story-sub", subText));
    row.appendChild(info);

    // Right Play button
    const action = el("div", "story-action");
    const playBtn = el(
      "button",
      "play-btn" + (inProg ? " continue" : ""),
      inProg ? "Continue ▶" : "PLAY ▶"
    );
    playBtn.setAttribute("tabindex", "-1"); // row is clickable
    action.appendChild(playBtn);
    row.appendChild(action);

    // Click handler
    row.addEventListener("click", () => startOrResumeStory(story.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startOrResumeStory(story.id);
      }
    });

    list.appendChild(row);
  });
}

// ---------------- Gameplay ----------------

async function startOrResumeStory(storyId) {
  try {
    const story = await api.loadStory(storyId);
    if (!story) {
      showToast("Unable to load story.");
      return;
    }

    app.story = story;

    const inProg = app.progress.inProgress[storyId];
    if (inProg && inProg.currentSceneId && story.scenes[inProg.currentSceneId]) {
      const scene = story.scenes[inProg.currentSceneId];
      if (scene.ending) {
        // If left on an ending screen, start fresh
        delete app.progress.inProgress[storyId];
        saveProgress();
        app.state = emptyState(story);
      } else {
        app.state = {
          version: 2,
          storyId: story.id,
          sceneId: inProg.currentSceneId,
          flags: inProg.flags || {},
          visited: [inProg.currentSceneId],
          finished: false,
          endingKind: null,
          ending: null,
        };
      }
    } else {
      app.state = emptyState(story);
    }

    showScreen("play");
    renderCurrentScene();
  } catch (err) {
    showToast("Error loading story: " + err.message);
  }
}

function renderCurrentScene() {
  const scene = app.story.scenes[app.state.sceneId];
  if (!scene) {
    showToast("Scene not found.");
    showScreen("home");
    return;
  }

  // Check if this is an ending scene
  if (scene.ending) {
    handleEnding(scene.ending);
    return;
  }

  // Regular scene rendering
  $("chapter-marker").textContent = scene.chapter || "";
  $("scene-title").textContent = scene.title || "";

  // Arrival card
  const arrivalSlot = $("arrival-slot");
  arrivalSlot.replaceChildren();
  if (scene.arrival && scene.arrival.body) {
    const card = el("div", "arrival-card");
    if (scene.arrival.type) {
      card.appendChild(el("div", "arrival-tag", scene.arrival.type.toUpperCase()));
    }
    card.appendChild(el("div", "arrival-body", scene.arrival.body));
    arrivalSlot.appendChild(card);
  }

  // Exhibits
  const exhibitsSlot = $("exhibits-slot");
  exhibitsSlot.replaceChildren();
  if (Array.isArray(scene.exhibits) && scene.exhibits.length > 0) {
    for (const ex of scene.exhibits) {
      const rendered = renderExhibit(ex);
      if (rendered) exhibitsSlot.appendChild(rendered);
    }
  }

  // Narration
  const narrationSlot = $("narration-slot");
  narrationSlot.replaceChildren();
  if (scene.narration) {
    const paragraphs = String(scene.narration).split(/\n\n+/);
    for (const p of paragraphs) {
      if (p.trim()) {
        narrationSlot.appendChild(el("p", "narration-p", p.trim()));
      }
    }
  }

  // Choices
  const choicesSlot = $("choices-slot");
  choicesSlot.replaceChildren();

  const choices = visibleChoices(app.state, app.story);
  const keyLabels = ["A", "B", "C", "D"];

  choices.forEach((choice, idx) => {
    const btn = el("button", "choice-btn");
    btn.dataset.choiceId = choice.id;
    btn.dataset.key = keyLabels[idx] || String(idx + 1);

    const keyBadge = el("span", "choice-key", keyLabels[idx] || String(idx + 1));
    const textSpan = el("span", "choice-text", choice.text);

    btn.appendChild(keyBadge);
    btn.appendChild(textSpan);

    btn.addEventListener("click", () => {
      onSelectChoice(choice.id);
    });

    choicesSlot.appendChild(btn);
  });

  window.scrollTo(0, 0);
}

function onSelectChoice(choiceId) {
  const result = choose(app.state, app.story, choiceId);
  if (!result) return;

  if (result.kind === "ending") {
    handleEnding(result.ending);
  } else {
    // Autosave in-progress state
    app.progress.inProgress[app.story.id] = {
      currentSceneId: app.state.sceneId,
      flags: app.state.flags,
    };
    saveProgress();
    renderCurrentScene();
  }
}

function handleEnding(ending) {
  if (ending.kind === "win") {
    // Mark completed
    if (!app.progress.completed.includes(app.story.id)) {
      app.progress.completed.push(app.story.id);
    }
    delete app.progress.inProgress[app.story.id];
    saveProgress();

    // Render Win Screen
    $("win-title").textContent = ending.title || "Victory";
    $("win-summary").textContent = ending.summary || "";

    const takeawaysList = $("win-takeaways");
    takeawaysList.replaceChildren();
    const items = ending.takeaways || app.story.lessons || (ending.lesson ? [ending.lesson] : []);
    for (const t of items) {
      takeawaysList.appendChild(el("li", "takeaway-item", t));
    }

    showScreen("win");
  } else {
    // Game Over (Lose ending)
    // Clear in-progress so next launch starts fresh
    delete app.progress.inProgress[app.story.id];
    saveProgress();

    $("lose-title").textContent = ending.title || "Game Over";
    $("lose-summary").textContent = ending.summary || "";
    $("lose-reason").textContent = ending.reason || "A flawed business assumption proved fatal.";

    showScreen("lose");
  }
}

function restartCurrentStory() {
  if (!app.story) return;
  delete app.progress.inProgress[app.story.id];
  saveProgress();
  app.state = emptyState(app.story);
  showScreen("play");
  renderCurrentScene();
}

// ---------------- Event Listeners ----------------

function setupEvents() {
  // Topbar
  $("btn-settings").addEventListener("click", () => showScreen("settings"));

  // Settings
  $("btn-settings-close").addEventListener("click", () => showScreen("home"));
  $("btn-settings-back").addEventListener("click", () => showScreen("home"));

  $("set-theme").addEventListener("change", (e) => {
    app.settings.theme = e.target.value;
    applySettings();
    saveSettings();
  });

  $("btn-font-smaller").addEventListener("click", () => {
    const cur = app.settings.textsize ?? 3;
    if (cur > 1) {
      app.settings.textsize = cur - 1;
      applySettings();
      saveSettings();
    }
  });

  $("btn-font-larger").addEventListener("click", () => {
    const cur = app.settings.textsize ?? 3;
    if (cur < 5) {
      app.settings.textsize = cur + 1;
      applySettings();
      saveSettings();
    }
  });

  $("btn-check-stories").addEventListener("click", async () => {
    showToast("Checking GitHub for new stories…");
    await refreshStories(true);
    showToast("Story list updated.");
  });

  $("btn-reset-progress").addEventListener("click", () => {
    const ok = window.confirm(
      "Reset all saved progress and completed stories? This cannot be undone."
    );
    if (ok) {
      app.progress = { completed: [], inProgress: {} };
      saveProgress();
      renderHome();
      showToast("All progress reset.");
    }
  });

  $("link-privacy").addEventListener("click", (e) => {
    e.preventDefault();
    api.openExternal("https://aayushman-tech.github.io/spotlight-business-play-app/");
  });

  // Play Screen Actions
  $("btn-back-home").addEventListener("click", () => {
    if (app.state && !app.state.finished && app.story) {
      app.progress.inProgress[app.story.id] = {
        currentSceneId: app.state.sceneId,
        flags: app.state.flags,
      };
      saveProgress();
    }
    showScreen("home");
    renderHome();
  });

  $("btn-restart-story").addEventListener("click", () => {
    const ok = window.confirm("Restart this story from Scene 1?");
    if (ok) {
      restartCurrentStory();
    }
  });

  // Win Screen Actions
  $("btn-win-replay").addEventListener("click", () => {
    restartCurrentStory();
  });

  $("btn-win-home").addEventListener("click", () => {
    showScreen("home");
    renderHome();
  });

  // Lose Screen Actions
  $("btn-lose-restart").addEventListener("click", () => {
    restartCurrentStory();
  });

  $("btn-lose-home").addEventListener("click", () => {
    showScreen("home");
    renderHome();
  });

  // Keyboard navigation
  window.addEventListener("keydown", (e) => {
    // If typing in input, ignore
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    if (e.key === "Escape") {
      const activeScreen = document.querySelector(".screen:not([hidden])");
      if (activeScreen && activeScreen.id === "screen-settings") {
        showScreen("home");
      }
      return;
    }

    // Play screen choice shortcuts
    const playScreen = $("screen-play");
    if (!playScreen.hidden) {
      const key = e.key.toUpperCase();
      let index = -1;
      if (key === "1" || key === "A") index = 0;
      else if (key === "2" || key === "B") index = 1;
      else if (key === "3" || key === "C") index = 2;
      else if (key === "4" || key === "D") index = 3;

      if (index >= 0) {
        const choiceBtns = document.querySelectorAll(".choice-btn");
        if (choiceBtns[index]) {
          e.preventDefault();
          choiceBtns[index].click();
        }
      }
    }
  });

  // Window focus auto-refresh (after 10+ minutes)
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  window.addEventListener("focus", () => {
    const now = Date.now();
    if (now - app.lastFocusCheck > TEN_MINUTES_MS) {
      app.lastFocusCheck = now;
      refreshStories(true);
    }
  });
}

// ---------------- Init ----------------

async function init() {
  try {
    app.appInfo = await api.appInfo();
    if (app.appInfo) {
      $("about-version").textContent = `Version ${app.appInfo.version}`;
    }
  } catch {
    $("about-version").textContent = "Version 1.1.0";
  }

  setupEvents();
  await loadSettings();
  await loadProgress();
  showScreen("home");
  await refreshStories(true);
}

document.addEventListener("DOMContentLoaded", init);
