// app.js - renderer controller. Story text is rendered with textContent only, never innerHTML.
import {
  emptyState, choose, visibleChoices, logicScore, rankName, serialize, deserialize, practisedSkills,
} from "../../engine/engine.mjs";
import { localDateString, compileManifest, pickTodaysStory, compareVersions } from "../../engine/manifest.mjs";
import { renderExhibit } from "./charts.js";

const $ = (id) => document.getElementById(id);
const api = window.boardroom;

const app = {
  profile: null,          // { completed: {storyId: {...}}, progress: {storyId: {state, updatedAt}} }
  settings: { theme: "system", textsize: 3, reduceMotion: false },
  data: null,             // last stories:refresh result
  view: null,             // compiled manifest view
  story: null,            // currently loaded story
  entry: null,            // manifest entry of current story
  state: null,            // engine state for current story
  appInfo: null,
};

// ---------------- small helpers ----------------

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
  showToast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}

function banner(msg, tone = "info") {
  const b = $("home-banner");
  b.textContent = msg;
  b.dataset.tone = tone;
  b.hidden = false;
}

function clearBanners() {
  document.querySelectorAll("#home-banner").forEach((b) => { b.hidden = true; b.textContent = ""; });
}

function showScreen(name) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = true;
  $("screen-" + name).hidden = false;
  const panel = $("case-panel");
  panel.classList.remove("open");
  $("btn-case").setAttribute("aria-expanded", "false");
  $("btn-case").hidden = name !== "play";
  $("case-panel").hidden = name !== "play";
  window.scrollTo(0, 0);
}

function fmtStat(story, statId, v) {
  const st = (story.stats || []).find((s) => s.id === statId);
  const n = Number(v);
  if (!st) return String(v);
  switch (st.format) {
    case "currency":
      return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
    case "percent":
      return Math.round(n * 10) / 10 + "%";
    case "rating": {
      const stars = Math.max(0, Math.min(5, Math.round(n / 20)));
      return stars > 0 ? "★".repeat(stars) : "☆";
    }
    default:
      return String(Math.round(n * 10) / 10);
  }
}

// ---------------- settings ----------------

async function loadSettings() {
  try {
    app.settings = { ...app.settings, ...(await api.loadSettings()) };
  } catch { /* defaults fine */ }
  applySettings();
}

function applySettings() {
  const root = document.documentElement;
  root.dataset.textsize = String(app.settings.textsize ?? 3);
  root.dataset.motion = app.settings.reduceMotion ? "reduced" : "auto";
  if (app.settings.theme === "light" || app.settings.theme === "dark") {
    root.dataset.theme = app.settings.theme;
  } else {
    delete root.dataset.theme;
  }
}

function saveSettings() {
  api.saveSettings(app.settings).catch(() => {});
}

// ---------------- stories data ----------------

function setNetState(state, label) {
  const ind = $("net-indicator");
  ind.dataset.state = state;
  $("net-label").textContent = label;
}

async function refreshData({ online }) {
  setNetState("checking", "checking…");
  const res = await api.refreshStories({ online });
  app.data = res;
  compileView();
  setNetState(res.offline ? "offline" : "online",
    res.offline ? (res.fallBackToDemo ? "offline – demo story" : "offline – cached") : "online");
  return res;
}

function compileView() {
  const res = app.data;
  if (!res) {
    app.view = { playable: [], blocked: [], manifestIssues: [] };
    return;
  }
  app.view = compileManifest(
    { schemaVersion: 1, minAppVersion: res.minAppVersion, stories: res.stories || [] },
    {
      appVersion: app.appInfo?.version || "1.0.0",
      localDate: localDateString(new Date()),
      storyStatus: res.storyStatus || {},
    }
  );
}

// ---------------- HOME ----------------

function isDoneStory(id) {
  return !!app.profile?.completed?.[id]?.completed;
}

function todaysEntry() {
  const playable = app.view?.playable || [];
  if (playable.length === 0) return null;
  const pick = pickTodaysStory(playable, app.profile?.completed || {});
  const fallback = pick === null && playable.length > 0;
  return { pick: fallback ? playable[0] : pick, isFallback: fallback };
}

const BLOCKED_REASON_TEXT = {
  min_app_version: "needs an app update",
  hash_mismatch: "failed its integrity check",
  schema_invalid: "is not valid for this app version",
  missing: "could not be downloaded",
  unreachable: "could not be downloaded",
  not_published_yet: "unlocks on its publish date",
};

function renderHome() {
  const slot = $("home-today");
  slot.textContent = "";
  $("home-banner").hidden = true;
  $("home-banner").textContent = "";

  const issues = [];
  if (app.data?.fallBackToDemo) {
    issues.push("You're offline with no cached stories yet – the bundled demo story is ready to play. " +
      "Connect to the internet and refresh to load the real catalogue.");
  } else if (app.view?.manifestIssues?.length) {
    issues.push("The stories catalogue could not be fully verified: " + app.view.manifestIssues.join("; "));
  }

  const today = todaysEntry();
  const playable = app.view?.playable || [];

  if (playable.length === 0) {
    const card = el("div", "card card-loading");
    card.appendChild(el("p", null,
      app.data?.offline && !app.data?.fallBackToDemo
        ? "You're offline and there's nothing playable right now."
        : "No published story is available yet. Check back soon – the writers are on it."));
    card.appendChild(el("p", "muted", "Press “Look for new stories” once you're online."));
    slot.appendChild(card);
  } else {
    const entry = today.pick;
    const done = isDoneStory(entry.id);
    const progress = app.profile?.progress?.[entry.id];
    const card = el("article", "card today-card");
    card.appendChild(el("span", "today-dot", "▶"));
    if (!done) card.appendChild(el("span", "badge-new", today.isFallback ? "REPLAY" : "NEW"));
    card.appendChild(el("h2", "today-title", entry.title));
    card.appendChild(el("p", "today-subtitle", entry.subtitle));
    const tags = el("div", "today-tags");
    tags.appendChild(el("span", "pill", `~${entry.estimatedMinutes} min`));
    const diff = el("span", "pill", entry.difficulty);
    diff.dataset.diff = entry.difficulty;
    tags.appendChild(diff);
    (entry.tags || []).forEach((t) => tags.appendChild(el("span", "pill", t)));
    card.appendChild(tags);
    const actions = el("div", "intro-actions");
    const play = el("button", "primary-btn", progress && !done ? "Continue ▸" : done ? "Replay ▸" : "Play ▸");
    play.addEventListener("click", () => openStory(entry, { resume: !!(progress && !done) }));
    actions.appendChild(play);
    card.appendChild(actions);
    if (done && app.profile.completed[entry.id]?.bestScore != null) {
      card.appendChild(el("p", "dot-continue",
        `Completed · best Logic Score ${app.profile.completed[entry.id].bestScore}/100`));
    }
    slot.appendChild(card);

    // archive = every other playable story, newest first
    const archive = playable.filter((p) => p.id !== entry.id);
    const list = $("archive-list");
    list.textContent = "";
    for (const e of archive) {
      const item = el("button", "archive-item");
      item.type = "button";
      item.appendChild(el("span", "t", e.title));
      item.appendChild(el("span", "meta",
        `~${e.estimatedMinutes} min · ${e.difficulty}` + (isDoneStory(e.id) ? " · ✓ played" : "")));
      item.appendChild(el("span", "pill", "▸"));
      item.addEventListener("click", () => openStory(e, { resume: !!app.profile?.progress?.[e.id] }));
      list.appendChild(item);
    }
    $("archive-empty").hidden = archive.length > 0;
  }

  const archiveListEmpty = (app.view?.playable || []).length < 2;
  $("archive-empty").hidden = !archiveListEmpty;

  // blocked stories (future / damaged / version-gated)
  const blocked = app.view?.blocked || [];
  const listBlock = document.createElement("div");
  for (const b of blocked) {
    const row = el("div", "banner");
    row.style.marginBottom = "8px";
    row.textContent = b.reason === "min_app_version"
      ? `${b.entry.title} – Update the app to play this story.`
      : `${b.entry.title} – ${BLOCKED_REASON_TEXT[b.reason] || b.reason}.`;
    listBlock.appendChild(row);
  }
  // insert blocked banners after archive heading
  const archiveCol = document.querySelector(".archive-col");
  const existingBlocks = archiveCol.querySelectorAll(".banner");
  existingBlocks.forEach((n) => n.remove());
  if (listBlock.childElementCount) archiveCol.appendChild(listBlock);

  if (issues.length) {
    banner(issues[0], "error");
  }

  renderProfileCard();
}

function renderProfileCard() {
  const card = $("profile-card");
  card.textContent = "";
  const completions = Object.values(app.profile?.completed || {}).filter((c) => c.completed);
  const storiesCompleted = completions.length;
  const rated = completions.filter((c) => typeof c.bestScore === "number");
  const avgScore = rated.length ? Math.round(avg(rated.map((c) => c.bestScore))) : null;
  const rank = avgScore != null ? rankName(avgScore) : "–";
  const best = avgScore != null ? `${avgScore}/100` : "–";
  const streak = computeStreak(completions);

  const ul = el("ul", "records");
  for (const [k, v] of [
    ["Current rank", rank],
    ["Day streak", String(streak)],
    ["Stories completed", String(storiesCompleted)],
    ["Average Logic Score", best],
  ]) {
    const li = el("li");
    li.appendChild(el("span", null, k));
    li.appendChild(el("span", "v", v));
    ul.appendChild(li);
  }
  card.appendChild(ul);
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function computeStreak(completions) {
  const dates = new Set(
    completions.filter((c) => c.completed && c.date).map((c) => localDateString(new Date(c.date)))
  );
  if (dates.size === 0) return 0;
  let streak = 0;
  const day = 24 * 3600 * 1000;
  let cursor = new Date();
  if (!dates.has(localDateString(cursor))) cursor = new Date(cursor.getTime() - day);
  while (dates.has(localDateString(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - day);
  }
  return streak;
}

// ---------------- STORY FLOW ----------------

async function openStory(entry, { resume = false } = {}) {
  let story;
  try {
    story = await api.loadStory(entry.id);
  } catch {
    story = null;
  }
  if (!story) {
    showToast("This story could not be loaded right now.");
    return;
  }
  app.story = story;
  app.entry = entry;
  const saved = resume ? app.profile?.progress?.[story.id]?.state : null;
  try {
    app.state = saved ? deserialize(JSON.stringify(saved)) : emptyState(story);
  } catch {
    app.state = emptyState(story);
  }
  renderIntro(!!saved);
}

function renderIntro(hasSave) {
  $("intro-story-title").textContent = app.story.title;
  $("intro-story-subtitle").textContent = app.story.subtitle;
  const premise = $("intro-premise");
  premise.textContent = "";
  for (const p of app.story.premise || []) premise.appendChild(el("p", null, p));
  const chars = $("intro-characters");
  chars.textContent = "";
  for (const c of app.story.characters || []) {
    const li = el("li");
    li.appendChild(el("span", "emoji", c.emoji));
    const div = el("div");
    div.appendChild(el("span", "name", c.name));
    div.appendChild(el("p", "role", c.role));
    li.appendChild(div);
    chars.appendChild(li);
  }
  const diff = $("intro-difficulty");
  diff.textContent = app.story.difficulty;
  diff.dataset.diff = app.story.difficulty;
  $("intro-minutes").textContent = `~${app.entry?.estimatedMinutes ?? "?"} min`;
  $("intro-skills").textContent = `Skills: ${(app.story.reasoningSkills || []).join(" · ")}`;
  $("btn-continue-save").hidden = !hasSave;
  showScreen("intro");
  $("btn-begin").focus();
}

function startPlay({ resume = false } = {}) {
  if (resume) {
    const saved = app.profile?.progress?.[app.story.id]?.state;
    try {
      app.state = saved ? deserialize(JSON.stringify(saved)) : emptyState(app.story);
    } catch {
      app.state = emptyState(app.story);
    }
  } else {
    app.state = emptyState(app.story);
  }
  showScreen("play");
  renderScene({ animateArrival: true });
}

function currentScene() {
  return app.story.scenes[app.state.sceneId];
}

const ARRIVAL_LABEL = {
  email: "New email", memo: "Internal memo", phone_call: "Incoming call", chart: "Chart report",
  news_alert: "News alert", visitor: "At the door", chat_message: "Team chat", contract: "Contract",
  report: "Office report",
};
const ARRIVAL_ICON = {
  email: "✉️", memo: "📝", phone_call: "📞", chart: "📈", news_alert: "🚨",
  visitor: "🚪", chat_message: "💬", contract: "📄", report: "📋",
};

function renderScene({ animateArrival = false } = {}) {
  const scene = currentScene();
  if (!scene) {
    showToast("The story hit a broken page. Please restart it from the menu.");
    return;
  }
  document.title = `${app.story.title} – ${scene.title}`;
  $("chapter-marker").textContent = scene.chapter || "";
  renderArrival(scene, animateArrival);
  renderExhibitsOf(scene);
  renderNarrationOf(scene);
  renderChoicesOf(scene);
  renderCaseFile();
  updateHud();
  const firstChoice = $("choices-slot").querySelector("button");
  if (firstChoice && !document.querySelector(".case-panel.open")) firstChoice.focus?.();
}

function renderArrival(scene, animate) {
  const slot = $("arrival-slot");
  slot.textContent = "";
  const a = scene.arrival;
  if (!a) return;
  const card = el("div", "arrival");
  card.dataset.kind = a.type;
  const head = el("div", "arrival-head");
  head.appendChild(el("span", "arrival-icon", a.icon || ARRIVAL_ICON[a.type] || "◈"));
  const meta = el("div");
  meta.appendChild(el("div", "arrival-type", ARRIVAL_LABEL[a.type] || a.type));
  const character = (app.story.characters || []).find((c) => c.id === a.from);
  meta.appendChild(el("div", "arrival-from",
    character ? `${character.name} · ${character.role}` : a.from || ""));
  head.appendChild(meta);
  if (a.type === "phone_call" || a.type === "news_alert") head.appendChild(el("span", "arrival-ring"));
  card.appendChild(head);
  if (a.subject) card.appendChild(el("p", "arrival-subject", a.subject));
  for (const para of String(a.body).split("\n\n")) {
    card.appendChild(el("p", "arrival-body", para));
  }
  if (animate) {
    card.style.animation = "none";
    requestAnimationFrame(() => { card.style.animation = ""; });
  }
  slot.appendChild(card);
}

function renderExhibitsOf(scene) {
  const slot = $("exhibits-slot");
  slot.textContent = "";
  for (const ex of scene.exhibits || []) {
    const node = renderExhibit(ex);
    if (node) slot.appendChild(node);
  }
}

function renderNarrationOf(scene) {
  const slot = $("narration-slot");
  slot.textContent = "";
  for (const para of String(scene.narration).split("\n\n")) {
    slot.appendChild(el("p", null, para));
  }
}

function updateHud() {
  const hud = $("hud");
  hud.textContent = "";
  for (const st of app.story.stats || []) {
    const tile = el("div", "hud-stat");
    tile.appendChild(el("div", "label", st.label));
    tile.appendChild(el("div", "value", fmtStat(app.story, st.id, app.state.stats[st.id])));
    hud.appendChild(tile);
  }
}

function isEndingScene(scene) {
  return scene && scene.ending != null && typeof scene.ending === "object";
}

function renderChoicesOf(scene) {
  const slot = $("choices-slot");
  slot.textContent = "";
  if (isEndingScene(scene)) {
    const btn = el("button", "primary-btn", "Open the debrief ▸");
    btn.addEventListener("click", () => renderDebrief());
    slot.appendChild(btn);
    return;
  }
  const choices = visibleChoices(app.state, app.story);
  choices.forEach((c, i) => {
    const btn = el("button", "choice");
    btn.type = "button";
    btn.appendChild(el("span", "key", String(i + 1)));
    btn.appendChild(el("span", null, c.text));
    btn.addEventListener("click", () => onChoose(c));
    slot.appendChild(btn);
  });
  if (choices.length === 0) {
    slot.appendChild(el("p", "muted", "No options available – the story is stuck. Try “Restart story”."));
  }
}

function flashStatDeltas(deltas) {
  const hud = $("hud");
  for (const st of app.story.stats || []) {
    const d = Number(deltas[st.id]);
    if (!Math.abs(d)) continue;
    const valueEl = hud.querySelector(`.hud-stat:nth-child(${(app.story.stats.indexOf(st)) + 1}) .value`);
    if (valueEl) {
      valueEl.dataset.dir = d > 0 ? "up" : "down";
      setTimeout(() => { delete valueEl.dataset.dir; }, 1800);
    }
  }
}

async function autosave() {
  if (!app.story || !app.state) return;
  app.profile.progress = app.profile.progress || {};
  app.profile.progress[app.story.id] = {
    state: JSON.parse(serialize(app.state)),
    updatedAt: new Date().toISOString(),
  };
  api.saveProfile(app.profile).catch(() => {});
  updateCaseCount();
}

async function onChoose(choice) {
  const result = choose(app.state, app.story, choice.id);
  if (!result) return; // stale click
  updateHud();
  flashStatDeltas(result.deltas);
  await autosave();
  showFeedback(choice.feedback || "…", () => {
    if (app.state.finished) {
      showEndingScene();
    } else {
      renderScene({ animateArrival: true });
    }
  });
}

function showEndingScene() {
  // Ending scenes have an arrival + narration; show it, then the "Open the debrief" button (rendered by renderChoicesOf).
  document.title = `${app.story.title} – ${currentScene().title}`;
  $("chapter-marker").textContent = currentScene().chapter || "";
  renderArrival(currentScene(), true);
  renderExhibitsOf(currentScene());
  renderNarrationOf(currentScene());
  renderChoicesOf(currentScene());
  renderCaseFile();
  updateHud();
  $("choices-slot").querySelector("button")?.focus();
}

function showFeedback(text, then) {
  const layer = $("feedback-layer");
  $("feedback-text").textContent = text;
  layer.hidden = false;
  const ack = $("btn-ack-feedback");
  ack.focus();
  ack.onclick = () => {
    layer.hidden = true;
    then();
  };
}

// ---------------- case file ----------------

function renderCaseFile() {
  const list = $("case-list");
  list.textContent = "";
  $("case-empty").hidden = (app.state?.notes?.length || 0) > 0;
  for (const note of app.state.notes) {
    list.appendChild(el("li", null, "🧾 " + note));
  }
  updateCaseCount();
}

function updateCaseCount() {
  const n = app.state?.notes?.length || 0;
  const badge = $("case-count");
  badge.hidden = n === 0;
  badge.textContent = String(n);
}

function toggleCasePanel(force) {
  const panel = $("case-panel");
  const current = panel.classList.contains("open");
  const open = force === undefined ? !current : force;
  panel.classList.toggle("open", open);
  $("btn-case").setAttribute("aria-expanded", String(open));
}

// ---------------- debrief ----------------

function markCompleted() {
  const score = logicScore(app.state);
  app.profile.completed = app.profile.completed || {};
  const prev = app.profile.completed[app.story.id] || {};
  app.profile.completed[app.story.id] = {
    completed: true,
    date: prev.date || new Date().toISOString(),
    lastScore: score,
    bestScore: Math.max(score, prev.bestScore ?? -1),
    endingKind: app.state.endingKind,
  };
  if (app.profile.progress) delete app.profile.progress[app.story.id];
  api.saveProfile(app.profile).catch(() => {});
  return score;
}

function renderDebrief() {
  const scene = currentScene();
  const ending = scene.ending;
  const score = markCompleted();
  showScreen("debrief");
  const kindEl = $("debrief-kind");
  kindEl.textContent =
    ({ triumph: "Triumphant ending", solid: "Solid ending", mixed: "Mixed ending", failure: "Failure ending" })[ending.kind] || "Ending";
  kindEl.dataset.kind = ending.kind;
  $("debrief-title").textContent = ending.title;
  $("debrief-summary").textContent = ending.summary;

  const statsList = $("debrief-stats");
  statsList.textContent = "";
  for (const st of app.story.stats || []) {
    const li = el("li");
    li.appendChild(el("span", null, st.label));
    li.appendChild(el("span", "v", fmtStat(app.story, st.id, app.state.stats[st.id])));
    statsList.appendChild(li);
  }

  $("debrief-score").textContent = `${score}/100`;
  $("debrief-rank").textContent = `Rank: ${rankName(score)}`;
  const best = app.profile?.completed?.[app.story.id]?.bestScore;
  $("debrief-personal-best").textContent = best != null ? `Personal best: ${best}/100` : "";

  const skills = $("debrief-skills");
  skills.textContent = "";
  const practised = practisedSkills(app.state);
  if (practised.length === 0) skills.appendChild(el("li", null, "Practised: (this run had no rated decisions)"));
  for (const s of practised) skills.appendChild(el("li", null, s));

  const recap = $("debrief-recap");
  recap.textContent = "";
  for (const d of app.state.decisions || []) {
    if (!d.logic) continue;
    const li = el("li");
    li.dataset.q = String(d.logic.quality);
    li.appendChild(el("div", "q",
      `${d.chapter ? d.chapter + " – " : ""}${d.sceneTitle}: ${d.choiceText}  ` +
      `(rated ${d.logic.quality > 0 ? "+" + d.logic.quality : d.logic.quality})`));
    const storyScene = app.story.scenes[d.sceneId];
    const storyChoice = (storyScene?.choices || []).find((c) => c.id === d.choiceId);
    li.appendChild(el("div", "why", storyChoice?.logic?.why || `${d.logic.skill || ""}`));
    recap.appendChild(li);
  }

  const takeaways = $("debrief-takeaways");
  takeaways.textContent = "";
  for (const t of app.story.debriefTakeaways || []) takeaways.appendChild(el("li", null, t));

  document.title = `${app.story.title} – Debrief`;
}

// ---------------- keyboard ----------------

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if ($("screen-play").hidden) return;
    const feedbackOpen = !$("feedback-layer").hidden;
    if (feedbackOpen) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        $("btn-ack-feedback").click();
      }
      return;
    }
    if (["1", "2", "3", "4"].includes(e.key)) {
      const buttons = $("choices-slot").querySelectorAll("button.choice");
      const btn = buttons[Number(e.key) - 1];
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  });
}

// ---------------- boot ----------------

async function init() {
  await loadSettings();
  $("set-theme").value = app.settings.theme;
  $("set-motion").checked = !!app.settings.reduceMotion;
  $("textsize-value").textContent = String(app.settings.textsize);

  const savedProfile = await api.loadProfile();
  app.profile = {
    completed: savedProfile?.completed || {},
    progress: savedProfile?.progress || {},
  };

  app.appInfo = await api.appInfo();
  $("about-version").textContent =
    `${app.appInfo.gameTitle} – version ${app.appInfo.version}. Built with Electron ${app.appInfo.electron}.`;

  $("link-privacy").addEventListener("click", (e) => {
    e.preventDefault();
    api.openExternal("https://aayushman-tech.github.io/boardroom-logic-app/");
  });

  initKeyboard();

  $("brand").addEventListener("click", async () => {
    if (app.story && app.state && !app.state.finished) await autosave();
    app.story = null;
    showScreen("home");
    renderHome();
  });

  $("btn-settings").addEventListener("click", () => {
    showScreen("settings");
    $("set-theme").value = app.settings.theme;
    $("set-motion").checked = !!app.settings.reduceMotion;
    $("textsize-value").textContent = String(app.settings.textsize);
  });
  $("btn-back-home-3").addEventListener("click", () => { showScreen("home"); renderHome(); });
  $("set-theme").addEventListener("change", (e) => {
    app.settings.theme = e.target.value;
    applySettings();
    saveSettings();
  });
  $("set-motion").addEventListener("change", (e) => {
    app.settings.reduceMotion = e.target.checked;
    applySettings();
    saveSettings();
  });

  document.querySelectorAll(".stepper [data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.step);
      app.settings.textsize = Math.max(1, Math.min(5, (app.settings.textsize || 3) + step));
      $("textsize-value").textContent = String(app.settings.textsize);
      applySettings();
      saveSettings();
    });
  });

  $("btn-check-stories").addEventListener("click", () => checkForStories(true));
  $("btn-refresh-home").addEventListener("click", () => checkForStories(true));
  $("btn-reset-progress").addEventListener("click", async () => {
    app.profile = { completed: {}, progress: {} };
    api.saveProfile(app.profile).catch(() => {});
    showToast("Progress reset.");
    renderHome();
  });

  $("btn-back-home-1").addEventListener("click", async () => {
    if (app.story && app.state && !app.state.finished) await autosave();
    showScreen("home");
    renderHome();
  });
  $("btn-back-home-2").addEventListener("click", () => {
    app.story = null;
    showScreen("home");
    renderHome();
  });

  $("btn-begin").addEventListener("click", () => startPlay({ resume: false }));
  $("btn-continue-save").addEventListener("click", () => startPlay({ resume: true }));
  $("btn-replay").addEventListener("click", () => startPlay({ resume: false }));

  $("btn-save-exit").addEventListener("click", async () => {
    await autosave();
    app.story = null;
    app.state = null;
    showScreen("home");
    renderHome();
    showToast("Progress saved.");
  });
  $("btn-restart-story").addEventListener("click", () => {
    if (!app.story) return;
    startPlay({ resume: false });
  });

  $("btn-case").addEventListener("click", () => toggleCasePanel());
  $("btn-case-close").addEventListener("click", () => toggleCasePanel(false));

  showScreen("home");
  renderHome();
  checkForStories(true);
}

async function checkForStories(announce) {
  let res;
  try {
    res = await refreshData({ online: true });
  } catch {
    setNetState("offline", "offline");
    if (announce) banner("Could not reach the stories server. Cached stories remain playable.", "error");
    renderHome();
    return;
  }
  if (announce) {
    if (res.offline && res.fallBackToDemo) {
      banner("You're offline and there's no cache yet – playing the bundled demo story for now.", "error");
    } else if (res.fallBackToDemo && !res.offline) {
      banner("No story is published in the catalogue yet – playing the bundled demo story for now.", "error");
    } else if (res.offline) {
      banner("Offline – playing from cache. New stories need to be online.", "error");
    } else {
      showToast("Stories refreshed.");
    }
  }
  renderHome();
}

document.addEventListener("DOMContentLoaded", init);
