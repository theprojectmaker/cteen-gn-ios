# Publish checklist — CTeen GN

Steps to take it from TestFlight to a public App Store release. The ones only Solomon can do are marked **(you)**.

## In the repo (done / automatic)
- [x] Version bumped to **1.1.0** in `app.json` (this push builds it to TestFlight).
- [x] Icon set (`assets/icon.png`), opaque, 1024×1024.
- [x] `ITSAppUsesNonExemptEncryption: false` set, so no export-compliance prompt each build.
- [x] Store listing copy drafted — `docs/app-store-listing.md`.
- [ ] Final once-over of each tab on a real phone in light and dark mode.

## In App Store Connect **(you)**
1. **App record** — confirm the app exists under the right team, bundle id `com.solyapps.cteengn`.
2. **Pick the build** — after this build finishes processing, select 1.1.0 for the App Store version (not just TestFlight).
3. **Listing** — paste name, subtitle, promotional text, description, keywords, What's New from `docs/app-store-listing.md`.
4. **URLs** — set Support URL and Privacy Policy URL (both required). Marketing URL optional.
5. **Screenshots** — 6.7" and 6.1" iPhone sets required. Capture Home, Events, Calendar, Feed, a challenge, the event detail. (I can help script these from the preview if you want.)
6. **Age rating** — fill the questionnaire; 4+. Answer the user-generated-content questions honestly (feed is leader/teen posts, moderated in-app by leaders).
7. **App privacy** — fill the nutrition label using the summary in the listing doc (name/grade/age for App Functionality, no tracking, no ads).
8. **Sign-in with Apple** — already enabled; Apple requires it because the app offers other sign-in. No extra step beyond it working.
9. **Review notes** — give a test account or note that sign-up is name-only, and that the leader panel needs a passcode (don't put the passcode in the public listing; use the App Review notes field if they need it).
10. **Submit for review.**

## Things to decide before submitting
- **Privacy policy page** — the one hard requirement that doesn't exist yet. A short page stating the privacy summary is enough.
- **Support contact** — an email or page for the Support URL.
- **Screenshots** — need a set; can be generated from the app.

## After approval
- The public App Store link goes live within ~24h of approval.
- OTA updates keep shipping JS changes to installed copies; a new native change or version bump still needs a new build + a new App Store version.
