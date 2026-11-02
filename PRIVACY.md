# Privacy Policy for Spotlight Business Play

**Effective Date:** November 2, 2026  
**Last Updated:** November 2, 2026

**Spotlight Business Play** is a free, standalone desktop business adventure game developed for Windows. We believe privacy should be absolute, especially in games.

---

### 1. Zero Personal Data Collection
Spotlight Business Play does **not** collect, store, transmit, or share any personal data whatsoever:
- **No user accounts or logins:** You never sign in or provide your name, email, or credentials.
- **No analytics or telemetry:** There are no trackers, telemetry SDKs, Google Analytics, Mixpanel, Sentry, or third-party telemetry libraries.
- **No advertisements:** The app contains zero ads, affiliate links, or sponsored tracking scripts.
- **No in-app purchases or payments:** The game is 100% free with no monetization.

---

### 2. Network Activity and GitHub Communication
The application makes only one type of network request:
- **Story Content Sync:** Upon launch or when manually clicking "Check for new stories", the app queries the public GitHub repository (`https://raw.githubusercontent.com/aayushman-tech/spotlight-business-play-stories/`) to retrieve story JSON manifests and stories.
- **Strict Network Sandboxing:** Network requests are executed exclusively in the Electron main process via standard HTTPS GET. The UI renderer process has full network access disabled and cannot communicate with any external servers.
- **No Outgoing Telemetry:** The application transmits no user identifiers, IP logs, gameplay statistics, or device diagnostics to GitHub or any server.

---

### 3. Local Data Storage
All game state is stored strictly on your local computer:
- Game progress, completed stories, in-progress scene markers, and settings (such as light/dark mode preference and font size) are stored locally in the standard Windows application data directory:
  `%APPDATA%\Spotlight Business Play\` (e.g., `C:\Users\<Username>\AppData\Roaming\Spotlight Business Play\`).
- This data remains exclusively on your device and is never uploaded, synced to the cloud, or shared.
- You can reset or delete this data at any time from the in-game Settings screen by selecting "Reset all progress" or by deleting the directory.

---

### 4. Children's Privacy
Spotlight Business Play contains no user data collection, tracking, or inappropriate content, and complies with COPPA and global privacy regulations. It is suitable for all ages.

---

### 5. Open Source and Transparency
The game code and story content repositories are publicly available on GitHub for full community inspection:
- App repository: [https://github.com/aayushman-tech/spotlight-business-play-app](https://github.com/aayushman-tech/spotlight-business-play-app)
- Stories repository: [https://github.com/aayushman-tech/spotlight-business-play-stories](https://github.com/aayushman-tech/spotlight-business-play-stories)

---

### 6. Contact
For any questions regarding this Privacy Policy, please open an issue on the GitHub repository:
[https://github.com/aayushman-tech/spotlight-business-play-app/issues](https://github.com/aayushman-tech/spotlight-business-play-app/issues)
