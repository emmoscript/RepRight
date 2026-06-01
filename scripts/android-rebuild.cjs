#!/usr/bin/env node
'use strict';

/**
 * Clean prebuild + USB install. Auto-confirms Expo's uncommitted-changes prompt on Windows.
 *   npm run android:rebuild
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const shell = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: opts.inherit ? 'inherit' : 'pipe',
    shell,
    input: opts.input,
    encoding: opts.encoding || 'utf8',
  });
  return r;
}

console.error('[android-rebuild] expo prebuild --clean --platform android');
const prebuild = spawnSync('npx', ['expo', 'prebuild', '--clean', '--platform', 'android'], {
  cwd: root,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell,
  input: process.platform === 'win32' ? 'y\r\n' : 'y\n',
});

if (prebuild.status !== 0) {
  console.error('[android-rebuild] prebuild failed — if prompted about git changes, commit or stash first.');
  process.exit(prebuild.status ?? 1);
}

console.error('[android-rebuild] node scripts/run-expo-android.cjs --usb');
const runAndroid = run('node', ['scripts/run-expo-android.cjs', '--usb'], { inherit: true });
process.exit(runAndroid.status ?? 1);
