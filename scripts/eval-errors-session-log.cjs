#!/usr/bin/env node
/**
 * Summarize form-error detections and session recordings from logs/session-live.log.
 *
 * Usage:
 *   node scripts/eval-errors-session-log.cjs
 *   node scripts/eval-errors-session-log.cjs --file logs/session-live.log
 *   node scripts/eval-errors-session-log.cjs --labels docs/phase-b-labels.csv
 */

const fs = require('fs');
const path = require('path');
const { parseRrLine } = require('./rr-log-format.cjs');

const ROOT = path.join(__dirname, '..');
const DEFAULT_LOG = path.join(ROOT, 'logs', 'session-live.log');
const ALL_ERRORS = ['ERR_001', 'ERR_002', 'ERR_003', 'ERR_004', 'ERR_005'];

function parseArgs(argv) {
  let file = DEFAULT_LOG;
  let labelsPath = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) {
      file = path.resolve(argv[++i]);
    } else if (argv[i] === '--labels' && argv[i + 1]) {
      labelsPath = path.resolve(argv[++i]);
    }
  }
  return { file, labelsPath };
}

function parseLogSets(text) {
  const lines = text.split(/\r?\n/);
  const sets = [];
  let current = emptySet(1);

  const pushCurrent = () => {
    if (current.liftAt == null && current.counts.length === 0 && current.recorded.length === 0) {
      return;
    }
    sets.push(current);
    current = emptySet(sets.length + 1);
  };

  for (const line of lines) {
    const parsed = parseRrLine(line);
    if (!parsed) continue;

    if (parsed.cat === 'session' && parsed.event === 'lift_started') {
      pushCurrent();
      const t = line.match(/\[([^\]]+)\]/);
      current.liftAt = t ? t[1] : null;
      continue;
    }

    if (parsed.cat === 'rep' && parsed.event === 'COUNT') {
      const reps = Number(parsed.data?.reps);
      if (Number.isFinite(reps)) {
        current.counts.push({ reps, detail: JSON.stringify(parsed.data) });
      }
      continue;
    }

    if (parsed.cat === 'analyzer' && parsed.event === 'recorded') {
      const errorId = parsed.data?.errorId;
      if (typeof errorId === 'string') {
        current.recorded.push({
          errorId,
          rep: Number(parsed.data?.rep) || 0,
          phase: String(parsed.data?.phase ?? ''),
        });
      }
      continue;
    }

    if (parsed.cat === 'analyzer' && parsed.event === 'detected') {
      const errors = Array.isArray(parsed.data?.errors) ? parsed.data.errors : [];
      const phase = String(parsed.data?.phase ?? '');
      for (const errorId of errors) {
        if (typeof errorId !== 'string') continue;
        current.detections.push({ errorId, phase });
        current.detectionCounts[errorId] = (current.detectionCounts[errorId] || 0) + 1;
      }
    }
  }

  pushCurrent();
  return sets;
}

function emptySet(index) {
  return {
    index,
    liftAt: null,
    counts: [],
    recorded: [],
    detections: [],
    detectionCounts: {},
  };
}

function uniqueRecorded(set) {
  const map = new Map();
  for (const r of set.recorded) {
    if (!map.has(r.errorId)) map.set(r.errorId, r);
  }
  return [...map.values()];
}

function parseLabelsCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return rows;

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const setIdx = header.indexOf('set');
  const errIdx = header.indexOf('error_id');
  const expectIdx = header.indexOf('expected');

  if (setIdx === -1 || errIdx === -1 || expectIdx === -1) {
    console.error('[eval-errors] Labels CSV needs columns: set, error_id, expected');
    process.exit(1);
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const expected = cols[expectIdx].toUpperCase();
    if (expected !== 'Y' && expected !== 'N') continue;
    rows.push({
      set: Number(cols[setIdx]),
      errorId: cols[errIdx].toUpperCase(),
      expected: expected === 'Y',
    });
  }
  return rows;
}

function recordedHas(set, errorId) {
  return set.recorded.some((r) => r.errorId === errorId);
}

function main() {
  const { file, labelsPath } = parseArgs(process.argv);
  if (!fs.existsSync(file)) {
    console.error(`[eval-errors] File not found: ${file}`);
    console.error('Run a live session with npm run log:session first.');
    process.exit(1);
  }

  const text = fs.readFileSync(file, 'utf8');
  const sets = parseLogSets(text);

  console.log('[eval-errors] Form error evaluation');
  console.log(`  Log file: ${file}`);
  console.log(`  Sets:     ${sets.length}`);

  if (sets.length === 0) {
    console.log('\n  No lift_started blocks found. Start a set while log:session is running.');
    process.exit(0);
  }

  for (const set of sets) {
    const unique = uniqueRecorded(set);
    const repTotal = set.counts.length;
    const ids = unique.map((r) => r.errorId).sort();
    console.log(`\n  Set ${set.index}${set.liftAt ? ` @ ${set.liftAt}` : ''}`);
    console.log(`    Reps (COUNT): ${repTotal}`);
    console.log(
      `    Recorded (session): ${ids.length ? ids.join(', ') : '(none)'}`,
    );
    if (unique.length > 0) {
      for (const r of unique) {
        console.log(`      ${r.errorId} @ rep ${r.rep || '?'} phase=${r.phase || '?'}`);
      }
    }

    const detKeys = Object.keys(set.detectionCounts).sort();
    if (detKeys.length > 0) {
      console.log(
        `    Live detections (throttled): ${detKeys.map((k) => `${k}×${set.detectionCounts[k]}`).join(', ')}`,
      );
    } else {
      console.log('    Live detections (throttled): (none)');
    }
  }

  if (labelsPath) {
    if (!fs.existsSync(labelsPath)) {
      console.error(`[eval-errors] Labels file not found: ${labelsPath}`);
      process.exit(1);
    }
    const labels = parseLabelsCsv(fs.readFileSync(labelsPath, 'utf8'));
    if (labels.length === 0) {
      console.log('\n  Labels CSV has no data rows.');
      process.exit(0);
    }

    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    let allOk = true;

    console.log('\n  Label comparison (recorded vs expected):');
    for (const row of labels) {
      const set = sets[row.set - 1];
      if (!set) {
        console.log(`    Set ${row.set} ${row.errorId}: SKIP (no log set)`);
        allOk = false;
        continue;
      }
      const app = recordedHas(set, row.errorId);
      const ok = app === row.expected;
      if (!ok) allOk = false;
      if (row.expected && app) tp += 1;
      else if (!row.expected && app) fp += 1;
      else if (row.expected && !app) fn += 1;
      else tn += 1;

      const tag = ok ? 'YES ✓' : 'NO ✗';
      console.log(
        `    Set ${row.set} ${row.errorId}: expected=${row.expected ? 'Y' : 'N'} app=${app ? 'Y' : 'N'} ${tag}`,
      );
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const agreement = (tp + tn) / Math.max(labels.length, 1);

    console.log('\n  Metrics (recorded vs labels):');
    console.log(`    Precision: ${(precision * 100).toFixed(1)}%  Recall: ${(recall * 100).toFixed(1)}%`);
    console.log(`    Agreement: ${(agreement * 100).toFixed(1)}%  (target ≥ 80%)`);
    console.log(`    TP=${tp} FP=${fp} FN=${fn} TN=${tn}`);
    console.log(`  All labels match: ${allOk ? 'YES ✓' : 'NO ✗'}`);
    process.exit(allOk ? 0 : 1);
  }

  console.log('\n  Tip: copy docs/phase-b-labels.template.csv → phase-b-labels.csv and pass --labels');
}

main();
