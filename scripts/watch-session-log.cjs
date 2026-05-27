#!/usr/bin/env node
'use strict';

/**
 * USB-only fallback: adb logcat → logs/session-live.log
 * Wireless dev: use npm run log:session (HTTP over Wi‑Fi).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ingestLine, writeSessionHeader, LOG_FILE } = require('./rr-log-format.cjs');

function adbPath() {
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (home) {
    const bin = process.platform === 'win32' ? 'adb.exe' : 'adb';
    return path.join(home, 'platform-tools', bin);
  }
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
  }
  return 'adb';
}

function main() {
  writeSessionHeader();
  const adb = adbPath();
  if (process.platform === 'win32' && !fs.existsSync(adb)) {
    console.error(`[log:session:adb] adb not found at ${adb}`);
    process.exit(1);
  }

  console.error('[log:session:adb] USB adb logcat (use npm run log:session for Wi‑Fi)');
  console.error(`[log:session:adb] Writing ${LOG_FILE}\n`);

  const proc = spawn(adb, ['logcat', '-v', 'time', 'ReactNativeJS:V', '*:S'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const handle = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      const pretty = ingestLine(line);
      if (pretty) console.log(pretty);
    }
  };

  proc.stdout.on('data', handle);
  proc.stderr.on('data', (buf) => {
    if (buf.toString().includes('RR|')) handle(buf);
  });

  proc.on('close', (code) => process.exit(code ?? 1));
  process.on('SIGINT', () => {
    proc.kill('SIGINT');
    process.exit(0);
  });
}

main();
