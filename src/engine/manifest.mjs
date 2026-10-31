// manifest.mjs - pure manifest selection logic. No DOM, no Electron, no network.

// Normalise a Date or "%Y-%m-%d" or ISO string to "%Y-%m-%d" in LOCAL time.
export function localDateString(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Validity reasons per story id, computed by the caller (hash check + schema check + minAppVersion).
// status is one of: "ok" | "hash_mismatch" | "schema_invalid" | "missing" | "min_app_version"
// Returns a manifest view: { playable: [entries], blocked: [{entry, reason}], unreachable: [], manifest violations }
export function compileManifest(manifest, { appVersion, localDate, storyStatus = {} }) {
  const result = { playable: [], blocked: [], manifestIssues: [] };
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.stories)) {
    result.manifestIssues.push("manifest is missing or has unsupported schemaVersion");
    return result;
  }
  if (manifest.minAppVersion && compareVersions(appVersion, manifest.minAppVersion) < 0) {
    result.manifestIssues.push(
      `manifest needs app ${manifest.minAppVersion} but this app is ${appVersion} - update the app`
    );
  }
  const today = localDateString(localDate);
  const seen = new Set();
  for (const entry of manifest.stories) {
    if (seen.has(entry.id)) {
      result.manifestIssues.push(`duplicate story id "${entry.id}"`);
      continue;
    }
    seen.add(entry.id);
    if (manifest.minAppVersion && compareVersions(appVersion, manifest.minAppVersion) < 0) {
      result.blocked.push({ entry, reason: "min_app_version" });
      continue;
    }
    const status = storyStatus[entry.id] || "ok";
    if (status !== "ok") {
      result.blocked.push({ entry, reason: status });
      continue;
    }
    if (entry.publishDate > today) {
      result.blocked.push({ entry, reason: "not_published_yet" });
      continue;
    }
    result.playable.push(entry);
  }
  // playable: newest first (publishDate desc, id desc as tiebreak)
  result.playable.sort((a, b) =>
    a.publishDate < b.publishDate ? 1 : a.publishDate > b.publishDate ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  );
  result.blocked.sort((a, b) =>
    a.entry.publishDate < b.entry.publishDate ? 1 : a.entry.publishDate > b.entry.publishDate ? -1 : 0
  );
  return result;
}

// Today's Story: newest playable story the player has NOT completed;
// if all playable stories are completed, fall back to newest playable.
export function pickTodaysStory(playable, completedMap) {
  for (const entry of playable) {
    if (!completedMap[entry.id] || !completedMap[entry.id].completed) return entry;
  }
  return playable.length ? playable[0] : null;
}

export function archiveStories(playable) {
  return playable.slice(1); // everything except today's card, newest first
}

export { compareVersions };
