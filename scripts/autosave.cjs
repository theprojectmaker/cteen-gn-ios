// Uploads everything in this folder to GitHub each time Claude finishes a reply, so the other
// person can always see the newest work, even before it is finished.
// Runs automatically from .claude/settings.json (Stop hook).
//
// It pushes a snapshot to the branch autosave/<your git name>. It never touches main, so it
// never starts a build or an OTA update, and it never changes your files, your branch or your
// commits (the snapshot is made with a separate index). Shipping still happens only when Claude
// pushes to main after the checks in CLAUDE.md pass.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const gitDir = path.join(root, '.git');
const git = (args, env) => execFileSync('git', args, {
  cwd: root, encoding: 'utf8', timeout: 25000, stdio: ['ignore', 'pipe', 'pipe'],
  env: env ? { ...process.env, ...env } : process.env,
}).trim();

try {
  if (!fs.existsSync(gitDir)) process.exit(0);
  const who = (git(['config', 'user.name']) || os.userInfo().username || 'someone')
    .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'someone';
  const branch = `autosave/${who}`;

  // Snapshot HEAD plus every change and new file (respecting .gitignore) without touching the real index.
  const index = path.join(gitDir, 'autosave-index');
  const env = { GIT_INDEX_FILE: index };
  git(['read-tree', 'HEAD'], env);
  git(['add', '-A'], env);
  const tree = git(['write-tree'], env);

  const last = path.join(gitDir, 'autosave-last');
  const head = git(['rev-parse', 'HEAD']);
  const key = `${head} ${tree}`;
  if (fs.existsSync(last) && fs.readFileSync(last, 'utf8') === key) process.exit(0); // nothing new

  const onBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const msg = `Autosave from ${who} (working on ${onBranch}), ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const commit = git(['commit-tree', tree, '-p', head, '-m', msg]);
  git(['push', '--quiet', '--force', '--no-verify', 'origin', `${commit}:refs/heads/${branch}`]);
  fs.writeFileSync(last, key);
} catch {
  // Offline or no access: try again after the next reply. Never block Claude.
}
