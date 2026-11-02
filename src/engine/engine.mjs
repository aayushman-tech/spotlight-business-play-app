// engine.mjs - Spotlight Business Play game engine (Schema v2).
// Pure module: no DOM, no Electron, no network. Deterministic 90s choose-your-path gamebook engine.

export function emptyState(story) {
  return {
    version: 2,
    storyId: story.id,
    sceneId: story.startScene,
    flags: {},
    visited: [story.startScene],
    finished: false,
    endingKind: null,
    ending: null,
  };
}

export function hasFlag(state, flag) {
  if (!state || !state.flags) return false;
  if (Array.isArray(state.flags)) return state.flags.includes(flag);
  return Boolean(state.flags[flag]);
}

export function setFlag(state, flag) {
  if (!state.flags) state.flags = {};
  if (Array.isArray(state.flags)) {
    if (!state.flags.includes(flag)) state.flags.push(flag);
  } else {
    state.flags[flag] = true;
  }
}

export function clearFlag(state, flag) {
  if (!state.flags) return;
  if (Array.isArray(state.flags)) {
    state.flags = state.flags.filter((f) => f !== flag);
  } else {
    delete state.flags[flag];
  }
}

export function visibleChoices(state, story) {
  const scene = story.scenes[state.sceneId];
  if (!scene || !Array.isArray(scene.choices)) return [];
  return scene.choices.filter((c) => {
    if (c.requireFlags && !c.requireFlags.every((f) => hasFlag(state, f))) return false;
    if (c.hideIfFlags && c.hideIfFlags.some((f) => hasFlag(state, f))) return false;
    return true;
  });
}

export function choose(state, story, choiceId) {
  if (state.finished) return null;
  const scene = story.scenes[state.sceneId];
  if (!scene) return null;
  const choices = visibleChoices(state, story);
  const choice = choices.find((c) => c.id === choiceId);
  if (!choice) return null;

  for (const f of choice.setFlags || []) setFlag(state, f);
  for (const f of choice.clearFlags || []) clearFlag(state, f);

  const nextId = choice.next;
  const nextScene = story.scenes[nextId];
  if (!nextScene) return null;

  state.sceneId = nextId;
  if (!state.visited.includes(nextId)) {
    state.visited.push(nextId);
  }

  if (nextScene.ending) {
    state.finished = true;
    state.endingKind = nextScene.ending.kind;
    state.ending = nextScene.ending;
    return {
      goto: nextId,
      kind: "ending",
      endingKind: nextScene.ending.kind,
      ending: nextScene.ending,
    };
  }

  return {
    goto: nextId,
    kind: "scene",
  };
}

export function restartStory(story) {
  return emptyState(story);
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const state = JSON.parse(json);
  if (!state || state.version !== 2 || !state.storyId || !state.sceneId) {
    throw new Error("cannot restore: malformed save");
  }
  return state;
}
