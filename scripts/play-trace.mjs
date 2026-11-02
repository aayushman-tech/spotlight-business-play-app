// scripts/play-trace.mjs - Traces the winning path and 4 distinct losing paths through the default story.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emptyState, choose, visibleChoices } from "../src/engine/engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storyPath = path.join(__dirname, "..", "assets", "default-story.json");
const story = JSON.parse(fs.readFileSync(storyPath, "utf8"));

console.log("==================================================");
console.log(`Story: ${story.title} (${story.id})`);
console.log(`Start Scene: ${story.startScene}`);
console.log("==================================================\n");

// 1. Trace Winning Path
console.log("--- [PATH 1: THE WINNING SPINE] ---");
const winState = emptyState(story);
let step = 1;

while (!winState.finished) {
  const scene = story.scenes[winState.sceneId];
  const choices = visibleChoices(winState, story);
  if (choices.length === 0) {
    console.error(`Dead end at scene ${winState.sceneId}!`);
    break;
  }
  // The first choice in our generated story is the winning choice on the spine
  const winChoice = choices[0];
  console.log(`Step ${String(step).padStart(2, "0")} | [${winState.sceneId}] ${scene.title}`);
  console.log(`        -> Chose: "${winChoice.text}"`);
  
  const res = choose(winState, story, winChoice.id);
  step++;
}

const winLessons = winState.ending.takeaways || story.lessons || [];
console.log(`\nWIN OUTCOME reached at [${winState.sceneId}]:`);
console.log(`  Kind: ${winState.endingKind}`);
console.log(`  Title: ${winState.ending.title}`);
console.log(`  Summary: ${winState.ending.summary.substring(0, 100)}...`);
console.log(`  Takeaways (${winLessons.length} principles):`);
winLessons.forEach((l) => console.log(`    - ${l}`));
console.log(`  Total scenes traversed: ${winState.visited.length}\n`);

// Helper to trace a losing path
function traceLosingPath(name, spineStepsBeforeDiverging, wrongChoiceIndex) {
  console.log(`--- [${name}] ---`);
  const state = emptyState(story);
  let s = 1;

  // Follow spine
  for (let i = 0; i < spineStepsBeforeDiverging; i++) {
    const scene = story.scenes[state.sceneId];
    const choices = visibleChoices(state, story);
    const c = choices[0];
    choose(state, story, c.id);
    s++;
  }

  // Diverge on wrong choice
  const divergeScene = story.scenes[state.sceneId];
  const divChoices = visibleChoices(state, story);
  const badChoice = divChoices[wrongChoiceIndex] || divChoices[divChoices.length - 1];
  console.log(`Diverged at Step ${s} | [${state.sceneId}] ${divergeScene.title}`);
  console.log(`  -> Bad Choice: "${badChoice.text}"`);
  choose(state, story, badChoice.id);
  s++;

  // Continue to ending
  while (!state.finished) {
    const scene = story.scenes[state.sceneId];
    const choices = visibleChoices(state, story);
    if (choices.length === 0) break;
    const c = choices[0];
    console.log(`Step ${String(s).padStart(2, "0")} | [${state.sceneId}] ${scene.title}`);
    console.log(`        -> Choice: "${c.text}"`);
    choose(state, story, c.id);
    s++;
  }

  console.log(`GAME OVER at [${state.sceneId}]:`);
  console.log(`  Title: ${state.ending.title}`);
  console.log(`  Summary: ${state.ending.summary.substring(0, 80)}...`);
  console.log(`  Reason (Business Principle): "${state.ending.reason}"\n`);
}

// 2. Trace 4 Distinct Losing Paths
traceLosingPath("PATH 2: LOSE EARLY (Scene 1 Bad Pitch)", 0, 1);
traceLosingPath("PATH 3: LOSE MID-EARLY (Scene 4 Hardware Flaw)", 3, 1);
traceLosingPath("PATH 4: LOSE MID-GAME (Scene 12 Premature Scaling)", 11, 1);
traceLosingPath("PATH 5: LOSE LATE (Scene 24 Hostile Buyout)", 23, 1);

console.log("==================================================");
console.log("All 5 path traces completed successfully!");
console.log("==================================================");
