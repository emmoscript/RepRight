#!/usr/bin/env node
'use strict';

/**
 * Capture real RepRight screenshots on Android emulator/device.
 *
 * Prerequisites:
 *   1. Metro running: npm run start:lan  (port 8081)
 *   2. Dev build installed on device/emulator
 *
 * Usage:
 *   node scripts/capture-real-screenshots.cjs
 *   node scripts/capture-real-screenshots.cjs --skip-emulator --skip-build
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const OUT_DIR = path.join(root, 'docs', 'screenshots', 'academic');
const PACKAGE = 'com.unibe.repright';
const ACTIVITY = `${PACKAGE}/.MainActivity`;
const AVD = 'Medium_Phone_API_36.0';
const BUNDLE_URL_EMULATOR = 'http://127.0.0.1:8081';

const SCREENS = [
  '01-onboarding',
  '02-home',
  '03-configure-session',
  '04-live-session',
  '05-session-complete',
  '06-paywall',
  '07-stats-free',
  '08-profile-subscription',
  '09-welcome',
];

let selectedSerial = null;

function sdkRoot() {
  return (
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
  );
}

function adbBin() {
  return path.join(sdkRoot(), 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
}

function emulatorBin() {
  return path.join(sdkRoot(), 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator');
}

function adbArgs(args) {
  return selectedSerial ? ['-s', selectedSerial, ...args] : args;
}

function adb(args) {
  return spawnSync(adbBin(), adbArgs(args), { encoding: 'utf8' });
}

function sleep(ms) {
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], {
      stdio: 'ignore',
    });
  } else {
    execFileSync('sleep', [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: 'ignore' });
  }
}

function pruneDevices() {
  const r = adb(['devices']);
  for (const line of (r.stdout || '').split(/\r?\n/).slice(1)) {
    const [serial, state] = line.trim().split(/\s+/);
    if (!serial) continue;
    if (state !== 'device') {
      adb(['disconnect', serial]);
      if (serial.startsWith('emulator-')) adb(['-s', serial, 'emu', 'kill']);
    }
  }
}

function listDevices() {
  pruneDevices();
  return (adb(['devices']).stdout || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((p) => p[0] && p[1] === 'device')
    .map((p) => p[0]);
}

function waitForDevice(timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const devices = listDevices();
    if (devices.length > 0) {
      selectedSerial = devices.find((d) => !d.startsWith('emulator-')) || devices[0];
      const boot = adb(['shell', 'getprop', 'sys.boot_completed']);
      if ((boot.stdout || '').trim() === '1') return selectedSerial;
    }
    sleep(2000);
  }
  throw new Error('Timeout waiting for Android device/emulator');
}

function startEmulator() {
  const emu = emulatorBin();
  if (!fs.existsSync(emu)) throw new Error(`Emulator not found: ${emu}`);
  console.log(`Starting AVD ${AVD}…`);
  const child = spawn(emu, ['-avd', AVD, '-no-snapshot-load'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function metroRunning() {
  try {
    const r = spawnSync('curl.exe', ['-sf', 'http://127.0.0.1:8081/status'], { encoding: 'utf8' });
    return (r.stdout || '').includes('packager-status:running');
  } catch {
    return false;
  }
}

function clearLogcat() {
  adb(['logcat', '-c']);
}

function readLogcat() {
  const r = adb(['logcat', '-d']);
  return r.stdout || '';
}

function waitForLogMarker(marker, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (readLogcat().includes(marker)) {
      sleep(1500);
      return true;
    }
    sleep(1000);
  }
  return false;
}

function setupAdbReverse() {
  adb(['reverse', 'tcp:8081', 'tcp:8081']);
  adb(['reverse', 'tcp:8082', 'tcp:8082']);
}

function launchDevClient() {
  setupAdbReverse();
  adb(['shell', 'am', 'force-stop', PACKAGE]);
  sleep(800);

  const encoded = encodeURIComponent(BUNDLE_URL_EMULATOR);
  const devClientUrl = `exp+repright://expo-development-client/?url=${encoded}`;
  console.log(`Opening dev client → ${BUNDLE_URL_EMULATOR}`);
  adb([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    devClientUrl,
  ]);

  sleep(3000);
  // Fallback if dev-client URL doesn't open the app
  if (!readLogcat().includes('ReactNative')) {
    console.log('Dev-client URL fallback → MainActivity');
    adb(['shell', 'am', 'start', '-n', ACTIVITY]);
  }
}

function bringAppToForeground() {
  adb(['shell', 'am', 'start', '-n', ACTIVITY, '-f', '0x20000000']);
  sleep(600);
}

function openDocScreenshot(id) {
  const url = `repright://doc-screenshot/${id}`;
  adb([
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    url,
    PACKAGE,
  ]);
}

function screencap(outPath) {
  const remote = '/sdcard/repright_doc_cap.png';
  adb(['shell', 'screencap', '-p', remote]);
  const pull = adb(['pull', remote, outPath]);
  if (pull.status !== 0 || !fs.existsSync(outPath)) {
    throw new Error(`screencap failed for ${outPath}`);
  }
  adb(['shell', 'rm', '-f', remote]);
}

/** Reject Expo splash / launcher — real screens are larger and darker. */
function looksLikeValidScreenshot(filePath) {
  const size = fs.statSync(filePath).size;
  if (size < 40_000) return false;
  const buf = fs.readFileSync(filePath);
  // Sample bytes: splash/launcher PNGs are mostly white and compress small
  if (size < 80_000) {
    const sample = buf.subarray(Math.floor(buf.length * 0.3), Math.floor(buf.length * 0.5));
    const whiteish = sample.filter((b) => b > 240).length;
    if (whiteish / sample.length > 0.7) return false;
  }
  return true;
}

function captureScreen(id, attempt = 1) {
  console.log(`Capturing ${id}${attempt > 1 ? ` (retry ${attempt})` : ''}…`);
  clearLogcat();
  bringAppToForeground();
  openDocScreenshot(id);

  const ready = waitForLogMarker(`[DOC_SCREENSHOT_READY] ${id}`, 60_000);
  if (!ready) {
    console.warn(`  ⚠ No ready signal for ${id}`);
  }

  bringAppToForeground();
  sleep(id === '04-live-session' ? 2500 : 1200);

  const outPath = path.join(OUT_DIR, `${id}.png`);
  screencap(outPath);

  if (!looksLikeValidScreenshot(outPath) && attempt < 3) {
    console.warn(`  ⚠ ${id} looks like splash/launcher — retrying after reload…`);
    sleep(5000);
    return captureScreen(id, attempt + 1);
  }

  if (!looksLikeValidScreenshot(outPath)) {
    console.warn(`  ⚠ ${id} may still be splash — check manually`);
  } else {
    console.log(`  ✓ ${id}.png (${Math.round(fs.statSync(outPath).size / 1024)} KB)`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const skipEmulator = argv.includes('--skip-emulator');
  const skipBuild = argv.includes('--skip-build');
  const skipLaunch = argv.includes('--skip-launch');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!fs.existsSync(adbBin())) throw new Error(`adb not found at ${adbBin()}`);

  adb(['start-server']);

  if (listDevices().length === 0 && !skipEmulator) startEmulator();

  console.log('Waiting for Android device…');
  waitForDevice();
  console.log(`Device: ${selectedSerial}`);

  if (!skipBuild) {
    const installed = (adb(['shell', 'pm', 'path', PACKAGE]).stdout || '').includes('package:');
    if (!installed) {
      console.log('Building & installing app…');
      const build = spawnSync('node', [path.join(__dirname, 'run-expo-android.cjs')], {
        cwd: root,
        stdio: 'inherit',
        shell: true,
      });
      if (build.status !== 0) throw new Error('Build failed — run npm run android manually');
    }
  }

  if (!metroRunning()) {
    throw new Error(
      'Metro is not running on :8081. Start it first:\n  npm run start:lan\nThen rerun this script.',
    );
  }
  console.log('Metro OK on :8081');

  clearLogcat();
  if (!skipLaunch) {
    launchDevClient();
    console.log('Waiting for app UI ([DOC_APP_READY])…');
    if (!waitForLogMarker('[DOC_APP_READY]', 180_000)) {
      throw new Error(
        [
          'App did not reach [DOC_APP_READY].',
          '',
          'Common causes:',
          '  • Metro not running → npm run start:lan',
          '  • Dev Client stuck on launcher → open the app manually, pick http://127.0.0.1:8081 (emulator) or your PC LAN IP (phone)',
          '  • Native build outdated (ExpoLocalization crash) → npm run android',
          '',
          'If the app is ALREADY open on the device, rerun with:',
          '  node scripts/capture-real-screenshots.cjs --skip-launch --skip-emulator --skip-build',
        ].join('\n'),
      );
    }
    console.log('App ready — capturing screens…');
  } else {
    console.log('Skipping launch — app must already be open with UI loaded.');
    sleep(2000);
  }

  for (const id of SCREENS) {
    captureScreen(id);
  }

  console.log(`\nDone → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
