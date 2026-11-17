# CTeen GN

iPhone app for CTeen Great Neck. Two people build it together, each with their own Claude.
**Every push to `main` is built and sent to Solomon's TestFlight automatically** (about 25 to 40
minutes later).

## New here? Set up once (about 10 minutes)

1. **Accept the invite.** GitHub emailed you an invitation to this repository. Accept it.
2. **Install three things** if you do not have them:
   - Git: https://git-scm.com/downloads
   - Node.js 22 or newer: https://nodejs.org
   - Claude Code (the Claude desktop app's Code tab, or the terminal version): https://claude.com/claude-code
3. **Sign Git in to GitHub.** The easiest way is the GitHub CLI (https://cli.github.com):
   ```bash
   gh auth login
   ```
4. **Get the code** (this is "taking the files out"):
   ```bash
   git clone https://github.com/theprojectmaker/cteen-gn-ios.git
   cd cteen-gn-ios
   npm install
   ```
5. **Open that folder in Claude Code.** The first time, Claude asks whether to trust this
   project's settings. Say yes: that is what lets it check GitHub for the other person's changes.

You do not need an Apple developer account, an Expo account, or a Mac.

## Every time you work on it

Just tell Claude what you want changed, in plain words. For example:

> Add a "Bring a friend" note to the event page.

Claude already knows the routine from `CLAUDE.md`, and does all of this for you:

1. Pulls the newest code and tells you what the other person changed.
2. Makes your change and checks that it still builds.
3. Writes a line in `NOTES.md` (the update log) saying what it did.
4. Pushes to GitHub ("putting it back").

The push starts the build. Watch it at
https://github.com/theprojectmaker/cteen-gn-builds/actions. When it turns green, the new
version is in TestFlight a few minutes later.

To see the app while you work: `npm run web` opens it in a browser.

## Getting the app on your phone

Ask Solomon to add your Apple ID email as a TestFlight tester. Install the TestFlight app from
the App Store, accept the email invite, and CTeen GN shows up there with every new build.

## Rules (short version)

- Push only working code. There is no undo once it ships.
- Small changes, pushed often. Use a branch for anything big.
- Never put passwords, keys or tokens in the repo.
- No emojis in the app, and no made-up event dates, prices or prizes.

Full rules and a map of the code: [CLAUDE.md](CLAUDE.md). What has changed lately: [NOTES.md](NOTES.md).
