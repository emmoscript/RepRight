#!/usr/bin/env node
/**
 * Compare rep COUNT events in logs/session-live.log to ground-truth expected count.
 *
 * Usage:
 *   node scripts/eval-session-log.cjs
 *   node scripts/eval-session-log.cjs --expected 5
 *   node scripts/eval-session-log.cjs --file logs/session-live.log --expected 8
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_LOG = path.join(ROOT, 'logs', 'session-live.log');

function parseArgs(argv) {
  let file = DEFAULT_LOG;
  let expected = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) {
      file = path.resolve(argv[++i]);
    } else if (argv[i] === '--expected' && argv[i + 1]) {
      expected = Number(argv[++i]);
    }
  }
  return { file, expected };
}

function extractCounts(text) {
  const lines = text.split(/\r?\n/);
  const counts = [];
  for (const line of lines) {
    if (!line.includes('rep') || !line.includes('COUNT')) continue;
    const m = line.match(/\[([^\]]+)\].*COUNT \| reps=(\d+)/);
    if (!m) continue;
    const detail = line.split('COUNT | ')[1] ?? '';
    counts.push({ time: m[1], reps: Number(m[2]), detail: detail.trim() });
  }
  return counts;
}

/** One row per `session lift_started` block (multi-set tempo runs). */
function extractSetSessions(text) {
  const lines = text.split(/\r?\n/);
  const sessions = [];
  let current = { index: 1, liftAt: null, counts: [] };

  const pushCurrent = () => {
    if (current.liftAt == null && current.counts.length === 0) return;
    sessions.push({ ...current, detected: current.counts.length });
    current = { index: sessions.length + 1, liftAt: null, counts: [] };
  };

  for (const line of lines) {
    if (line.includes('session') && line.includes('lift_started')) {
      pushCurrent();
      const t = line.match(/\[([^\]]+)\]/);
      current.liftAt = t ? t[1] : null;
      continue;
    }
    if (!line.includes('rep') || !line.includes('COUNT')) continue;
    const m = line.match(/\[([^\]]+)\].*COUNT \| reps=(\d+)/);
    if (!m) continue;
    const detail = line.split('COUNT | ')[1] ?? '';
    current.counts.push({ time: m[1], reps: Number(m[2]), detail: detail.trim() });
  }
  pushCurrent();
  return sessions;
}

function main() {
  const { file, expected } = parseArgs(process.argv);
  if (!fs.existsSync(file)) {
    console.error(`[eval-session-log] File not found: ${file}`);
    console.error('Run a live session with npm run log:session first.');
    process.exit(1);
  }

  const text = fs.readFileSync(file, 'utf8');
  const counts = extractCounts(text);
  const sessions = extractSetSessions(text);
  const detected = counts.length;
  const lastRep = counts[counts.length - 1]?.reps ?? 0;

  console.log('[eval-session-log] Rep count evaluation');
  console.log(`  Log file:     ${file}`);
  console.log(`  COUNT events: ${detected} (all sets)`);
  console.log(`  Last reps=   ${lastRep}`);

  if (sessions.length > 0) {
    console.log('\n  Per set (split on session lift_started):');
    for (const s of sessions) {
      const last = s.counts[s.counts.length - 1]?.reps ?? 0;
      console.log(`    Set ${s.index}: ${s.detected} COUNT(s), last reps=${last}${s.liftAt ? `  @ ${s.liftAt}` : ''}`);
    }
  }

  if (counts.length > 0 && sessions.length <= 1) {
    console.log('\n  Events:');
    for (const c of counts) {
      console.log(`    [${c.time}] reps=${c.reps}  ${c.detail}`);
    }
  }

  if (expected != null && Number.isFinite(expected)) {
    if (sessions.length > 1) {
      let allOk = true;
      console.log(`\n  Ground truth per set: ${expected}`);
      for (const s of sessions) {
        const err = Math.abs(s.detected - expected);
        const ok = s.detected === expected;
        if (!ok) allOk = false;
        console.log(
          `    Set ${s.index}: ${ok ? 'YES ✓' : 'NO ✗'} (detected ${s.detected}, error ${err})`,
        );
      }
      console.log(`  All sets match: ${allOk ? 'YES ✓' : 'NO ✗'}`);
      process.exit(allOk ? 0 : 1);
    }
    const err = Math.abs(detected - expected);
    const acc = Math.max(0, 1 - err / Math.max(expected, 1));
    const ok = detected === expected;
    console.log(`\n  Ground truth: ${expected}`);
    console.log(`  Match:        ${ok ? 'YES ✓' : 'NO ✗'} (detected ${detected}, error ${err})`);
    console.log(`  Accuracy:     ${(acc * 100).toFixed(1)}%`);
    process.exit(ok ? 0 : 1);
  }

  console.log('\n  Tip: pass --expected N to compare against your manual count.');
}

main();
