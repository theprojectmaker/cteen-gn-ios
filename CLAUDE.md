# CTeen GN

iPhone app for **CTeen Great Neck**, the teen chapter at Chabad of Great Neck, NY. Teens see chapter
events, a feed, reward challenges and live banners; the rabbi runs everything from a leader panel
inside the app.

Two people work on this repo, each with their own Claude. **Read this file and `NOTES.md` before
you change anything.**

## The one rule that matters

**Every push to `main` ships, two ways at once:**
1. **OTA update** (`ota-update.yml` in the builds repo): a few minutes after the push, every phone
   that already has the app downloads the new code and switches to it the next time the app is
   opened. This only works for JavaScript changes; it is skipped automatically for builds whose
   native code differs (runtimeVersion policy `fingerprint`), so it can never break an older build.
2. **TestFlight build** (`ios-testflight.yml`): a full new build, in TestFlight 25 to 40 minutes
   later. Needed for native changes (new native packages, app.json changes, icons).

There is no staging step. This repo is private; the build itself runs in a separate public repo,
[theprojectmaker/cteen-gn-builds](https://github.com/theprojectmaker/cteen-gn-builds), which holds
only the build recipe. A push here hands that repo the commit to build. So:

- Only push code that runs. Check it first (see "Before you push").
- A push that only touches `NOTES.md`, `CLAUDE.md`, `README.md` or `server/` does not start a build.
- A build takes about 25 minutes. Pushes made while one is running wait in line; only the newest
  waiting one is kept. That is safe: `main` is one straight line, so the newest commit contains
  both people's changes.

## Noticing the other person's changes (automatic)

`.claude/settings.json` runs `scripts/whats-new.cjs` when a session starts and before every
message. It keeps this folder on the newest code:

- **Other person pushed, this folder has no unsaved edits:** it pulls their commits in by itself.
- **You both committed:** it puts this folder's commits after theirs (a rebase). If the same lines
  clash it undoes the attempt and names the files; then merge by hand (`git pull --rebase origin
  main`, keep both people's intent, `git add`, `git rebase --continue`, run the checks, push).
- **Unsaved edits:** it changes nothing and says so. Commit, then `git pull --rebase origin main`.
- **Builds:** it reads the public builds repo and reports builds and OTA updates that started,
  finished, failed, or were replaced because two pushes landed close together.

**Whenever it prints anything, stop and tell your human what it says (what the other person
changed, a clash, two builds at once, a failed build) before doing anything else.** If you opened
Claude in a parent folder and the notice never appears, run `node scripts/whats-new.cjs` yourself.

## How to work (every session)

1. **Get the latest code first:** `git pull --rebase origin main`
2. Read the top of `NOTES.md` to see what the other person did and what is in progress.
3. Make your change. Keep it small. One idea per push.
4. Run the checks under "Before you push".
5. Add one line to the top of the log in `NOTES.md` (date, who, what changed, anything unfinished).
6. Commit and push to `main`:
   `git add -A && git commit -m "Short description of the change" && git push origin main`
7. Tell your human it has shipped: phones get the OTA update in a few minutes (open the app, then
   open it again), and the TestFlight build shows up about 25 to 40 minutes later.

For anything big or risky (new screens, changing how data is stored, new native packages), use a
branch (`git checkout -b short-name`), push the branch, and merge to `main` only when it works.
Branches do not ship.

If `git push` is rejected, someone else pushed first: `git pull --rebase origin main`, fix any
conflict, run the checks again, then push.

## Run it locally

Needs Node 22 or newer.

```bash
npm install
npm run web
```

That opens the app in a browser. It talks to the real chapter server, so do not sign up for events
or post test content from the leader panel unless you clean it up after. Liquid Glass and
notifications only work in the installed iPhone app, not in the browser.

## Before you push

```bash
npx tsc --noEmit
node scripts/check-sdk.cjs
npx expo export --platform ios --output-dir dist
```

All three must pass. The last one bundles the app for iPhone and catches errors the browser
preview misses. `dist/` is ignored by git.

## Hard rules

- **Never commit keys, tokens, passcodes or `.env` files.** The leader passcode and all signing
  keys live outside this repo on purpose. If you need a secret, ask Solomon.
- **No emojis anywhere in the app.** Use an icon from `src/icons.tsx` (add a new one there if
  needed).
- **Do not make up chapter facts** (dates, prices, prizes, names). Content comes from the rabbi
  through the leader panel.
- Do not change `app.json` identifiers (`bundleIdentifier`, `owner`, `extra.eas.projectId`),
  `eas.json`, `.github/workflows/`, or anything in the build repo without asking Solomon. Those control signing and shipping.
- Adding a package that has native code (anything that is not plain JavaScript) can break the
  build or signing. Ask Solomon first, and install with `npx expo install <name>` so the version
  matches the Expo SDK.
- Do not remove `expo-updates`, or the `runtimeVersion` / `updates` settings in `app.json`, or the
  `channel` in `eas.json`. OTA updates depend on them.
- Keep the Expo SDK at 57. Do not upgrade it as part of another change.
- The app is used by teenagers. Sign-up lists hold first names and grades; do not add anything
  that collects more personal information.

## Where things are

| Path | What it is |
| --- | --- |
| `app/_layout.tsx` | Root stack: the tabs, plus the challenge and account pages that slide in on top; event sheet, leader panel, first-launch welcome |
| `app/(tabs)/_layout.tsx` | Tab bar: Apple's own on iPhone (real Liquid Glass on iOS 26, Feed badge, live banner in its bottom accessory); `src/webTabs.tsx` imitates it on web |
| `app/(tabs)/index.tsx`, `events.tsx`, `feed.tsx`, `chapter.tsx` | One file per tab (expo-router); each wraps a screen from `src/screens.tsx` |
| `app/challenge/[id].tsx`, `app/account.tsx` | Challenge page (`src/rewards.tsx`, photo check-ins via `src/photo.ts`) and account page (`src/account.tsx`) |
| `src/shell.tsx` | Glass header with the Events and account buttons, top live banner (older iOS and web), over-the-air update check |
| `src/screens.tsx` | Home, Events, Feed and Chapter tabs, event sheet |
| `src/rewards.tsx` | Challenge cards, challenge page with photo streaks, leaderboard |
| `src/admin.tsx` | Leader panel (posts, events with audiences, challenges, check-in photos, live banner, sign-ups, inbox) |
| `src/store.tsx` | All data: server calls, saved state on the phone, date helpers |
| `src/ui.tsx`, `src/glass.tsx`, `src/icons.tsx`, `src/theme.ts` | Shared pieces, glass surface, icons, colors |
| `src/push.ts` | Notifications and challenge reminders |
| `src/config.ts` | Address of the chapter server |
| `shared/seed.json` | Starter content, used until a leader saves something |
| `server/` | The chapter server (Cloudflare). Only Solomon can deploy it |
| `.github/workflows/trigger-build.yml` | Hands each push on `main` to the public build repo (OTA + TestFlight) |
| `scripts/whats-new.cjs` | Auto-pulls/merges the other person's work and reports builds |

Design: light theme, CTeen blue `#159FDC`, heavy rounded headings, white cards on a pale
background, floating glass header and tab bar. International events carry an "International"
badge and register on the CTeen website; Great Neck events sign up inside the app.

## Server changes

The app reads and writes through `https://cteen-gn.pages.dev/api`. The code is in
`server/functions/api/[[path]].js`. Pushing changes there does **not** deploy them; only Solomon
can deploy the server. If your app change needs a server change, put both in the repo, note it in
`NOTES.md`, and tell Solomon so the server goes out first.

## If the build fails

Builds show up at https://github.com/theprojectmaker/cteen-gn-builds/actions (anyone can view it).
Open the failed run and read the red step. Fix it and push again. The build log is public, so
never print secrets or personal information during a build. If it failed in "Build the app" or "Send to TestFlight" with a signing or Apple
error, that is Solomon's to fix; write it in `NOTES.md` and tell him.
