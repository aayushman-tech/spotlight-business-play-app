# Boardroom Logic (Windows Desktop App)

[![Validate & Release](https://github.com/aayushman-tech/boardroom-logic-app/actions/workflows/release.yml/badge.svg)](https://github.com/aayushman-tech/boardroom-logic-app/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Boardroom Logic** is a free Windows desktop interactive business reasoning game built for the Microsoft Store. As an executive, you face corporate crises, balance sheet trade-offs, and strategic dilemmas. Every scenario tests logical thinking: opportunity cost, sunk cost fallacies, unit economics, and data interpretation.

New episodes arrive dynamically from our sister repository, [boardroom-logic-stories](https://github.com/aayushman-tech/boardroom-logic-stories), without requiring app updates.

---

## Key Highlights

- **Dynamic Story Hub:** Launching the app fetches the latest published story from GitHub as "Today's Story", alongside a full playable archive.
- **Corporate In-Box Arrival System:** Information arrives as realistic emails, memos, phone calls, reports, and news alerts.
- **Interactive Exhibits:** Native SVG charts, balance sheet tables, and real-time KPI monitors embedded directly in each scene.
- **Executive Debrief:** Every story culminates in a logic score (0–100), corporate rank (Intern to CEO), bias breakdown, and strategic takeaways.
- **100% Free & Private:** No accounts, no ads, no trackers, and no telemetry. All progress is saved strictly on your local computer.
- **Offline Capable:** Offline caching with bundled fallback story (`vendor/demo.json`) ensures the app works anywhere.

---

## Tech Stack & Architecture

- **Runtime:** Electron (v33+) + Node 20+
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
boardroom-logic-app/
├── .github/workflows/
│   └── release.yml            # CI: builds EXE + AppX and publishes GitHub release on tags
├── build/
│   ├── icon.ico, icon.png     # Windows application icon assets
│   ├── store-identity.json    # Store package identity config (Name, Publisher CN)
│   └── store/                 # Microsoft Store tile & splash screen assets
├── docs/
│   └── index.html             # Hosted privacy policy for GitHub Pages
├── scripts/
│   ├── build-store-package.js # Builds unsigned AppX/MSIX package for Store submission
│   ├── make-icons.mjs         # Generates ICO and PNG assets from SVG
│   └── take-screenshots.mjs   # Captures 1600x900 screenshots with Playwright
├── src/
│   ├── config.js              # Central application configuration
│   ├── preload.js             # Secure isolated IPC bridge
│   ├── engine/                # Pure logic engine, schema, and validator
│   ├── main/                  # Electron main process (network, storage, window)
│   └── renderer/              # UI components, styles, audio, SVG charts
├── store/
│   ├── LISTING.md             # Microsoft Store copy, keywords, and description
│   └── screenshots/           # Real 1600x900 screenshots for Store submission
├── tests/
│   ├── engine.test.mjs        # Engine unit test suite (18 comprehensive tests)
│   └── electron-smoke.test.mjs# End-to-end Electron Playwright test
├── vendor/
│   └── demo.json              # Bundled starter story for first-launch offline play
├── PRIVACY.md                 # Full privacy disclosure
└── STORE_SUBMISSION.md        # First-time publisher guide for Partner Center
```

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+ (LTS)
- npm 10+
- Windows 10 (1809+) or Windows 11, x64

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the App Locally
```bash
npm start
```

### 3. Run Unit & Smoke Tests
```bash
npm test                # Pure engine unit tests
npm run test:smoke      # End-to-end Electron smoke test
```

---

## Packaging for Windows & Microsoft Store

### A. Windows EXE Installer (NSIS)
Produces a silent-installable NSIS installer in `release/`:
```bash
npm run build:exe
```
Output: `release/BoardroomLogic-Setup-1.0.0-x64.exe`  
Supports silent install via `/S` flag.

### B. Microsoft Store Package (MSIX / AppX)
Produces a standard Windows Store package in `release/`:
```bash
npm run build:store
```
Output: `release/BoardroomLogic-1.0.0-x64.appx`

For publishing instructions and Partner Center identity configuration, see [STORE_SUBMISSION.md](STORE_SUBMISSION.md).

---

## Privacy Policy

Boardroom Logic respects player privacy completely. No analytics, tracking, or personal data collection occurs.
- Read the text policy: [PRIVACY.md](PRIVACY.md)
- Web version for Microsoft Store: [https://aayushman-tech.github.io/boardroom-logic-app/](https://aayushman-tech.github.io/boardroom-logic-app/)

---

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
