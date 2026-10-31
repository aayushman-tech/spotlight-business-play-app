# Microsoft Store Submission Guide for Boardroom Logic

This guide provides complete, step-by-step instructions for publishing **Boardroom Logic** to the Microsoft Store as a first-time publisher.

---

## 1. Choosing Your Submission Route

Microsoft Partner Center supports two publishing routes for Windows desktop apps:

| Feature | Route A: MSIX / APPX Package (RECOMMENDED) | Route B: Win32 EXE Installer (Alternative) |
|---|---|---|
| **Submission Format** | Upload `BoardroomLogic-1.0.0-x64.appx` directly | Provide permanent download URL for EXE installer |
| **Code Signing Certificate** | **NOT REQUIRED!** The Microsoft Store automatically signs your package with Microsoft's trusted certificate upon ingestion. | **MANDATORY.** Microsoft requires the EXE installer to be signed by a trusted Certificate Authority (CA) such as DigiCert or Sectigo. Unsigned EXEs are rejected. |
| **Updates** | Automatic background updates through Microsoft Store | Managed by the installer / app |
| **Recommendation** | **Strongly Recommended** for indie developers & first-time publishers who don't already have an expensive EV/OV code signing certificate. | Use only if you have an active Authenticode CA certificate. |

---

## 2. Setting Up Microsoft Partner Center

1. **Register as a Windows App Developer:**
   - Go to [Microsoft Partner Center](https://partner.microsoft.com/dashboard).
   - Sign in with your Microsoft Account and register for an individual or company developer account.
   - Pay the one-time registration fee (approx. \$19 USD for individual accounts).

2. **Reserve the App Name:**
   - In Partner Center dashboard, navigate to **Apps and games** > **New product**.
   - Select **MSIX or PWA app** (or **Windows app**).
   - Enter your app name: `Boardroom Logic`.
   - Click **Check availability** and then **Reserve product name**.

---

## 3. Configuring App Identity for MSIX (`build/store-identity.json`)

Once the product name is reserved, Microsoft assigns a unique package identity:

1. In Partner Center, go to your app > **Product management** > **Package identity**.
2. Note the three values:
   - **Package/Identity/Name** (e.g., `12345YourName.BoardroomLogic`)
   - **Package/Identity/Publisher** (e.g., `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`)
   - **Package/Properties/PublisherDisplayName** (e.g., `Your Publisher Name`)
3. Open `build/store-identity.json` in this repository and replace the placeholders:
   ```json
   {
     "identityName": "PASTE_PACKAGE_IDENTITY_NAME_HERE",
     "publisher": "PASTE_PUBLISHER_CN_HERE",
     "publisherDisplayName": "PASTE_PUBLISHER_DISPLAY_NAME_HERE"
   }
   ```
4. Rebuild the Store package:
   ```bash
   npm run build:store
   ```
   This generates the final `release/BoardroomLogic-1.0.0-x64.appx` matching your Store identity.

---

## 4. Step-by-Step Submission Walkthrough (Route A - MSIX)

In Partner Center under **Submissions**, click **Start your submission**:

### A. Pricing and Availability
- **Base price:** Free
- **Markets:** All markets (worldwide)
- **Discoverability:** Publicly available in the Store search

### B. Properties
- **Category:** Games > Simulation (or Education > Business)
- **Subcategory:** Strategy / Puzzle
- **Privacy policy URL:**
  `https://aayushman-tech.github.io/boardroom-logic-app/`
- **Website:** `https://github.com/aayushman-tech/boardroom-logic-app`
- **Support contact:** `https://github.com/aayushman-tech/boardroom-logic-app/issues`

### C. Age Ratings (IARC Questionnaire)
- Complete the International Age Rating Coalition (IARC) questionnaire:
  - Violence: No
  - Bad language: No
  - Controlled substances / drugs: No
  - Gambling / Simulated gambling: No
  - User interaction / Chat: No
  - Shares user location: No
- **Result:** ESRB Everyone (E) / PEGI 3 / USK 0 / IARC 3+.

### D. Store Listing
Refer to `store/LISTING.md` for pre-formatted copy:
- **Title:** Boardroom Logic
- **Short description:** Paste from `store/LISTING.md`
- **Full description:** Paste from `store/LISTING.md`
- **Features:** Paste the 6 bullet points
- **Search terms / Keywords:** `business simulation`, `logic puzzle`, `corporate drama`, `decision making`, `strategy`, `case study`
- **Screenshots:**
  Upload all images from `store/screenshots/`:
  - `01-home.png` (Home Screen / Story Hub)
  - `02-intro.png` (Premise & Characters)
  - `03-play.png` (Interactive Arrival & Exhibit)
  - `04-feedback.png` (Decision & Feedback)
  - `05-settings.png` (Themes & Accessibility)

### E. Packages
- Drag and drop `release/BoardroomLogic-1.0.0-x64.appx` into the package upload area.
- Partner Center will validate the package schema, identity, and icons.

### F. Submit to the Store
- Review the summary.
- Click **Submit to the Store**. Certification typically takes 24–72 hours.

---

## 5. Alternative: Submitting via Route B (Win32 EXE Installer)

If you decide to submit the EXE installer:
1. In Partner Center, select **New product** > **Win32 app**.
2. **Installer URL:** You must provide a direct, permanent HTTPS download link:
   `https://github.com/aayushman-tech/boardroom-logic-app/releases/download/v1.0.0/BoardroomLogic-Setup-1.0.0-x64.exe`
3. **Silent install parameter:** `/S`
4. **Silent uninstall parameter:** `/S`
5. **Code Signing Notice:** The uploaded EXE must be digitally signed by a trusted CA. If it is unsigned, certification will fail with a signature validation error.
