// Keeps both people's folders on the newest code and tells Claude what happened, so each
// person's Claude notices the other person's work without being asked.
// Runs automatically from .claude/settings.json:
//   - at the start of every Claude session (full report)
//   - before every message (--quiet: only speaks up when something changed)
//
// What it does on its own:
//   - Other person pushed, you have no unsaved work: pulls their commits into this folder.
//   - You BOTH committed: puts your commits on top of theirs (a rebase). If the same lines
//     changed it undoes the attempt and says which files clash, so Claude can merge by hand.
//   - You have unsaved edits: changes nothing, says what to do.
//   - Reads the public build repo and reports builds that started, were replaced by a newer
//     push (two pushes close together), failed or finished.
// It never pushes, never deletes work, and only touches files when the folder is clean.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const quiet = process.argv.includes('--quiet');
const root = path.join(__dirname, '..');
const gitDir = path.join(root, '.git');
const BUILDS = 'theprojectmaker/cteen-gn-builds';
const git = (args, ms = 20000) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: ms, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args) => { try { return git(args); } catch { return ''; } };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const older = (file, ms) => !fs.existsSync(file) || Date.now() - fs.statSync(file).mtimeMs > ms;
const out = [];

function syncCode() {
  // Ask GitHub at most once a minute in quiet mode so messages stay fast.
  const stamp = path.join(gitDir, 'whats-new-stamp');
  if (!quiet || older(stamp, 60000)) {
    try { git(['fetch', '--quiet', '--prune', 'origin']); } catch { /* offline: use what we have */ }
    fs.writeFileSync(stamp, '');
  }

  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const busy = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD'].some((f) => fs.existsSync(path.join(gitDir, f)));
  const behind = Number(tryGit(['rev-list', '--count', 'HEAD..origin/main']) || 0);
  const ahead = Number(tryGit(['rev-list', '--count', 'origin/main..HEAD']) || 0);
  const dirty = tryGit(['status', '--porcelain', '--untracked-files=no']).split('\n').filter(Boolean).length;
  const theirs = behind ? tryGit(['log', '--format=  - %an, %ar: %s', '-n', '12', 'HEAD..origin/main']) : '';
  const files = behind ? tryGit(['diff', '--stat', '--stat-width=100', 'HEAD...origin/main']).split('\n').slice(-12).join('\n') : '';
  const tell = 'Read the new NOTES.md entries and tell your human what the other person changed before doing anything else.';

  if (busy) {
    out.push('[CTeen GN] A merge or rebase is half done in this folder. Finish it (fix the conflicts, `git add`, `git rebase --continue`) or undo it (`git rebase --abort`) before anything else, and tell your human.');
    return;
  }
  if (branch !== 'main') {
    if (behind) out.push(`[CTeen GN] You are on branch "${branch}". main on GitHub has ${plural(behind, 'new commit')}:\n${theirs}\nTo bring them into this branch: git rebase origin/main`);
    else if (!quiet) out.push(`[CTeen GN] You are on branch "${branch}". It does not ship until it is merged into main.`);
    return;
  }

  if (behind && dirty) {
    out.push(`[CTeen GN] GitHub has ${plural(behind, 'new commit')} from the other person:\n${theirs}`);
    if (files) out.push('Files changed:\n' + files);
    out.push(`This folder has ${plural(dirty, 'unsaved change')}, so nothing was pulled. Commit your work, then run "git pull --rebase origin main" to merge both. ${tell}`);
  } else if (behind && !ahead) {
    try {
      git(['merge', '--ff-only', '--quiet', 'origin/main']);
      out.push(`[CTeen GN] Pulled ${plural(behind, 'new commit')} from GitHub into this folder:\n${theirs}`);
      if (files) out.push('Files changed:\n' + files);
      out.push(`This folder now has the newest code. ${tell}`);
    } catch {
      out.push(`[CTeen GN] GitHub has ${plural(behind, 'new commit')} but pulling failed. Run "git pull --rebase origin main". ${tell}`);
    }
  } else if (behind && ahead) {
    // Both people committed. Put this folder's commits on top of GitHub's.
    try {
      git(['rebase', '--quiet', 'origin/main'], 60000);
      out.push(`[CTeen GN] You BOTH changed the code. The other person pushed ${plural(behind, 'commit')}:\n${theirs}`);
      out.push(`Merged automatically: this folder's ${plural(ahead, 'commit')} now come after theirs, no clashes. Tell your human both changes are combined. Run the checks in CLAUDE.md again, then push so the next build has both. ${tell}`);
    } catch {
      const clash = tryGit(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
      tryGit(['rebase', '--abort']);
      out.push(`[CTeen GN] You BOTH changed the code, and some of the same lines clash, so it could not be merged automatically. The other person pushed:\n${theirs}`);
      if (clash.length) out.push('Files that clash: ' + clash.join(', '));
      out.push(`Tell your human, then merge by hand: "git pull --rebase origin main", keep both people's intent in each clashing spot, "git add" the files, "git rebase --continue", run the checks, push. ${tell}`);
    }
  } else if (!quiet) {
    out.push('[CTeen GN] This folder has the newest code from GitHub.');
  }

  if (!quiet && ahead && !behind) out.push(`This folder has ${plural(ahead, 'commit')} not on GitHub yet. Pushing to main sends an OTA update and a TestFlight build.`);

  // The other person's unfinished work, uploaded by scripts/autosave.cjs after each Claude reply.
  const me = (tryGit(['config', 'user.name']) || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const remote = tryGit(['branch', '-r', '--no-merged', 'origin/main']).split('\n').map((b) => b.trim()).filter((b) => b && !b.includes('->'));
  const saves = remote.filter((b) => b.startsWith('origin/autosave/') && b !== `origin/autosave/${me}`);
  const seenFile = path.join(gitDir, 'whats-new-autosave.json');
  let seenSaves = {};
  try { seenSaves = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch { /* first run */ }
  for (const b of saves) {
    const sha = tryGit(['rev-parse', b]);
    if (quiet && seenSaves[b] === sha) continue;
    seenSaves[b] = sha;
    const when = tryGit(['log', '-1', '--format=%ar', b]);
    const changed = tryGit(['diff', '--stat', '--stat-width=100', 'origin/main', b]).split('\n').slice(-10).join('\n');
    out.push(`[CTeen GN] ${b.replace('origin/autosave/', '')}'s work in progress (autosaved ${when}, not shipped yet), compared with main:\n${changed || '  (same as main)'}\nTo look at it: git diff origin/main ${b}. Tell your human what they are working on.`);
  }
  fs.writeFileSync(seenFile, JSON.stringify(seenSaves));

  if (!quiet) {
    const others = remote.filter((b) => !b.startsWith('origin/autosave/'));
    if (others.length) out.push('Branches on GitHub not merged into main yet: ' + others.join(', '));
    let notes = '';
    try { notes = git(['show', 'origin/main:NOTES.md']); } catch { /* no notes yet */ }
    const m = /## In progress\s*\n([\s\S]*?)\n## /.exec(notes);
    const lines = m ? m[1].split('\n').filter((l) => l.trim().startsWith('- ') && !/nothing right now/i.test(l)) : [];
    if (lines.length) out.push('In progress (from NOTES.md on GitHub):\n' + lines.join('\n'));
    out.push('Rules are in CLAUDE.md. Log every change in NOTES.md before pushing.');
  }
}

// Short sha from a build run ("Build abc1234") -> "Name: subject" from the app's history.
function describe(run) {
  const m = /^Build ([0-9a-f]{7,40})/.exec(run.head_commit?.message || '');
  if (!m) return { sha: '', text: run.event === 'workflow_dispatch' ? 'a manual run' : 'an unknown commit' };
  const who = tryGit(['log', '-1', '--format=%an: %s', m[1]]);
  return { sha: m[1], text: `${m[1]} (${who || 'commit not in this folder yet'})` };
}

async function checkBuilds() {
  const stamp = path.join(gitDir, 'whats-new-builds.json');
  if (quiet && !older(stamp, 120000)) return; // at most every 2 minutes
  let seen = {};
  try { seen = JSON.parse(fs.readFileSync(stamp, 'utf8')); } catch { /* first run */ }
  let runs;
  try {
    const r = await fetch(`https://api.github.com/repos/${BUILDS}/actions/runs?per_page=12`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'cteen-gn-whats-new' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(String(r.status));
    runs = (await r.json()).workflow_runs || [];
  } catch {
    fs.writeFileSync(stamp, JSON.stringify(seen)); // offline or rate limited: try later
    return;
  }

  const first = !Object.keys(seen).length;
  const next = {};
  const lines = [];
  const kind = (run) => (/OTA/i.test(run.name) ? 'OTA update' : 'TestFlight build');
  const active = runs.filter((r) => r.status !== 'completed');

  for (const run of runs) {
    const state = run.status === 'completed' ? run.conclusion : run.status;
    next[run.id] = state;
    if (first || seen[run.id] === state) continue;
    const d = describe(run);
    if (state === 'cancelled') {
      const newer = runs.find((o) => o.name === run.name && o.id !== run.id && new Date(o.created_at) > new Date(run.created_at));
      const nd = newer ? describe(newer) : null;
      let inside = false;
      if (nd && d.sha && nd.sha) { try { git(['merge-base', '--is-ancestor', d.sha, nd.sha]); inside = true; } catch { /* not contained */ } }
      lines.push(`- Two pushes close together: the ${kind(run)} for ${d.text} was skipped because a newer push replaced it` +
        (nd ? `. The newer one (${nd.text}) ${inside ? 'already contains both changes' : 'may NOT contain it; check that commit is on main'}.` : '.'));
    } else if (state === 'failure' || state === 'timed_out') {
      lines.push(`- The ${kind(run)} for ${d.text} FAILED: ${run.html_url}`);
    } else if (state === 'success' && seen[run.id]) {
      lines.push(kind(run) === 'OTA update'
        ? `- OTA update for ${d.text} is live. Phones get it the next time the app is opened twice (download, then switch).`
        : `- TestFlight build for ${d.text} finished; it appears in TestFlight in a few minutes.`);
    } else if (state === 'in_progress' || state === 'queued') {
      lines.push(`- ${kind(run)} ${state === 'queued' ? 'waiting in line' : 'started'} for ${d.text}.`);
    }
  }
  const builds = active.filter((r) => kind(r) === 'TestFlight build');
  if (builds.length > 1) lines.push(`- ${builds.length} TestFlight builds are in line at once (${builds.map((r) => describe(r).text).join('; ')}). Only the running one and the newest waiting one are kept; the newest has everyone's changes.`);
  if (!quiet && !lines.length && active.length) lines.push(...active.map((r) => `- ${kind(r)} ${r.status === 'queued' ? 'waiting' : 'running'} for ${describe(r).text}.`));

  fs.writeFileSync(stamp, JSON.stringify(next));
  if (lines.length) out.push(`[CTeen GN builds] ${first ? 'Current builds' : 'Since the last check'} (https://github.com/${BUILDS}/actions):\n` + lines.join('\n') + '\nTell your human about anything above.');
}

(async () => {
  try {
    if (!fs.existsSync(gitDir)) return;
    syncCode();
    await checkBuilds();
  } catch {
    // git missing or something unexpected: stay silent rather than break the session.
  }
  if (out.length) console.log(out.join('\n'));
})();
