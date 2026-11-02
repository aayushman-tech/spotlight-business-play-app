// tests/engine.test.mjs - Unit tests for Spotlight Business Play game engine (Schema v2).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  emptyState,
  choose,
  visibleChoices,
  hasFlag,
  setFlag,
  clearFlag,
  restartStory,
  serialize,
  deserialize,
} from "../src/engine/engine.mjs";

import {
  compileManifest,
  localDateString,
  compareVersions,
} from "../src/engine/manifest.mjs";

import { validateStory } from "../src/engine/story-validator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "src", "engine", "story.schema.json"), "utf8")
);
const defaultStory = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "assets", "default-story.json"), "utf8")
);

// Minimal fixture story
const fixture = {
  schemaVersion: 2,
  id: "test-story",
  title: "Test Venture",
  subtitle: "Testing engine mechanics",
  publishDate: "2026-11-01",
  difficulty: "medium",
  estimatedMinutes: 35,
  tags: ["testing"],
  lessons: ["Always test your code", "Validate assumptions", "Stay focused"],
  startScene: "s1",
  scenes: {
    s1: {
      chapter: "Chapter 1",
      title: "First Choice",
      arrival: { type: "memo", body: "Important memo" },
      narration: "A big crossroad appears.",
      choices: [
        { id: "c_win", text: "Choose wisely", setFlags: ["smart_move"], next: "s_win" },
        { id: "c_bad", text: "Take hasty shortcut", next: "s_lose" },
      ],
    },
    s_win: {
      chapter: "Epilogue",
      title: "Victory",
      narration: "You triumphed through sound judgment.",
      choices: [],
      ending: {
        kind: "win",
        title: "Triumph",
        summary: "Sound choices won the day.",
      },
    },
    s_lose: {
      chapter: "Epilogue",
      title: "Collapse",
      narration: "The shortcut proved fatal.",
      choices: [],
      ending: {
        kind: "lose",
        title: "Bankrupted",
        summary: "The hasty decision blew up.",
        reason: "Taking unvalidated shortcuts compromises long-term solvency.",
      },
    },
  },
};

test("emptyState initialises a clean state", () => {
  const state = emptyState(fixture);
  assert.equal(state.version, 2);
  assert.equal(state.storyId, "test-story");
  assert.equal(state.sceneId, "s1");
  assert.deepEqual(state.flags, {});
  assert.deepEqual(state.visited, ["s1"]);
  assert.equal(state.finished, false);
  assert.equal(state.endingKind, null);
});

test("flag management (set, has, clear)", () => {
  const state = emptyState(fixture);
  assert.equal(hasFlag(state, "smart_move"), false);
  setFlag(state, "smart_move");
  assert.equal(hasFlag(state, "smart_move"), true);
  clearFlag(state, "smart_move");
  assert.equal(hasFlag(state, "smart_move"), false);
});

test("visibleChoices respects requireFlags and hideIfFlags", () => {
  const gatedFixture = {
    ...fixture,
    scenes: {
      ...fixture.scenes,
      s1: {
        ...fixture.scenes.s1,
        choices: [
          { id: "c1", text: "Always visible", next: "s_win" },
          { id: "c2", text: "Requires badge", requireFlags: ["has_badge"], next: "s_win" },
          { id: "c3", text: "Hidden if novice", hideIfFlags: ["is_novice"], next: "s_win" },
        ],
      },
    },
  };

  const state = emptyState(gatedFixture);
  let vis = visibleChoices(state, gatedFixture).map((c) => c.id);
  assert.deepEqual(vis, ["c1", "c3"]);

  setFlag(state, "has_badge");
  vis = visibleChoices(state, gatedFixture).map((c) => c.id);
  assert.deepEqual(vis, ["c1", "c2", "c3"]);

  setFlag(state, "is_novice");
  vis = visibleChoices(state, gatedFixture).map((c) => c.id);
  assert.deepEqual(vis, ["c1", "c2"]);
});

test("choose executes immediate scene transition and resolves WIN ending", () => {
  const state = emptyState(fixture);
  const res = choose(state, fixture, "c_win");
  assert.equal(res.kind, "ending");
  assert.equal(res.endingKind, "win");
  assert.equal(state.sceneId, "s_win");
  assert.equal(state.finished, true);
  assert.equal(hasFlag(state, "smart_move"), true);
  assert.equal(state.visited.includes("s_win"), true);
});

test("choose executes immediate scene transition and resolves LOSE ending with reason", () => {
  const state = emptyState(fixture);
  const res = choose(state, fixture, "c_bad");
  assert.equal(res.kind, "ending");
  assert.equal(res.endingKind, "lose");
  assert.equal(state.sceneId, "s_lose");
  assert.equal(state.finished, true);
  assert.equal(typeof state.ending.reason, "string");
  assert.ok(state.ending.reason.length > 10);
});

test("restartStory resets state to scene 1 with empty flags", () => {
  const state = emptyState(fixture);
  choose(state, fixture, "c_win");
  assert.equal(state.finished, true);

  const restarted = restartStory(fixture);
  assert.equal(restarted.sceneId, "s1");
  assert.deepEqual(restarted.flags, {});
  assert.equal(restarted.finished, false);
});

test("serialize and deserialize round-trip state correctly", () => {
  const state = emptyState(fixture);
  setFlag(state, "tested");
  const json = serialize(state);
  const restored = deserialize(json);
  assert.equal(restored.storyId, state.storyId);
  assert.equal(restored.sceneId, state.sceneId);
  assert.equal(hasFlag(restored, "tested"), true);
});

test("deserialize rejects malformed or wrong-version data", () => {
  assert.throws(() => deserialize("invalid-json"));
  assert.throws(() => deserialize(JSON.stringify({ version: 1, storyId: "x" })));
});

// ---------- Manifest compilation tests ----------

const sampleEntries = (dates) =>
  dates.map((d, i) => ({
    id: `story_${i}`,
    title: `Story ${i}`,
    subtitle: "Subtitle",
    publishDate: d,
    estimatedMinutes: 35,
    difficulty: "medium",
    tags: ["tech"],
    file: `stories/story_${i}.json`,
    sha256: "fake-sha",
  }));

test("compileManifest gates future publishDate", () => {
  const today = new Date("2026-11-02T12:00:00");
  const view = compileManifest(
    {
      schemaVersion: 2,
      minAppVersion: null,
      stories: sampleEntries(["2026-11-01", "2026-11-15"]),
    },
    { appVersion: "1.1.0", localDate: today, storyStatus: {} }
  );
  assert.deepEqual(view.playable.map((s) => s.id), ["story_0"]);
  assert.equal(view.blocked[0].reason, "not_published_yet");
});

test("compileManifest enforces minAppVersion", () => {
  const view = compileManifest(
    {
      schemaVersion: 2,
      minAppVersion: "2.0.0",
      stories: sampleEntries(["2026-11-01"]),
    },
    { appVersion: "1.1.0", localDate: new Date(), storyStatus: {} }
  );
  assert.equal(view.playable.length, 0);
  assert.equal(view.blocked[0].reason, "min_app_version");
});

test("compareVersions helper", () => {
  assert.ok(compareVersions("1.1.0", "1.0.0") > 0);
  assert.ok(compareVersions("1.0.0", "1.1.0") < 0);
  assert.equal(compareVersions("1.1.0", "1.1.0"), 0);
});

// ---------- Validator on Default Story and Bad Story ----------

test("default story passes validator with zero errors", () => {
  const res = validateStory(defaultStory, { allowShort: false, schema });
  assert.equal(res.ok, true, `Errors: ${res.errors.join(", ")}`);
  assert.ok(res.metrics.shortestPathScenes >= 32);
  assert.ok(res.metrics.shortestPathWords >= 3600);
  assert.ok(res.metrics.shortestPathDecisions >= 20);
  assert.ok(res.metrics.temptingWrongOptionRatio >= 0.7);
  assert.equal(res.warnings.length, 0);
});

test("validator catches missing reason on lose ending", () => {
  const badStory = JSON.parse(JSON.stringify(defaultStory));
  // Find a lose scene and delete reason
  const loseKey = Object.keys(badStory.scenes).find(
    (k) => badStory.scenes[k].ending && badStory.scenes[k].ending.kind === "lose"
  );
  delete badStory.scenes[loseKey].ending.reason;
  const res = validateStory(badStory, { allowShort: true, schema });
  assert.equal(res.ok, false);
  assert.ok(
    res.errors.some((e) =>
      e.includes("lose ending must have a non-empty \"reason\"")
    )
  );
});

test("validator catches unreachable scene and dead end", () => {
  const badStory = JSON.parse(JSON.stringify(defaultStory));
  badStory.scenes.orphan = {
    chapter: "Chapter 1",
    title: "Orphan",
    narration: "Nobody can reach me.",
    choices: [],
    // no ending!
  };
  const res = validateStory(badStory, { allowShort: true, schema });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("NOT reachable")));
  assert.ok(res.errors.some((e) => e.includes("dead end")));
});
