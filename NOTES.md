# Work log

Both Claudes write here. Newest entry at the top. One or two lines each:
date, who (the human's name), what changed, and anything left unfinished.
Read the top few entries before you start; add yours before you push.

## In progress

Write here what you are in the middle of, so the other person does not start the same thing.
Remove your line when it ships.

- (nothing right now)

## Log

- 2026-11-16 · Solomon · Over-the-air updates: added expo-updates (fingerprint runtime, channel production) and a check when the app opens; the builds repo now publishes an OTA on every push next to the TestFlight build. scripts/whats-new.cjs now pulls the other person's commits by itself, merges when you both committed, and reports builds that finish, fail or get replaced. OTAs only reach builds made after this commit.
- 2026-11-16 · Solomon · New app icon: CTeen logo over a Great Neck harbor sunset (Stepping Stones Lighthouse, sailboat). Drawn by scripts/gen-icon.cjs; edit that script and re-run it rather than editing icon.png by hand.
- 2026-11-16 · Solomon · Added README.md (setup guide for a new teammate), scripts/whats-new.cjs + .claude/settings.json so each Claude is told about the other person's new commits automatically. Builds now run in the public repo theprojectmaker/cteen-gn-builds.
- 2026-11-16 · Solomon · First version: Home, Events, Feed and Chapter tabs; Great Neck events
  sign up in the app, international ones link to the CTeen website; reward challenges as banners
  with join, check-in, streak and leaderboard; leader panel; live banner; Ask the rabbi; glass
  header and tab bar; notification code (not yet tested on a phone). Server is live at
  cteen-gn.pages.dev. Reward prizes are still placeholders for the rabbi to fill in.
