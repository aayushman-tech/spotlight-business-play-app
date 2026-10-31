// src/config.js - THE ONE configuration file for Boardroom Logic.
// Change the game title, the stories source and version behaviour here.

module.exports = {
  // Display name of the game (used in the window title and UI).
  gameTitle: "Boardroom Logic",

  // The public stories repository the app checks on launch.
  stories: {
    owner: "aayushman-tech",
    repo: "boardroom-logic-stories",
    branch: "main",
  },

  // Security: which external URLs may open in the default browser (in-app browsing is never used).
  externalUrlAllowList: [
    "https://github.com/aayushman-tech/**",
    "https://*.github.io/**",
  ],

  // Network behaviour.
  fetch: {
    timeoutMs: 10000,
    cacheBusting: true,
  },

  // Bundled fallback story used when there is no network and no cache yet.
  bundledDemoPath: "vendor/demo.json",

  // Local storage keys (all inside Electron userData; nothing leaves the device).
  storage: {
    manifest: "cache/manifest.json",
    storyDir: "cache/stories",
    profile: "profile.json",
    settings: "settings.json",
  },
};
