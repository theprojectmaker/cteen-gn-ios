# Work log

Both Claudes write here. Newest entry at the top. One or two lines each:
date, who (the human's name), what changed, and anything left unfinished.
Read the top few entries before you start; add yours before you push.

## In progress

Write here what you are in the middle of, so the other person does not start the same thing.
Remove your line when it ships.

- (nothing right now)

## Log

- 2026-11-16 · Solomon · REAL LAUNCH-CRASH FIX: removed expo-sqlite. It compiles its own copy of SQLite into the app, which clashes with the system SQLite that expo-updates opens natively at launch, so builds 0121b70 and 383c73d crash on opening (no OTA can fix that). Settings are now a small JSON file via expo-file-system (src/prefs.native.ts). Never add expo-sqlite back while expo-updates is in the app.

- 2026-11-16 · Solomon · Opening animation plays first for everyone again (every launch unless turned off in Settings); the sign-up screen waits until it ends, so only one layer ever opens at a time (app/_layout.tsx introDone).

- 2026-11-16 · Solomon · Launch-crash hardening (34dbc9f): no native calls while the app loads (prefs store loads lazily, dark-mode switch after the first frame), opening animation is a plain overlay and only for people already set up (never two sheets at once), app/_layout.tsx ErrorBoundary shows a "Try again" screen instead of closing. Then: tefillin icon (src/icons.tsx `tefillin`, `challengeIcon()`), wrap window sunrise to sunset in Great Neck worked out daily (src/zmanim.ts; the server enforces the same window and blocks Shabbat; server deployed), header icon pulses only while the window is open, tefillin reminders 7/8 AM, 12/3 PM. Headlines now use Bricolage Grotesque (theme `F.display`, loaded in app/_layout.tsx), bigger card radius, softer shadows.

- 2026-11-16 · Solomon · Tefillin board: small squares, 8 across, starts as 8 x 16 and adds rows when more people join (photo = wrapped, grey = not yet, outline = open spot), with a "Who wrapped" list under it. Snapping a photo now shows it with an optional caption before posting. Tap a photo for its caption and reactions (heart, fire, muscle, clap, raised hands; tap again to undo). Server deployed (react route, captions).

- 2026-11-16 · Solomon · Event details and Feed posts open as Apple card pop-ups (presentation modal, like Carbix); Feed posts open full at app/post/[id].tsx. Tefillin page: grid of everyone in the challenge (photo with time, or a grey slot for not yet / missed / out), tap a photo for a card with comments. Strike rule on the server: each missed day (not Shabbat) resets the streak; 2nd miss adds one extra day to the goal; 3rd miss = out. Welcome screen now uses real chapter photos (assets/welcome) instead of slogans.
- 2026-11-16 · Solomon · One-piece glass header with "Good morning/afternoon/evening, Name" that scrolls with the page; pull to refresh; Friday candle-lighting banner, live countdown in the last hour, Shabbat Shalom banner; pages ease in; opening animation (src/intro.tsx, 4s failsafe); Settings page from the profile picture (app/settings.tsx) with Light/Dark/Match phone (src/theme.ts reads src/prefs*.ts at startup, change restarts the app), haptics, reduce motion, intro toggle; redesigned Tefillin page; new events and Feed posts notify every phone automatically (server); rabbi can make people leaders and see everyone who signed up (leader panel > People & leaders). Sign in with Apple capability is now on the Apple account.
- 2026-11-16 · Solomon · Sign-up is now required (no skip; old skippers go through it again), school question removed, Sign in with Apple added (setup + account page; server verifies Apple tokens). Header: pulsing trophy that opens the Tefillin Challenge with a one-time tip, plus account; Events left the header. Red badges for new Feed posts and new Events on the tab bar, cleared when opened. Needs the Sign in with Apple capability synced on the Apple account before the next build (eas credentials).
- 2026-11-16 · Solomon · Glass header (Challenges, Events, account), footer shortcuts on every page, event details as Apple slide-up sheet (app/event/[id].tsx), Tefillin Challenge is social: sign up with your name, daily photo wall (members only, names and times, comments, rabbi Checked/Hide), leader panel has Simple (6 plain tasks) and Expert modes. Server deployed.
- 2026-11-16 · Solomon · New first-launch setup (src/setup.tsx): welcome screen, then one question per screen (name, school, grade, age, boy/girl, notifications) and a finish screen. School is saved on the account and shows on sign-up lists. Icon maker (scripts/icon) now offers three grown-up options; icon not changed yet.
- 2026-11-16 · Solomon · Big update: calmer Home (quick links at the bottom), Events and account buttons in the header, red badge on Feed for new posts, Tefillin Challenge on its own page with photo check-ins (only leaders see photos, deleted after 30 days; leader panel > Photos), accounts with age and gender (events can be girls/boys only or age-limited), Google linking (works once Solomon adds GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server), Instagram is now @_cteengn, web tab bar is a draggable glass lens. Server deployed.
- 2026-11-16 · Solomon · Tab bar is now Apple's real one (expo-router NativeTabs): Liquid Glass on iOS 26, shrinks on scroll, live banner in the glass bottom accessory. App moved to expo-router: tabs are files in app/. Web preview keeps a frosted bar (src/webTabs.tsx). Not yet seen on a real iPhone.
- 2026-11-16 · Solomon · App is in App Store Connect (ascAppId 6835676158), so every push to main now ships to TestFlight automatically. New icon: CTeen tile with GREAT NECK arched over the C, sticker letters, wavy shoreline. Change it with scripts/icon (node scripts/icon/serve.cjs, open localhost:8177, Save).
- 2026-11-16 · Solomon · Over-the-air updates: added expo-updates (fingerprint runtime, channel production) and a check when the app opens; the builds repo now publishes an OTA on every push next to the TestFlight build. scripts/whats-new.cjs now pulls the other person's commits by itself, merges when you both committed, and reports builds that finish, fail or get replaced. OTAs only reach builds made after this commit.
- 2026-11-16 · Solomon · New app icon: CTeen logo over a Great Neck harbor sunset (Stepping Stones Lighthouse, sailboat). Drawn by scripts/gen-icon.cjs; edit that script and re-run it rather than editing icon.png by hand.
- 2026-11-16 · Solomon · Added README.md (setup guide for a new teammate), scripts/whats-new.cjs + .claude/settings.json so each Claude is told about the other person's new commits automatically. Builds now run in the public repo theprojectmaker/cteen-gn-builds.
- 2026-11-16 · Solomon · First version: Home, Events, Feed and Chapter tabs; Great Neck events
  sign up in the app, international ones link to the CTeen website; reward challenges as banners
  with join, check-in, streak and leaderboard; leader panel; live banner; Ask the rabbi; glass
  header and tab bar; notification code (not yet tested on a phone). Server is live at
  cteen-gn.pages.dev. Reward prizes are still placeholders for the rabbi to fill in.
