// story-validator.mjs - Validator for Spotlight Business Play stories (Schema v2).
// Pure module: Node built-ins only.

function typeOk(value, type, nullable) {
  if (nullable === true && value === null) return true;
  if (Array.isArray(type)) {
    return type.some((t) => typeOk(value, t, nullable));
  }
  switch (type) {
    case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return true;
  }
}

const OPS = {
  const: (v, s) => JSON.stringify(v) === JSON.stringify(s),
  enum: (v, s) => s.some((x) => JSON.stringify(x) === JSON.stringify(v)),
  pattern: (v, s) => (typeof v === "string" ? new RegExp(s).test(v) : false),
  minLength: (v, s) => typeof v === "string" && v.length >= s,
  maxLength: (v, s) => typeof v === "string" && v.length <= s,
  minItems: (v, s) => Array.isArray(v) && v.length >= s,
  maxItems: (v, s) => Array.isArray(v) && v.length <= s,
  minProperties: (v, s) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length >= s,
  maxProperties: (v, s) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length <= s,
};

export function checkSchema(value, schema, path = "$") {
  const errors = [];
  if (schema == null) return errors;

  if (schema.type && !typeOk(value, schema.type, schema.nullable)) {
    return [`at ${path}: expected type ${schema.type}${schema.nullable ? " (or null)" : ""}, got ${describeType(value)}`];
  }
  if (schema.required && schema.required.length) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return [`at ${path}: value must be an object to have required fields`];
    }
    for (const key of schema.required) {
      if (!(key in value)) errors.push(`at ${path}: missing required property "${key}"`);
    }
  }
  for (const op of Object.keys(OPS)) {
    if (op in schema && !OPS[op](value, schema[op])) {
      errors.push(`at ${path}: fails "${op}" constraint ${JSON.stringify(schema[op])}`);
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const key of Object.keys(value)) {
      if (props[key]) {
        checkSchema(value[key], props[key], `${path}.${key}`).forEach((e) => errors.push(e));
      } else if (schema.additionalProperties === false) {
        errors.push(`at ${path}: additional property "${key}" is not allowed`);
      }
    }
  }
  if (Array.isArray(value) && schema.items && typeof schema.items === "object") {
    value.forEach((item, i) => checkSchema(item, schema.items, `${path}[${i}]`).forEach((e) => errors.push(e)));
  }
  return errors;
}

function describeType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function sceneWords(scene) {
  if (!scene) return 0;
  let text = "";
  const push = (s) => { if (typeof s === "string") text += " " + s; };
  push(scene.narration);
  if (scene.arrival) {
    push(scene.arrival.body);
    push(scene.arrival.subject);
  }
  if (scene.ending) {
    push(scene.ending.summary);
    push(scene.ending.reason);
    push(scene.ending.lesson);
  }
  if (Array.isArray(scene.exhibits)) {
    for (const ex of scene.exhibits) {
      push(ex.title);
      if (Array.isArray(ex.columns)) ex.columns.forEach(push);
      if (Array.isArray(ex.rows)) ex.rows.forEach((row) => row.forEach(push));
      if (Array.isArray(ex.data)) ex.data.forEach((d) => push(d.label));
      if (Array.isArray(ex.items)) ex.items.forEach((it) => { push(it.label); push(it.value); });
    }
  }
  return text.split(/\s+/).filter(Boolean).length;
}

export function readingMetrics(scene) {
  let text = (scene.narration || "") + " " + (scene.arrival?.body || "");
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);
  const avgSentenceLength = wordCount / sentenceCount;
  return { wordCount, avgSentenceLength };
}

export function validateStory(data, options = {}) {
  const allowShort = options.allowShort === true;
  const errors = [];
  const warnings = [];

  if (options.schema) {
    const schemaErrors = checkSchema(data, options.schema, "$");
    schemaErrors.forEach((e) => errors.push(e));
  }

  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["story is not an object"], warnings, metrics: null };
  }

  if (data.schemaVersion !== 2) {
    errors.push(`schemaVersion must be 2, got ${data.schemaVersion}`);
  }

  const scenes = data.scenes || {};
  const sceneIds = Object.keys(scenes);

  const isEnding = (scene) => scene && scene.ending != null && typeof scene.ending === "object";
  const hasEndingField = (scene) => scene && scene.ending !== undefined && scene.ending != null;
  const isDecision = (scene) => Array.isArray(scene && scene.choices) && scene.choices.length >= 2;

  const flagsSet = new Set();
  const flagsUsed = new Set();

  for (const [id, scene] of Object.entries(scenes)) {
    if (!scene || typeof scene !== "object") continue;

    const rm = readingMetrics(scene);
    if (rm.wordCount > 180) {
      warnings.push(`scene ${id}: exceeds 180 words (${rm.wordCount} words)`);
    }
    if (rm.avgSentenceLength > 22) {
      warnings.push(`scene ${id}: avg sentence length ${rm.avgSentenceLength.toFixed(1)} words > 22`);
    }

    if (hasEndingField(scene) && Array.isArray(scene.choices) && scene.choices.length > 0) {
      errors.push(`scene ${id}: has both "ending" and "choices" - ending scenes must not have choices`);
    }

    if (isEnding(scene)) {
      if (scene.ending.kind === "lose") {
        if (!scene.ending.reason || typeof scene.ending.reason !== "string" || scene.ending.reason.trim().length === 0) {
          errors.push(`scene ${id}: lose ending must have a non-empty "reason" explaining why the decision failed in simple business terms`);
        }
      }
    } else {
      const choices = Array.isArray(scene.choices) ? scene.choices : [];
      if (choices.length === 0) {
        errors.push(`scene ${id}: non-ending scene has 0 choices (dead end)`);
      }
      if (choices.length > 4) {
        errors.push(`scene ${id}: has ${choices.length} choices - maximum allowed is 4`);
      }
      for (const ch of choices) {
        if (!ch.next) {
          errors.push(`scene ${id}: choice "${ch.id}" has no "next"`);
          continue;
        }
        if (!scenes[ch.next]) {
          errors.push(`scene ${id}: choice "${ch.id}" points to unknown scene "${ch.next}"`);
        }
        (ch.setFlags || []).forEach((f) => flagsSet.add(f));
        (ch.clearFlags || []).forEach((f) => flagsUsed.add(f));
        (ch.requireFlags || []).forEach((f) => flagsUsed.add(f));
        (ch.hideIfFlags || []).forEach((f) => flagsUsed.add(f));
      }
    }
  }

  for (const f of flagsUsed) {
    if (!flagsSet.has(f)) {
      errors.push(`flag "${f}" is checked or cleared, but never set by any choice`);
    }
  }

  const edges = {};
  for (const [id, scene] of Object.entries(scenes)) {
    if (!scene || typeof scene !== "object" || isEnding(scene)) continue;
    edges[id] = (scene.choices || []).map((c) => c.next).filter((nxt) => !!scenes[nxt]);
  }

  const start = data.startScene;
  let reachableFromStart = new Set();
  if (!scenes[start]) {
    errors.push(`startScene "${start}" does not exist in scenes`);
  } else {
    reachableFromStart.add(start);
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const nxt of edges[cur] || []) {
        if (!reachableFromStart.has(nxt)) {
          reachableFromStart.add(nxt);
          queue.push(nxt);
        }
      }
    }
    for (const id of sceneIds) {
      if (!reachableFromStart.has(id)) {
        errors.push(`scene "${id}" is NOT reachable from startScene`);
      }
    }
  }

  const endingSceneIds = sceneIds.filter((id) => isEnding(scenes[id]));
  const canReachEnding = new Set(endingSceneIds);
  let reverseEdges = {};
  for (const [from, toList] of Object.entries(edges)) {
    for (const to of toList) {
      (reverseEdges[to] ||= []).push(from);
    }
  }
  const revQueue = [...endingSceneIds];
  while (revQueue.length > 0) {
    const cur = revQueue.shift();
    for (const prev of reverseEdges[cur] || []) {
      if (!canReachEnding.has(prev)) {
        canReachEnding.add(prev);
        revQueue.push(prev);
      }
    }
  }
  for (const id of reachableFromStart) {
    if (!canReachEnding.has(id)) {
      errors.push(`scene "${id}" cannot reach any ending (infinite trap loop)`);
    }
  }

  const winEndings = endingSceneIds.filter((id) => scenes[id].ending.kind === "win");
  const loseEndings = endingSceneIds.filter((id) => scenes[id].ending.kind === "lose");

  if (winEndings.length < 1 || winEndings.length > 2) {
    errors.push(`story must have 1-2 win endings, found ${winEndings.length}`);
  }
  if (!allowShort && loseEndings.length < 8) {
    errors.push(`story must have at least 8 lose endings, found ${loseEndings.length}`);
  }

  let bestWinPath = null;
  if (scenes[start] && winEndings.length > 0) {
    const nodeCost = (id) => {
      const sc = scenes[id];
      const w = sceneWords(sc);
      const d = isDecision(sc) ? 1 : 0;
      return { words: w, isDec: d, weight: w / 200 + d * 0.75 };
    };

    const pq = [
      [
        nodeCost(start).weight,
        start,
        {
          words: nodeCost(start).words,
          scenes: 1,
          decisions: nodeCost(start).isDec,
          path: [start],
        },
      ],
    ];
    const visited = new Set();

    while (pq.length > 0) {
      pq.sort((a, b) => a[0] - b[0]);
      const [, cur, info] = pq.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);

      const sc = scenes[cur];
      if (isEnding(sc) && sc.ending.kind === "win") {
        bestWinPath = info;
        break;
      }

      for (const nxt of edges[cur] || []) {
        if (visited.has(nxt)) continue;
        const c = nodeCost(nxt);
        const nextInfo = {
          words: info.words + c.words,
          scenes: info.scenes + 1,
          decisions: info.decisions + c.isDec,
          path: [...info.path, nxt],
        };
        pq.push([nextInfo.words / 200 + nextInfo.decisions * 0.75, nxt, nextInfo]);
      }
    }
  }

  let metrics = {
    shortestPathWords: null,
    shortestPathScenes: null,
    shortestPathDecisions: null,
    estimatedMinutes: null,
    shortestPath: [],
    winEndingsCount: winEndings.length,
    loseEndingsCount: loseEndings.length,
    totalScenes: sceneIds.length,
    decisionScenes: sceneIds.filter((id) => isDecision(scenes[id])).length,
    temptingWrongOptionRatio: null,
  };

  if (!bestWinPath) {
    errors.push("no win ending is reachable from startScene");
  } else {
    const estMinutes = Math.round(bestWinPath.words / 200 + bestWinPath.decisions * 0.75);
    metrics.shortestPathWords = bestWinPath.words;
    metrics.shortestPathScenes = bestWinPath.scenes;
    metrics.shortestPathDecisions = bestWinPath.decisions;
    metrics.estimatedMinutes = estMinutes;
    metrics.shortestPath = bestWinPath.path;

    if (!allowShort) {
      if (bestWinPath.scenes < 32) {
        errors.push(`shortest winning path has ${bestWinPath.scenes} scenes, needs >= 32`);
      }
      if (bestWinPath.decisions < 20) {
        errors.push(`shortest winning path has ${bestWinPath.decisions} decision scenes, needs >= 20`);
      }
      if (bestWinPath.words < 3600) {
        errors.push(`shortest winning path has ${bestWinPath.words} words, needs >= 3600`);
      }
      if (estMinutes < 30) {
        errors.push(`computed estimatedMinutes ${estMinutes} < 30`);
      }
    }

    const winningPathDecisions = bestWinPath.path.filter((id) => isDecision(scenes[id]));
    let decisionsWithQuickLose = 0;

    for (let i = 0; i < bestWinPath.path.length - 1; i++) {
      const curId = bestWinPath.path[i];
      const sc = scenes[curId];
      if (!isDecision(sc)) continue;

      const winningNext = bestWinPath.path[i + 1];
      const wrongChoices = (sc.choices || []).filter((ch) => ch.next !== winningNext);

      let foundTemptingLose = false;
      for (const wch of wrongChoices) {
        const q = [[wch.next, 1]];
        const seen = new Set([wch.next]);
        while (q.length > 0) {
          const [nId, depth] = q.shift();
          const nSc = scenes[nId];
          if (nSc && isEnding(nSc) && nSc.ending.kind === "lose") {
            foundTemptingLose = true;
            break;
          }
          if (depth < 4) {
            for (const follow of edges[nId] || []) {
              if (!seen.has(follow)) {
                seen.add(follow);
                q.push([follow, depth + 1]);
              }
            }
          }
        }
        if (foundTemptingLose) break;
      }
      if (foundTemptingLose) {
        decisionsWithQuickLose++;
      }
    }

    const ratio = winningPathDecisions.length > 0 ? decisionsWithQuickLose / winningPathDecisions.length : 1;
    metrics.temptingWrongOptionRatio = ratio;

    if (!allowShort && winningPathDecisions.length > 0 && ratio < 0.7) {
      errors.push(
        `only ${(ratio * 100).toFixed(1)}% of decision scenes on winning path offer a quick lose branch within 4 scenes (needs >= 70%)`
      );
    }
  }

  const cleanErrors = [...new Set(errors.filter(Boolean))];
  const cleanWarnings = [...new Set(warnings.filter(Boolean))];

  return {
    ok: cleanErrors.length === 0,
    errors: cleanErrors,
    warnings: cleanWarnings,
    metrics,
  };
}

export function validateManifestEntry(entry, storyData, manifest, options = {}) {
  const problems = [];
  if (!storyData) return { ok: false, problems: ["story file missing or unparseable"] };
  if (entry.id !== storyData.id) problems.push(`manifest id "${entry.id}" != story id "${storyData.id}"`);
  if (entry.title !== storyData.title) problems.push(`manifest title mismatch for ${entry.id}`);
  if (entry.subtitle !== storyData.subtitle) problems.push(`manifest subtitle mismatch for ${entry.id}`);
  if (entry.publishDate !== storyData.publishDate) problems.push(`manifest publishDate mismatch for ${entry.id}`);
  if (options.sha256 && entry.sha256 && entry.sha256 !== options.sha256) {
    problems.push(`sha256 mismatch for ${entry.id}`);
  }
  if (options.sha256 && !entry.sha256) {
    problems.push(`missing sha256 for ${entry.id}`);
  }
  if (!entry.file || !entry.file.startsWith("stories/")) {
    problems.push(`file field must point into stories/ for ${entry.id}`);
  }
  if (typeof entry.estimatedMinutes !== "number" || !Number.isInteger(entry.estimatedMinutes) || entry.estimatedMinutes < 30) {
    problems.push(`estimatedMinutes missing or < 30 for ${entry.id}`);
  }
  if (JSON.stringify(entry.tags?.slice().sort()) !== JSON.stringify([...(storyData.tags || [])].sort())) {
    problems.push(`tags mismatch for ${entry.id}`);
  }
  return { ok: problems.length === 0, problems };
}
