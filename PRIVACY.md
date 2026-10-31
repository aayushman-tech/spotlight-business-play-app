# Privacy Policy for Boardroom Logic

**Effective Date:** October 31, 2026  
**Last Updated:** October 31, 2026

**Boardroom Logic** is a free, standalone desktop business reasoning game developed for Windows. We believe privacy should be absolute, especially in games.

---

### 1. Zero Personal Data Collection
Boardroom Logic does **not** collect, store, transmit, or share any personal data whatsoever:
- **No user accounts or logins:** You never sign in or provide your name, email, or credentials.
- **No analytics or telemetry:** There are no trackers, telemetry SDKs, Google Analytics, Mixpanel, Sentry, or third-party telemetry libraries.
- **No advertisements:** The app contains zero ads, affiliate links, or sponsored tracking scripts.
- **No in-app purchases or payments:** The game is 100% free with no monetization.

---

### 2. Network Activity and GitHub Communication
The application makes only one type of network request:
- **Story Content Sync:** Upon launch or when manually clicking the "Refresh" button, the app queries the public GitHub repository (`https://raw.githubusercontent.com/aayushman-tech/boardroom-logic-stories/`) to retrieve story JSON manifests and stories.
- **Strict Network Sandboxing:** Network requests are executed exclusively in the Electron main process via standard HTTPS GET. The UI renderer process has full network access disabled and cannot communicate with any external servers.
- **No Outgoing Telemetry:** The application transmits no user identifiers, IP logs, gameplay statistics, or device diagnostics to GitHub or any server.

---

### 3. Local Data Storage
All game state is stored strictly on your local computer:
- Game progress, completed stories, logic scores, decision history, and settings (such as light/dark mode preference and motion reduction) are stored locally in the standard Windows application data directory:
  `%APPDATA%\Boardroom Logic\` (e.g., `C:\Users\<Username>\AppData\Roaming\Boardroom Logic\`).
- This data remains exclusively on your device and is never uploaded, synced to the cloud, or shared.
- You can reset or delete this data at any time from the in-game Settings screen by selecting "Reset Progress" or by deleting the directory.

---

### 4. Children's Privacy
Boardroom Logic contains no user data collection, tracking, or inappropriate content, and complies with COPPA and global privacy regulations. It is suitable for all ages.

---

### 5. Open Source and Transparency
The game code and story content repositories are publicly available on GitHub for full community inspection:
- App repository: [https://github.com/aayushman-tech/boardroom-logic-app](https://github.com/aayushman-tech/boardroom-logic-app)
- Stories repository: [https://github.com/aayushman-tech/boardroom-logic-stories](https://github.com/aayushman-tech/boardroom-logic-stories)

---

### 6. Contact
For any questions regarding this Privacy Policy, please open an issue on the GitHub repository:
[https://github.com/aayushman-tech/boardroom-logic-app/issues](https://github.com/aayushman-tech/boardroom-logic-app/issues)
