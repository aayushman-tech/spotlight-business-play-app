// validator-core.js - pure story validation for Boardroom Logic (no DOM, no Electron).
// Used by tools/validate.js, tools/add-story.js and copied into the app (src/engine/story-validator.js).
// Node built-ins only.

const CARDINAL_WORDS = false; // word = non-empty whitespace-separated token (kept for clarity)

// ---------- tiny JSON-Schema subset validator (draft-07 compatible for our schema) ----------
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
  // returns array of error strings
  const errors = [];

  if (schema == null) return errors;

  const apply = (subSchema, subValue, subPath) => checkSchema(subValue, subSchema, subPath);

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
  // boolean logic
  if (schema.not && checkSchema(value, schema.not, path).length === 0) {
    errors.push(`at ${path}: must NOT match the "not" schema`);
  }
  if (schema.allOf) schema.allOf.forEach((s, i) => apply(s, value, `${path}`).forEach((e) => errors.push(e)));
  if (schema.anyOf && !schema.anyOf.some((s) => checkSchema(value, s, path).length === 0)) {
    errors.push(`at ${path}: does not match any of ${schema.anyOf.length} "anyOf" subschemas`);
  }
  if (schema.oneOf) {
    const matching = schema.oneOf.filter((s) => checkSchema(value, s, path).length === 0);
    if (matching.length !== 1) {
      errors.push(`at ${path}: must match exactly one "oneOf" subschema (matched ${matching.length})`);
    }
  }
  if (schema.if) {
    const matchesIf = checkSchema(value, schema.if, path).length === 0;
    if (matchesIf && schema.then && checkSchema(value, schema.then, path).length !== 0) {
      errors.push(`at ${path}: matches "if" but violates "then"`);
    }
    if (!matchesIf && schema.else && checkSchema(value, schema.else, path).length !== 0) {
      errors.push(`at ${path}: fails "if" and violates "else"`);
    }
  }
  for (const op of Object.keys(OPS)) {
    if (op in schema && !OPS[op](value, schema[op])) {
      errors.push(`at ${path}: fails "${op}" constraint ${JSON.stringify(schema[op])}`);
    }
  }
  // object properties
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const key of Object.keys(value)) {
      if (props[key]) {
        checkSchema(value[key], props[key], `${path}.${key}`).forEach((e) => errors.push(e));
      } else if (schema.additionalProperties === false) {
        errors.push(`at ${path}: additional property "${key}" is not allowed`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        const sub = { ...schema.additionalProperties, required: undefined };
        checkSchema(value[key], sub, `${path}.${key}`).forEach((e) => {
          if (!e.includes("missing required")) errors.push(e);
        });
      }
    }
  }
  // array items
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

// ---------- word counting ----------
export function sceneWords(scene) {
  let text = "";
  const push = (s) => { if (typeof s === "string") text += " " + s; };
  push(scene.narration);
  if (scene.arrival) {
    push(scene.arrival.body);
    push(scene.arrival.subject);
  }
  if (Array.isArray(scene.addNotes)) scene.addNotes.forEach(push);
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

// ---------- structural validation ----------
// Returns { ok, errors, warnings, metrics: { words, pathScenes, pathDecisions, estimatedMinutes, endings, decisionScenes } }

export function validateStory(data, options = {}) {
  const allowShort = options.allowShort === true;
  const errors = [];
  const warnings = [];

  // 0) schema
  const schemaErrors = checkSchema(data, options.schema || null, "$");
  if (options.schema) schemaErrors.forEach((e) => errors.push(e));

  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["story is not an object"], warnings, metrics: null };
  }

  const scenes = data.scenes || {};
  const sceneIds = Object.keys(scenes);
  const statIds = (data.stats || []).map((s) => s.id);
  const statById = Object.fromEntries((data.stats || []).map((s) => [s.id, s]));
  const characterIds = new Set((data.characters || []).map((c) => c.id));

  const isEnding = (scene) => scene && scene.ending != null && scene.ending !== undefined && typeof scene.ending === "object";
  const hasEndingField = (scene) => scene && scene.ending !== undefined && scene.ending != null;
  const conditionKeys = (choice) => ["requireFlags", "hideIfFlags", "requireStats"].filter((k) => {
    const v = choice[k];
    return v != null && ((Array.isArray(v) && v.length > 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0));
  });

  const isPotentiallyVisible = (choice) => {
    // Numeric impossibility check only. Flag conditions are assumed satisfiable elsewhere.
    if (choice.requireStats) {
      for (const [id, cond] of Object.entries(choice.requireStats)) {
        const st = statById[id];
        if (!st) return false;
        const hi = st.max == null ? Infinity : st.max;
        const lo = st.min == null ? -Infinity : st.min;
        for (const [op, v] of Object.entries(cond)) {
          if (op === "gte" && hi < v) return false;
          if (op === "gt" && hi <= v) return false;
          if (op === "lte" && lo > v) return false;
          if (op === "lt" && lo >= v) return false;
        }
      }
    }
    return true;
  };

  const flagsSet = new Set();
  const flagsUsed = new Set();

  for (const [id, scene] of Object.entries(scenes)) {
    if (!scene || typeof scene !== "object") continue;
    if (hasEndingField(scene) && Array.isArray(scene.choices)) {
      errors.push(`scene ${id}: has both "ending" object and "choices" - an ending scene must have no choices`);
    }
    if (!isEnding(scene)) {
      const choices = Array.isArray(scene.choices) ? scene.choices : [];
      const visible = choices.filter(isPotentiallyVisible);
      if (visible.length === 0) {
        errors.push(`scene ${id}: dead end - no potentially visible choices in a non-ending scene`);
      }
      for (const ch of choices) {
        if (!ch.next) {
          errors.push(`scene ${id}: choice "${ch.id}" has no "next"`);
          continue;
        }
        if (!scenes[ch.next]) errors.push(`scene ${id}: choice "${ch.id}" points to unknown scene "${ch.next}"`);
      }
    }
    if (Array.isArray(scene.choices)) {
      for (const ch of scene.choices) {
        (ch.setFlags || []).forEach((f) => flagsSet.add(f));
        (ch.clearFlags || []).forEach((f) => flagsUsed.add(f));
        (ch.requireFlags || []).forEach((f) => flagsUsed.add(f));
        (ch.hideIfFlags || []).forEach((f) => flagsUsed.add(f));
        if (ch.requireStats) {
          for (const statId of Object.keys(ch.requireStats)) {
            if (!statById[statId]) errors.push(`scene ${id}: choice "${ch.id}" references unknown stat "${statId}" in requireStats`);
          }
        }
        if (ch.effects) {
          for (const statId of Object.keys(ch.effects)) {
            if (!statById[statId]) errors.push(`scene ${id}: choice "${ch.id}" references unknown stat "${statId}" in effects`);
          }
        }
        if (ch.logic && typeof ch.logic.quality !== "number") {
          errors.push(`scene ${id}: choice "${ch.id}" has bad logic.quality`);
        }
        if (ch.logic && (ch.logic.why == null || ch.logic.why.trim().length < 30)) {
          errors.push(`scene ${id}: choice "${ch.id}" logic.why must be at least 30 chars`);
        }
        if (ch.logic && (ch.logic.quality < -2 || ch.logic.quality > 2)) {
          errors.push(`scene ${id}: choice "${ch.id}" logic.quality must be -2..2`);
        }
      }
    }
  }

  for (const f of flagsUsed) {
    if (!flagsSet.has(f)) {
      errors.push(`flag "${f}" is used (requireFlags/hideIfFlags/clearFlags) but never set by any choice`);
    }
  }

  // stats references from failScene
  for (const st of data.stats || []) {
    if (st.failBelow != null && !st.failScene) {
      errors.push(`stat "${st.id}" has failBelow but no failScene`);
    }
    if (st.failScene && !scenes[st.failScene]) {
      errors.push(`stat "${st.id}" failScene "${st.failScene}" does not exist`);
    }
  }

  // 1) reachability
  const edges = {};
  const addEdge = (a, b) => {
    if (!scenes[a] || !scenes[b]) return;
    (edges[a] ||= []).push(b);
  };
  for (const [id, scene] of Object.entries(scenes)) {
    if (!scene || typeof scene !== "object") continue;
    if (isEnding(scene)) continue;
    for (const ch of scene.choices || []) addEdge(id, ch.next);
    for (const st of data.stats || []) {
      if (st.failScene) addEdge(id, st.failScene);
    }
  }
  const start = data.startScene;
  if (!scenes[start]) {
    errors.push(`startScene "${start}" does not exist`);
  } else {
    const reachable = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of edges[cur] || []) {
        if (!reachable.has(n)) {
          reachable.add(n);
          queue.push(n);
        }
      }
    }
    for (const id of sceneIds) {
      if (!reachable.has(id)) warnings.push(`scene ${id} is NOT reachable from startScene`);
    }

    // 2+3) shortest path to any ending (minimising estimatedMinutes weight)
    // node-weighted Dijkstra
    const END = "__END__";
    const dist = new Map();
    dist.set(start, 0);
    const node = { [start]: { w: sceneWords(scenes[start]), isEnd: isEnding(scenes[start]), decisions: isDecision(scenes[start]) ? 1 : 0 } };
    for (const id of sceneIds) {
      if (id === start) continue;
      node[id] = {
        w: sceneWords(scenes[id]),
        isEnd: isEnding(scenes[id]),
        decisions: isDecision(scenes[id]) ? 1 : 0,
      };
    }
    const relax = () => {
      // simple priority queue via array (story graphs are small, < 200 nodes)
      const queue = [[0, start, { words: node[start].w, scenes: 1, decisions: node[start].decisions, path: [start] }]];
      const visited = new Set();
      let best = null;
      while (queue.length) {
        queue.sort((a, b) => a[0] - b[0]);
        const [, cur, info] = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        if (node[cur].isEnd) {
          if (!best || info.words < best.words || (info.words === best.words && info.decisions < best.decisions)) {
            best = info;
          }
          continue;
        }
        for (const nxt of edges[cur] || []) {
          if (visited.has(nxt)) continue;
          const nInfo = {
            words: info.words + node[nxt].w,
            scenes: info.scenes + 1,
            decisions: info.decisions + node[nxt].decisions,
            path: [...info.path, nxt],
          };
          const weight = nInfo.words / 200 + nInfo.decisions * 0.75;
          queue.push([weight, nxt, nInfo]);
        }
      }
      return best;
    };
    const best = relax();
    if (!best) {
      errors.push("no ending is reachable from startScene");
    } else {
      const estimatedMinutes = Math.round(best.words / 200 + best.decisions * 0.75);
      var metrics = {
        shortestPathWords: best.words,
        shortestPathScenes: best.scenes,
        shortestPathDecisions: best.decisions,
        estimatedMinutes,
        shortestPath: best.path,
        decisionScenes: sceneIds.filter((id) => isDecision(scenes[id])).length,
      };
      if (!allowShort) {
        if (best.scenes < 32) {
          errors.push(`shortest path has ${best.scenes} scenes, needs >= 32`);
        }
        if (best.decisions < 20) {
          errors.push(`shortest path has ${best.decisions} decision scenes, needs >= 20`);
        }
        if (best.words < 3600) {
          errors.push(`shortest path has ${best.words} words, needs >= 3600`);
        }
        if (estimatedMinutes < 30) {
          errors.push(`computed estimatedMinutes ${estimatedMinutes} < 30`);
        }
      }
    }
  }

  // 4) endings
  const endingKinds = [];
  for (const [id, scene] of Object.entries(scenes)) {
    if (isEnding(scene)) {
      endingKinds.push(scene.ending.kind);
    }
  }
  if (!endingKinds.length) errors.push("no ending scenes");
  const distinctKinds = [...new Set(endingKinds)];
  if (!endingKinds.includes("failure")) errors.push('no ending kind "failure"');
  if (!endingKinds.includes("triumph")) errors.push('no ending kind "triumph"');
  if (!allowShort && distinctKinds.length < 3) {
    errors.push(`only ${distinctKinds.length} distinct ending kind(s) - need >= 3`);
  }
  if (endingKinds.length === 0) { errors.push('need at least one ending kind'); }

  // 5) decision scenes
  const decisionScenes = sceneIds.filter((id) => isDecision(scenes[id]));
  const decisionsWithLogic = decisionScenes.filter((id) =>
    (scenes[id].choices || []).some((ch) => ch.logic && ch.logic.why && ch.logic.why.trim().length >= 30)
  );
  if (!allowShort && decisionScenes.length > 0) {
    const ratio = decisionsWithLogic.length / decisionScenes.length;
    if (ratio < 0.6) {
      errors.push(`only ${decisionsWithLogic.length}/${decisionScenes.length} decision scenes have a logic rating with why - need >= 60%`);
    }
  }
  for (const id of decisionScenes) {
    const n = (scenes[id].choices || []).length;
    if (n < 2 || n > 4) {
      errors.push(`decision scene ${id} has ${n} choices - must have 2-4`);
    }
  }

  const cleanErrors = [...new Set(errors.filter(Boolean))];
  const metricsOut = metrics || {
    shortestPathWords: null,
    shortestPathScenes: null,
    shortestPathDecisions: null,
    estimatedMinutes: null,
    shortestPath: [],
    decisionScenes: decisionScenes.length,
  };
  if (allowShort && metricsOut.estimatedMinutes == null) {
    metricsOut.estimatedMinutes = null;
  }
  return { ok: cleanErrors.length === 0, errors: cleanErrors, warnings: [...new Set(warnings)], metrics: metricsOut, distinctEndingKinds: distinctKinds, totalEndings: endingKinds.length };

  function isDecision(scene) {
    return Array.isArray(scene && scene.choices) && scene.choices.length >= 2;
  }
}

// ---------- repo-level validation ----------
export function validateManifestEntry(entry, storyData, manifest, options = {}) {
  const problems = [];
  if (!storyData) return { ok: false, problems: ["story file missing or unparseable"] };
  if (entry.id !== storyData.id) problems.push(`manifest id "${entry.id}" != story id "${storyData.id}"`);
  if (entry.title !== storyData.title) problems.push(`manifest title mismatch for ${entry.id}`);
  if (entry.subtitle !== storyData.subtitle) problems.push(`manifest subtitle mismatch for ${entry.id}`);
  if (entry.publishDate !== storyData.publishDate) problems.push(`manifest publishDate mismatch for ${entry.id}`);
  if (entry.difficulty !== storyData.difficulty) problems.push(`manifest difficulty mismatch for ${entry.id}`);
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
    problems.push(`estimatedMinutes missing/invalid for ${entry.id}`);
  }
  if (JSON.stringify(entry.tags.slice().sort()) !== JSON.stringify([...storyData.tags].sort())) {
    problems.push(`tags mismatch for ${entry.id}`);
  }
  return { ok: problems.length === 0, problems };
}
