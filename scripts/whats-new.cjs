// Tells Claude what changed on GitHub since this copy was last updated, so each
// person's Claude notices the other person's work without being asked.
// Runs automatically from .claude/settings.json:
//   - at the start of every Claude session (full report)
//   - before every message (--quiet: only speaks up when there is something new)
// It only reads from GitHub. It never changes your files.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const quiet = process.argv.includes('--quiet');
const root = path.join(__dirname, '..');
const git = (args, ms = 15000) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: ms, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

try {
  // In quiet mode, ask GitHub at most once a minute so messages stay fast.
  const stamp = path.join(root, '.git', 'whats-new-stamp');
  const last = fs.existsSync(stamp) ? fs.statSync(stamp).mtimeMs : 0;
  if (!quiet || Date.now() - last > 60000) {
    try { git(['fetch', '--quiet', 'origin', 'main']); } catch { /* offline: use what we have */ }
    fs.writeFileSync(stamp, '');
  }

  const behind = Number(git(['rev-list', '--count', 'HEAD..origin/main']));
  const ahead = Number(git(['rev-list', '--count', 'origin/main..HEAD']));
  const dirty = git(['status', '--porcelain']).split('\n').filter(Boolean).length;
  const out = [];

  if (behind > 0) {
    out.push(`[CTeen GN shared repo] GitHub has ${behind} new commit${behind === 1 ? '' : 's'} that this copy does not have yet:`);
    out.push('  ' + git(['log', '--format=  - %an, %ar: %s', '-n', '12', 'HEAD..origin/main']));
    const files = git(['diff', '--stat', '--stat-width=100', 'HEAD...origin/main']).split('\n').slice(-12).join('\n');
    if (files) out.push('Files changed:\n' + files);
    out.push(dirty
      ? `There are ${dirty} unsaved local change(s). Before editing anything else: commit them, then run "git pull --rebase origin main".`
      : 'Before editing anything: run "git pull --rebase origin main", then read the top of NOTES.md and tell the user what the other person changed.');
  } else if (!quiet) {
    out.push('[CTeen GN shared repo] This copy is up to date with GitHub.');
  }
  if (ahead > 0 && !quiet) out.push(`This copy has ${ahead} commit(s) that are not on GitHub yet. Pushing to main sends a build to TestFlight.`);

  if (!quiet) {
    // Show what the other person says they are in the middle of.
    let notes = '';
    try { notes = git(['show', 'origin/main:NOTES.md']); } catch { /* no notes yet */ }
    const m = /## In progress\s*\n([\s\S]*?)\n## /.exec(notes);
    const lines = m ? m[1].split('\n').filter((l) => l.trim().startsWith('- ') && !/nothing right now/i.test(l)) : [];
    if (lines.length) out.push('In progress (from NOTES.md on GitHub):\n' + lines.join('\n'));
    out.push('Rules are in CLAUDE.md. Log every change in NOTES.md before pushing.');
  }

  if (out.length) console.log(out.join('\n'));
} catch {
  // Not a git checkout, or git is missing: stay silent rather than break the session.
}
