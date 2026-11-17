# CTeen GN

iPhone app for **CTeen Great Neck**, the teen chapter at Chabad of Great Neck, NY. Teens see chapter
events, a feed, reward challenges and live banners; the rabbi runs everything from a leader panel
inside the app.

Two people work on this repo, each with their own Claude. **Read this file and `NOTES.md` before
you change anything.**

## The one rule that matters

**Every push to `main` builds the app and sends it to Solomon's TestFlight automatically.**
There is no staging step. This repo is private; the build itself runs in a separate public repo,
[theprojectmaker/cteen-gn-builds](https://github.com/theprojectmaker/cteen-gn-builds), which holds
only the build recipe. A push here hands that repo the commit to build. So:

- Only push code that runs. Check it first (see "Before you push").
- A push that only touches `NOTES.md`, `CLAUDE.md`, `README.md` or `server/` does not start a build.
- A build takes about 25 minutes. Pushes made while one is running wait in line; only the newest
  waiting one is kept.

## Noticing the other person's changes

`.claude/settings.json` runs `scripts/whats-new.cjs` when a session starts and before every
message. When GitHub has commits this copy does not have, it prints who changed what. **When you
see that notice, stop, pull, read the new `NOTES.md` entries, and tell your human what changed
before doing anything else.** It only reads; it never changes files. If you opened Claude in a
parent folder and the notice never appears, run `node scripts/whats-new.cjs` yourself first.

## How to work (every session)

1. **Get the latest code first:** `git pull --rebase origin main`
2. Read the top of `NOTES.md` to see what the other person did and what is in progress.
3. Make your change. Keep it small. One idea per push.
4. Run the checks under "Before you push".
5. Add one line to the top of the log in `NOTES.md` (date, who, what changed, anything unfinished).
6. Commit and push to `main`:
   `git add -A && git commit -m "Short description of the change" && git push origin main`
7. Tell your human the build has started. It shows up in TestFlight about 25 to 40 minutes later.

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
- Keep the Expo SDK at 57. Do not upgrade it as part of another change.
- The app is used by teenagers. Sign-up lists hold first names and grades; do not add anything
  that collects more personal information.

## Where things are

| Path | What it is |
| --- | --- |
| `App.tsx` | App shell: glass header, live banner, floating tab bar |
| `src/screens.tsx` | Home, Events, Feed and Chapter tabs, event sheet |
| `src/rewards.tsx` | Challenge banners, join/check-in sheet, leaderboard |
| `src/admin.tsx` | Leader panel (posts, events, challenges, live banner, sign-ups, inbox) |
| `src/store.tsx` | All data: server calls, saved state on the phone, date helpers |
| `src/ui.tsx`, `src/glass.tsx`, `src/icons.tsx`, `src/theme.ts` | Shared pieces, glass surface, icons, colors |
| `src/push.ts` | Notifications and challenge reminders |
| `src/config.ts` | Address of the chapter server |
| `shared/seed.json` | Starter content, used until a leader saves something |
| `server/` | The chapter server (Cloudflare). Only Solomon can deploy it |
| `.github/workflows/trigger-build.yml` | Hands each push on `main` to the public build repo |

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
