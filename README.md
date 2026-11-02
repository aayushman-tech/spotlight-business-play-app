# Spotlight Business Play (Windows Desktop App)

[![Validate & Release](https://github.com/aayushman-tech/spotlight-business-play-app/actions/workflows/release.yml/badge.svg)](https://github.com/aayushman-tech/spotlight-business-play-app/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Spotlight Business Play** is a free Windows desktop 90s-style choose-your-path business adventure game built for the Microsoft Store. As an entrepreneur or executive, you face authentic strategy trade-offs, product decisions, and high-stakes crises. Every decision tests logical reasoning: opportunity costs, pricing discipline, channel strategy, and product vision.

New episodes arrive dynamically from our sister repository, [spotlight-business-play-stories](https://github.com/aayushman-tech/spotlight-business-play-stories), without requiring app updates.

---

## Key Highlights

- **90s Gamebook Gameplay:** Immediate scene transitions (no interruption modals), clear A/B/C/D choices with keyboard shortcuts (keys 1-4).
- **Single Winning Spine:** Exactly one chain of sound decisions leads to the breakthrough comeback.
- **Quick-Lose Branches (GAME OVER):** Flawed decisions branch into quick 1-4 scene pitfalls with an actionable breakdown of the business principle violated.
- **Clean One-Line Header & Story List:** Vertical numbered list (1, 2, 3...) of available stories with completion badges and big Play buttons.
- **100% Free & Private:** No accounts, no ads, no trackers, and no telemetry. All progress is saved strictly on your local computer.
- **Offline Capable:** Offline caching with bundled default story (`assets/default-story.json`) ensures the app works anywhere.
- **Full Store Compliance:** Complete set of 56 custom AppX tile assets in `build/appx/` matching `#0e172e` background color, preventing default placeholder icon rejections.

---

## Tech Stack & Architecture

- **Runtime:** Electron (v33+) + Node 22+
- **Frontend:** Pure HTML5, CSS3, and ES Modules. Zero heavyweight frontend frameworks.
- **Pure Game Engine:** Located in `src/engine/engine.mjs` with zero DOM or Electron dependencies, allowing pure unit testing via Node's test runner.
- **Hardened Electron Security:**
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - Strict Content-Security-Policy (CSP)
  - Minimal `preload.js` exposing only strictly typed IPC channels
  - Renderer network requests are blocked at session level
  - External links open in default OS browser only after allow-list validation
  - All dynamic story text is rendered using safe `textContent` (never `innerHTML`)
- **Single Config:** Game title and story repo URLs are centralized in `src/config.js`.

---

## Repository Structure

```
spotlight-business-play-app/
├── .github/workflows/
│   └── release.yml            # CI: builds EXE + AppX and publishes GitHub release on tags
├── assets/
│   └── default-story.json     # Bundled offline default story (Garage to Glory)
├── build/
│   ├── appx/                  # 56 custom AppX tile & splash assets for Microsoft Store
│   ├── icon.ico, icon.png     # Windows application icon assets
│   ├── store-identity.json    # Store package identity config (Name, Publisher CN)
│   └── logo.svg               # Original SVG source vector
├── docs/
│   └── index.html             # Hosted privacy policy for GitHub Pages
├── release/                   # Build artifacts (EXE and APPX)
├── scripts/
│   ├── build-store-package.js # Builds unsigned AppX/MSIX package for Store submission
│   └── play-trace.mjs         # Trace script executing winning and losing paths
├── src/
│   ├── config.js              # Central application configuration
│   ├── preload.js             # Secure isolated IPC bridge
│   ├── engine/                # Pure logic engine, schema v2, and validator v2
│   ├── main/                  # Hardened main process
│   └── renderer/              # Game UI, styles, charts, and controller
├── store/
│   ├── LISTING.md             # Store copy, category, and keywords
│   ├── screenshots/           # 1366x768 gameplay screenshots
│   └── *.png                  # Store logo (300x300), box art (1080x1080), poster (720x1080)
└── tests/
    ├── engine.test.mjs        # 14 pure unit tests for engine & validator
    └── electron-smoke.test.mjs# Playwright smoke test verifying boot, gameplay, win/lose, screenshots
```

---

## Development

```bash
# Run unit tests
npm test

# Run trace script across winning spine and 4 losing branches
node scripts/play-trace.mjs

# Run Playwright end-to-end smoke test
node --test tests/electron-smoke.test.mjs

# Build Win32 EXE installer
npm run build:exe

# Build Microsoft Store APPX/MSIX package
npm run build:store
```

---

## License

MIT License - see [LICENSE](LICENSE).
