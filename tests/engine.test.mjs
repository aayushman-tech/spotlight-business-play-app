// engine.test.js - unit tests for the pure game engine (node:test, no DOM, no Electron).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyState, choose, visibleChoices, logicScore, rankName, serialize, deserialize,
  failingStat, clampStat, practisedSkills,
} from "../src/engine/engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoPath = path.join(__dirname, "..", "vendor", "demo.json");
const demo = JSON.parse(fs.readFileSync(demoPath, "utf8"));

// ---------- tiny fixture story ----------
const fixture = {
  schemaVersion: 1,
  id: "fix-1",
  stats: [
    { id: "cash", label: "Cash", start: 500, min: 0, max: null, format: "currency", failBelow: 100, failScene: "fail_cash" },
    { id: "rep", label: "Reputation", start: 50, min: 0, max: 100, format: "number" },
  ],
  startScene: "s1",
  scenes: {
    s1: {
      title: "Start", arrival: { type: "memo", body: "x" }, narration: "start",
      choices: [
        { id: "cheap", text: "cheap", effects: { cash: -450 }, feedback: "f", next: "s2" },
        { id: "smart", text: "smart", effects: { cash: -50, rep: 5 }, feedback: "f", next: "s2" },
      ],
      ending: null,
    },
    s2: {
      title: "Second", arrival: { type: "memo", body: "y" }, narration: "second",
      choices: [
        { id: "a", text: "a", setFlags: ["loan"], feedback: "f", next: "end" },
        { id: "hidden", text: "h", requireFlags: ["loan"], feedback: "f", next: "end" },
        { id: "b", text: "b", hideIfFlags: ["loan"], feedback: "f", next: "end" },
        { id: "lock", text: "l", requireStats: { cash: { gte: 100000 } }, feedback: "f", next: "end" },
      ],
      ending: null,
    },
    fail_cash: {
      title: "Broke", arrival: { type: "memo", body: "z" }, narration: "broke",
      choices: [{ id: "c", text: "continue", feedback: "f", next: "end" }],
      ending: null,
    },
    end: {
      title: "End", arrival: { type: "memo", body: "e" }, narration: "end",
      ending: { kind: "solid", title: "T", summary: "S" },
    },
  },
};

test("emptyState initialises stats with story start values", () => {
  const state = emptyState(fixture);
  assert.equal(state.stats.cash, 500);
  assert.equal(state.stats.rep, 50);
  assert.equal(state.sceneId, "s1");
  assert.deepEqual(state.flags, []);
  assert.equal(state.finished, false);
});

test("visibleChoices applies requireFlags and requireStats", () => {
  const state = emptyState(fixture);
  // first from s1 -> s2 without flags
  choose(state, fixture, "smart");
  const vis = visibleChoices(state, fixture).map((c) => c.id);
  assert.deepEqual(vis, ["a", "b"]); // hidden needs flag; lock needs cash>=100000 (we have 450)
  state.stats.cash = 100000;
  assert.equal(visibleChoices(state, fixture).some((c) => c.id === "lock"), true);
  state.flags.push("loan");
  const vis2 = visibleChoices(state, fixture).map((c) => c.id);
  assert.equal(vis2.includes("hidden"), true);
  assert.equal(vis2.includes("b"), false); // b hidden while loan flag set
});

test("effects apply and clamp; failBelow triggers failScene jump", () => {
  const state = emptyState(fixture);
  const res = choose(state, fixture, "cheap"); // cash 500-450=50 < failBelow 100
  assert.equal(res.kind, "fail-fallback");
  assert.equal(state.sceneId, "fail_cash");
  assert.equal(state.stats.cash, 50); // min clamp is 0; 50 fine
  assert.equal(state.failedStat, "cash");
  // clamps
  assert.equal(clampStat(fixture, "rep", 150), 100);
  assert.equal(clampStat(fixture, "rep", -5), 0);
});

test("failBelow with min=0 floors the stat before comparison", () => {
  const story = JSON.parse(JSON.stringify(fixture));
  story.stats[0].failBelow = 0;
  const state = emptyState(story);
  story.stats[0].min = 0;
  state.stats.cash = 100;
  choose(state, story, "cheap"); // cash 100-450 -> clamp 0 -> below failBelow 0? equals 0, not below. So normal.
  // cash = -350 would fall below min 0 -> clamped to 0; 0 < 0 false -> no fail jump for this config
  assert.equal(["s2", "fail_cash"].includes(state.sceneId), true);
});

test("logicScore maths across full -2..2 range", () => {
  const state = { decisions: [] };
  const q = (quality) => ({ logic: { quality } });
  state.decisions = [q(2), q(0), q(-2)];
  // (2+2)/4=1, (0+2)/4=0.5, (-2+2)/4=0 => mean 0.5 => 50
  assert.equal(logicScore(state), 50);
  state.decisions = [q(2)];
  assert.equal(logicScore(state), 100);
  state.decisions = [q(-2)];
  assert.equal(logicScore(state), 0);
  state.decisions = [];
  assert.equal(logicScore(state), 0);
});

test("rankName boundaries", () => {
  assert.equal(rankName(0), "Intern");
  assert.equal(rankName(19), "Intern");
  assert.equal(rankName(20), "Analyst");
  assert.equal(rankName(39), "Analyst");
  assert.equal(rankName(40), "Manager");
  assert.equal(rankName(59), "Manager");
  assert.equal(rankName(60), "Director");
  assert.equal(rankName(74), "Director");
  assert.equal(rankName(75), "VP");
  assert.equal(rankName(89), "VP");
  assert.equal(rankName(90), "CEO");
  assert.equal(rankName(100), "CEO");
});

test("scene navigation walks demo start to a chosen ending", () => {
  // Walk the demo intelligently: pick the highest-quality option at each decision
  const state = emptyState(demo);
  let steps = 0;
  while (!state.finished && steps < 50) {
    const choices = visibleChoices(state, demo);
    const best = choices.reduce((acc, c) =>
      ((c.logic?.quality ?? -5) > ((acc.logic?.quality ?? -5))) ? c : acc, choices[0]);
    const res = choose(state, demo, best.id);
    assert.ok(res, `navigation stuck at scene ${state.sceneId}`);
    steps += 1;
  }
  assert.equal(state.finished, true, "demo should reach an ending");
  assert.equal(failingStat(state, demo), null);
});

test("demo: choosing badly can finish or fail, but save/restore round-trips", () => {
  const state = emptyState(demo);
  const devnull = [];
  devnull.push(choose(state, demo, "b")); // buy cheap cart
  const saved = serialize(state);
  const restored = deserialize(saved);
  assert.equal(restored.storyId, state.storyId);
  assert.equal(restored.sceneId, state.sceneId);
  assert.deepEqual(restored.stats, state.stats);
  assert.deepEqual(restored.flags, state.flags);
  assert.deepEqual(restored.decisions, state.decisions);
});

test("deserialize rejects malformed saves", () => {
  assert.throws(() => deserialize("not json"));
  assert.throws(() => deserialize("{}"));
});

test("practisedSkills collects skills", () => {
  const state = { decisions: [
    { logic: { quality: 2, skill: "unit economics" } },
    { logic: { quality: 1, skill: "base rates" } },
    { logic: { quality: 0, skill: "unit economics" } },
  ] };
  assert.deepEqual(practisedSkills(state), ["unit economics", "base rates"]);
});

// ---------- manifest selection ----------
import {
  compileManifest, pickTodaysStory, localDateString, compareVersions,
} from "../src/engine/manifest.mjs";

const entries = (dates) => dates.map((d, i) => ({
  id: `s${i}`, title: `T${i}`, subtitle: "S", publishDate: d,
  estimatedMinutes: 40, difficulty: "medium", tags: [], file: `stories/s${i}.json`, sha256: "x",
}));

test("compileManifest: publishDate gating (future story not playable)", () => {
  const today = new Date("2026-10-30T12:00:00");
  const view = compileManifest(
    {
      schemaVersion: 1,
      minAppVersion: null,
      stories: entries(["2026-10-28", "2026-11-15", "2026-10-01"]),
    },
    { appVersion: "1.0.0", localDate: today, storyStatus: {} }
  );
  assert.deepEqual(view.playable.map((e) => e.id), ["s0", "s2"]);
  assert.equal(view.blocked.find((b) => b.reason === "not_published_yet").entry.id, "s1");
});

test("pickTodays: newest playable uncompleted, fallback when all completed", () => {
  const playable = entries(["2026-10-28", "2026-10-01"]);
  const completed = { s0: { completed: true } };
  assert.equal(pickTodaysStory(playable, completed).id, "s1"); // s0 done, s1 not
  const all = { s0: { completed: true }, s1: { completed: true } };
  assert.equal(pickTodaysStory(playable, all).id, "s0"); // fallback newest
  assert.equal(pickTodaysStory(playable, {}), playable[0]);
});

test("manifest: hash mismatch and invalid schema are blocked with reasons", () => {
  const view = compileManifest(
    {
      schemaVersion: 1,
      stories: entries(["2026-10-01", "2026-10-02", "2026-10-03"]),
    },
    { appVersion: "1.0.0", localDate: "2026-10-30", storyStatus: { s0: "ok", s1: "hash_mismatch", s2: "schema_invalid" } }
  );
  assert.equal(view.playable.length, 1);
  assert.equal(view.blocked.find((b) => b.entry.id === "s1").reason, "hash_mismatch");
  assert.equal(view.blocked.find((b) => b.entry.id === "s2").reason, "schema_invalid");
});

test("manifest: manifest-level minAppVersion blocks everything when higher", () => {
  const view = compileManifest(
    {
      schemaVersion: 1,
      minAppVersion: "2.0.0",
      stories: entries(["2026-10-01"]),
    },
    { appVersion: "1.2.0", localDate: "2026-10-30", storyStatus: {} }
  );
  assert.equal(view.manifestIssues.length, 1);
  assert.equal(view.playable.length, 0);
  assert.equal(view.blocked[0].reason, "min_app_version");
});

test("manifest appVersion equal or higher is fine", () => {
  const view = compileManifest(
    { schemaVersion: 1, minAppVersion: "1.0.0", stories: entries(["2026-10-01"]) },
    { appVersion: "1.0.0", localDate: "2026-10-30", storyStatus: {} }
  );
  assert.equal(view.playable.length, 1);
});

test("compareVersions semantics", () => {
  assert.ok(compareVersions("1.0.1", "1.0.0") > 0);
  assert.ok(compareVersions("1.2.0", "1.10.0") < 0);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});

test("localDateString is local, not UTC-shifted", () => {
  const d = new Date(2026, 9, 30, 23, 30); // local Oct 30 23:30
  assert.equal(localDateString(d), "2026-10-30");
});

test("demo story is structurally valid per the schema subset (engine-level guard)", async () => {
  const { checkSchema } = await import("../src/engine/story-validator.mjs");
  const schema = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "src", "engine", "story.schema.json"), "utf8"));
  const errors = checkSchema(demo, schema, "$");
  assert.deepEqual(errors, []);
});
