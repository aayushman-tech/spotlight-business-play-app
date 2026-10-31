// engine.mjs - the Boardroom Logic game engine. Pure module: no DOM, no Electron, no network.
// Cookies, coins, and characters welcome; randomness not - outcomes are deterministic.

export function emptyState(story) {
  const stats = {};
  for (const s of story.stats || []) stats[s.id] = clampStat(story, s.id, s.start);
  return {
    version: 1,
    storyId: story.id,
    sceneId: story.startScene,
    stats,
    flags: [],
    notes: [],
    visited: [],
    decisions: [], // { sceneId, sceneTitle, choiceId, choiceText, logic, chapter }
    failedStat: null,
    finished: false,
    endingKind: null,
    endingTitle: null,
  };
}

export function clampStat(story, statId, value) {
  const st = (story.stats || []).find((s) => s.id === statId);
  if (!st) return value;
  let v = value;
  if (st.min != null && v < st.min) v = st.min;
  if (st.max != null && v > st.max) v = st.max;
  return v;
}

export function hasFlag(state, flag) {
  return state.flags.includes(flag);
}

function setFlag(state, flag) {
  if (!state.flags.includes(flag)) state.flags.push(flag);
}

// Applies every value-modifier and condition filter from the spec.
export function visibleChoices(state, story) {
  const scene = story.scenes[state.sceneId];
  if (!scene || !Array.isArray(scene.choices)) return [];
  return scene.choices.filter((c) => {
    if (c.requireFlags && !c.requireFlags.every((f) => hasFlag(state, f))) return false;
    if (c.hideIfFlags && c.hideIfFlags.some((f) => hasFlag(state, f))) return false;
    if (c.requireStats) {
      for (const [statId, cond] of Object.entries(c.requireStats)) {
        const v = state.stats[statId];
        if (v === undefined) return false;
        for (const [op, n] of Object.entries(cond)) {
          if (op === "gte" && !(v >= n)) return false;
          if (op === "lte" && !(v <= n)) return false;
          if (op === "gt" && !(v > n)) return false;
          if (op === "lt" && !(v < n)) return false;
        }
      }
    }
    return true;
  });
}

function isEndingScene(story, sceneId) {
  const scene = story.scenes[sceneId];
  return !!(scene && scene.ending != null && typeof scene.ending === "object");
}

// Applies a choice's effects; returns a NEW decision record (no quality hints included).
function applyEffects(state, story, choice) {
  const deltas = {};
  if (choice.effects) {
    for (const [id, delta] of Object.entries(choice.effects)) {
      if (typeof delta !== "number") continue;
      deltas[id] = delta;
      state.stats[id] = clampStat(story, id, state.stats[id] + delta);
    }
  }
  for (const f of choice.setFlags || []) setFlag(state, f);
  for (const f of choice.clearFlags || []) {
    state.flags = state.flags.filter((x) => x !== f);
  }
  return deltas;
}

// Returns the first stat now below its failBelow threshold, if any.
export function failingStat(state, story) {
  for (const s of story.stats || []) {
    if (s.failBelow != null && Number.isFinite(state.stats[s.id])) {
      if (state.stats[s.id] < s.failBelow) return s;
    }
  }
  return null;
}

function enterScene(state, story, sceneId) {
  state.sceneId = sceneId;
  if (!state.visited.includes(sceneId)) state.visited.push(sceneId);
  const scene = story.scenes[sceneId];
  if (scene && Array.isArray(scene.addNotes)) {
    for (const note of scene.addNotes) {
      if (!state.notes.includes(note)) state.notes.push(note);
    }
  }
  if (isEndingScene(story, sceneId)) {
    state.finished = true;
    state.endingKind = scene.ending.kind;
    state.endingTitle = scene.ending.title;
  }
}

// The core move. Mutates `state`; returns a result object describing what happened:
// { goto: sceneId, kind: 'scene'|'ending'|'fail-fallback', deltas }
export function choose(state, story, choiceId) {
  if (state.finished) return null;
  const scene = story.scenes[state.sceneId];
  if (!scene) return null;
  const choice = (scene.choices || []).find((c) => c.id === choiceId);
  if (!choice) return null;
  const visible = visibleChoices(state, story);
  if (!visible.includes(choice)) return null;

  const deltas = applyEffects(state, story, choice);
  if (choice.logic) {
    state.decisions.push({
      sceneId: state.sceneId,
      sceneTitle: scene.title || "",
      chapter: scene.chapter || "",
      choiceId: choice.id,
      choiceText: choice.text,
      logic: { quality: choice.logic.quality, skill: choice.logic.skill || null },
      // NOTE: logic.why is intentionally NOT stored in the play state history;
      // the debrief reads it from the story file when the game ends.
    });
  }

  // Fail check: any stat below failBelow jumps to that stat's failScene.
  const failed = failingStat(state, story);
  if (failed && failed.failScene) {
    state.failedStat = failed.id;
    enterScene(state, story, failed.failScene);
    return { goto: failed.failScene, kind: "fail-fallback", deltas, failedStat: failed.id };
  }

  if (!choice.next || !story.scenes[choice.next]) return null; // validated stories never hit this
  enterScene(state, story, choice.next);
  return {
    goto: choice.next,
    kind: isEndingScene(story, choice.next) ? "ending" : "scene",
    deltas,
  };
}

// ---------- scoring ----------

export function logicScore(state) {
  const rated = (state.decisions || []).filter((d) => d.logic && typeof d.logic.quality === "number");
  if (rated.length === 0) return 0;
  const mean = rated.reduce((sum, d) => sum + (d.logic.quality + 2) / 4, 0) / rated.length;
  return Math.round(Math.max(0, Math.min(1, mean)) * 100);
}

export function rankName(score) {
  if (score >= 90) return "CEO";
  if (score >= 75) return "VP";
  if (score >= 60) return "Director";
  if (score >= 40) return "Manager";
  if (score >= 20) return "Analyst";
  return "Intern";
}

// ---------- save / restore ----------

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const state = JSON.parse(json);
  if (!state || state.version !== 1 || !state.storyId || !state.sceneId) {
    throw new Error("cannot restore: malformed save");
  }
  return state;
}

// Skills actually practised (union of skills on rated decisions).
export function practisedSkills(state) {
  const out = new Set();
  for (const d of state.decisions || []) {
    if (d.logic && d.logic.skill) out.add(d.logic.skill);
  }
  return [...out];
}
