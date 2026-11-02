# Microsoft Store Submission Guide for Spotlight Business Play

This guide provides complete, step-by-step instructions for publishing **Spotlight Business Play** to the Microsoft Store.

---

## 1. Choosing Your Submission Route

Microsoft Partner Center supports two publishing routes for Windows desktop apps:

| Feature | Route A: MSIX / APPX Package (STRONGLY RECOMMENDED) | Route B: Win32 EXE Installer |
|---|---|---|
| **Submission Format** | Upload `SpotlightBusinessPlay-1.1.0-x64.appx` directly in Partner Center | Provide permanent download URL for EXE installer |
| **Code Signing Certificate** | **NOT REQUIRED!** The Microsoft Store automatically signs your package with Microsoft's trusted root certificate upon ingestion. | **MANDATORY.** Microsoft requires the EXE installer to be signed with a certificate chaining up to Microsoft Trusted Root Program (or Microsoft Trusted Signing). Unsigned EXEs are rejected. |
| **Updates** | Automatic background updates through Microsoft Store | Managed by the installer / app |
| **Recommendation** | **Route A is the standard, painless route** for submitting to the Store. | Use Route B only if you already possess a trusted commercial Authenticode CA certificate. |

---

## 2. Setting Up Microsoft Partner Center

1. **Reserve the App Name in Partner Center:**
   > [!IMPORTANT]
   > You must reserve the product name **"Spotlight Business Play"** in Microsoft Partner Center.
   > If you previously reserved an older product name (such as Local Intelligence), that is a different product name. In Partner Center dashboard, go to **Apps and games** > **New product**, select **MSIX or PWA app**, enter **Spotlight Business Play**, and click **Reserve product name**.

2. **Copy Your Unique Package Identity:**
   - In Partner Center, open your new product: **Spotlight Business Play**.
   - Navigate to **Product management** > **Package identity**.
   - Copy the three exact identity fields:
     * **Package/Identity/Name** (e.g. `Spotlight-Aayushman.SpotlightBusinessPlay` or `12345Publisher.SpotlightBusinessPlay`)
     * **Package/Identity/Publisher** (e.g. `CN=03be189a-d8fb-4a26-afaf-e31aed42ab0e` or your developer publisher ID)
     * **Package/Properties/PublisherDisplayName** (e.g. `Spotlight-Aayushman`)
   - Paste these into `build/store-identity.json` in this repo:
     ```json
     {
       "identityName": "Spotlight-Aayushman.SpotlightBusinessPlay",
       "publisher": "CN=03be189a-d8fb-4a26-afaf-e31aed42ab0e",
       "publisherDisplayName": "Spotlight-Aayushman"
     }
     ```
   - Run `npm run build:store` to build `release/SpotlightBusinessPlay-1.1.0-x64.appx`.

---

## 3. Step-by-Step Submission Walkthrough (MSIX / APPX)

1. **Start Submission:**
   - In Partner Center, go to **Spotlight Business Play** > **Start your submission**.

2. **Pricing and Availability:**
   - Set price to **Free**.
   - Select all desired markets (Worldwide recommended).

3. **Properties:**
   - Primary category: **Games** > **Strategy** or **Simulation**.
   - Privacy Policy URL: `https://aayushman-tech.github.io/spotlight-business-play-app/`
   - Support contact: `https://github.com/aayushman-tech/spotlight-business-play-app/issues`

4. **Age Ratings:**
   - Complete the IARC questionnaire. The game has no violence, sexual content, gambling, user-generated content, or personal data collection. It qualifies for all ages (PEGI 3 / ESRB Everyone).

5. **Packages (Upload):**
   - Drag and drop `release/SpotlightBusinessPlay-1.1.0-x64.appx` into the package uploader.
   - Partner Center validates the package. All 56 required unique tile assets with our custom spotlight icon and `#0e172e` tile background are included, resolving any previous icon rejection errors.

6. **Store Listings:**
   - Copy title, description, and search keywords from `store/LISTING.md`.
   - Upload screenshots from `store/screenshots/`:
     * `01-home.png` (Home screen with story list)
     * `02-play.png` (Play scene with narration and choices)
     * `03-game-over.png` (Game Over screen with business reason)
     * `04-win.png` (Celebration screen with takeaways)
     * `05-settings.png` (Settings)
   - Upload logos from `store/`:
     * `logo-300x300.png` (1:1 app tile icon)
     * `poster-720x1080.png` (2:3 poster art)
     * `boxart-1080x1080.png` (1:1 box art)

7. **Submit to the Store:**
   - Review the submission checklist.
   - Click **Submit to the Store**. Certification typically completes in 24–48 hours.
