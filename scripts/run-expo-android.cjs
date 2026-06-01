#!/usr/bin/env node
'use strict';

/**
 * Run `expo run:android` under JDK 17–23 even when Java 24+ is on PATH (Gradle / AGP choke on very new JDKs).
 * Discovers Android Studio “jbr” under common paths + JetBrains Toolbox + Eclipse Adoptium +
 * `C:\Program Files\Java\…` (Oracle-style installs).
 *   node scripts/run-expo-android.cjs
 *   node scripts/run-expo-android.cjs --usb   → adds --device for physical USB / target device
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function javaBin(home) {
  const java = process.platform === 'win32' ? 'java.exe' : 'java';
  return path.join(home, 'bin', java);
}

function javaMajor(javaHome) {
  const bin = javaBin(javaHome);
  if (!fs.existsSync(bin)) {
    return 0;
  }
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const s = `${r.stderr || ''}${r.stdout || ''}`;
  let m = s.match(/version "(\d+)/);
  if (m) {
    return parseInt(m[1], 10);
  }
  m = s.match(/version "1\.(\d+)/);
  if (m) {
    return parseInt(m[1], 10);
  }
  return 0;
}

function jdkOk(home) {
  if (!home) {
    return false;
  }
  const m = javaMajor(home);
  return m >= 17 && m <= 23;
}

function pushUnique(arr, v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s && !arr.includes(s)) {
    arr.push(s);
  }
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** JetBrains Toolbox: .../apps/AndroidStudio/ch-0/<build-id>/jbr */
function pushToolboxAndroidJbr(list) {
  const la = process.env.LOCALAPPDATA || '';
  const root = path.join(la, 'JetBrains', 'Toolbox', 'apps', 'AndroidStudio');
  if (!fs.existsSync(root)) {
    return;
  }
  for (const ch of safeReaddir(root)) {
    if (!ch.isDirectory()) {
      continue;
    }
    const channelDir = path.join(root, ch.name);
    for (const ver of safeReaddir(channelDir)) {
      if (!ver.isDirectory()) {
        continue;
      }
      pushUnique(list, path.join(channelDir, ver.name, 'jbr'));
    }
  }
}

function pushJetBrainsAndroidUnderProgramFiles(list) {
  const pf = process.env.ProgramFiles || '';
  const jb = path.join(pf, 'JetBrains');
  if (!fs.existsSync(jb)) {
    return;
  }
  for (const ent of safeReaddir(jb)) {
    if (!ent.isDirectory()) {
      continue;
    }
    if (!ent.name.toLowerCase().includes('android')) {
      continue;
    }
    pushUnique(list, path.join(jb, ent.name, 'jbr'));
  }
}

function pushEclipseAdoptium(list) {
  const pf = process.env.ProgramFiles || '';
  const base = path.join(pf, 'Eclipse Adoptium');
  if (!fs.existsSync(base)) {
    return;
  }
  for (const ent of safeReaddir(base)) {
    if (!ent.isDirectory()) {
      continue;
    }
    pushUnique(list, path.join(base, ent.name));
  }
}

function pushMicrosoftJdk(list) {
  const pf = process.env.ProgramFiles || '';
  const base = path.join(pf, 'Microsoft');
  if (!fs.existsSync(base)) {
    return;
  }
  for (const ent of safeReaddir(base)) {
    if (!ent.isDirectory() || !/^jdk-/i.test(ent.name)) {
      continue;
    }
    pushUnique(list, path.join(base, ent.name));
  }
}

/** Oracle / classic layout: C:\Program Files\Java\jdk-17, jdk-17.x, etc. */
function pushProgramFilesJava(list) {
  for (const pfBase of [process.env.ProgramFiles || '', process.env['ProgramFiles(x86)'] || '']) {
    const base = path.join(pfBase, 'Java');
    if (!fs.existsSync(base)) {
      continue;
    }
    for (const ent of safeReaddir(base)) {
      if (!ent.isDirectory()) {
        continue;
      }
      pushUnique(list, path.join(base, ent.name));
    }
  }
}

/** `setx REPRIGHT_ANDROID_JDK ...` writes User env — not visible in this process.env until a new shell. */
function reprightAndroidJdkFromWindowsUser() {
  if (process.platform !== 'win32') {
    return '';
  }
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "[Environment]::GetEnvironmentVariable('REPRIGHT_ANDROID_JDK','User')",
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 8000 },
    );
    return (out || '').trim();
  } catch {
    return '';
  }
}

function windowsUserEnv(name) {
  if (process.platform !== 'win32') {
    return '';
  }
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `[Environment]::GetEnvironmentVariable('${name}','User')`,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 8000 },
    );
    return (out || '').trim();
  } catch {
    return '';
  }
}

function sdkLooksValid(sdk) {
  if (!sdk) {
    return false;
  }
  return (
    fs.existsSync(path.join(sdk, 'platform-tools')) ||
    fs.existsSync(path.join(sdk, 'platforms')) ||
    fs.existsSync(path.join(sdk, 'build-tools'))
  );
}

function androidSdkCandidates() {
  const c = [];
  pushUnique(c, process.env.ANDROID_HOME);
  pushUnique(c, process.env.ANDROID_SDK_ROOT);
  pushUnique(c, windowsUserEnv('ANDROID_HOME'));
  pushUnique(c, windowsUserEnv('ANDROID_SDK_ROOT'));
  if (process.platform === 'win32') {
    pushUnique(c, path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'));
  } else if (process.platform === 'darwin') {
    pushUnique(c, path.join(process.env.HOME || '', 'Library', 'Android', 'sdk'));
  } else {
    pushUnique(c, path.join(process.env.HOME || '', 'Android', 'Sdk'));
  }
  return c;
}

function findAndroidSdk() {
  for (const sdk of androidSdkCandidates()) {
    if (sdkLooksValid(sdk)) {
      return sdk;
    }
  }
  return null;
}

/** Gradle reads sdk.dir from android/local.properties (gitignored; recreated each run). */
function ensureLocalProperties(sdk) {
  const androidDir = path.join(root, 'android');
  if (!fs.existsSync(androidDir)) {
    return;
  }
  const sdkForProps = sdk.replace(/\\/g, '/');
  const content = `# Generated by scripts/run-expo-android.cjs — do not commit (see android/.gitignore)\nsdk.dir=${sdkForProps}\n`;
  fs.writeFileSync(path.join(androidDir, 'local.properties'), content, 'utf8');
}

function jdkCandidates() {
  const c = [];
  pushUnique(c, process.env.JAVA_HOME);
  pushUnique(c, process.env.REPRIGHT_ANDROID_JDK);
  pushUnique(c, reprightAndroidJdkFromWindowsUser());
  pushUnique(c, process.env.ANDROID_STUDIO_JBR);
  const plat = process.platform;
  if (plat === 'win32') {
    const la = process.env.LOCALAPPDATA || '';
    const pf = process.env.ProgramFiles || '';
    const pf86 = process.env['ProgramFiles(x86)'] || '';
    pushUnique(c, path.join(la, 'Programs', 'Android', 'Android Studio', 'jbr'));
    pushUnique(c, path.join(la, 'Programs', 'Android', 'Android Studio Preview', 'jbr'));
    pushUnique(c, path.join(pf, 'Android', 'Android Studio', 'jbr'));
    pushUnique(c, path.join(pf, 'Android', 'Android Studio Preview', 'jbr'));
    pushUnique(c, path.join(pf86, 'Android', 'Android Studio', 'jbr'));
    pushToolboxAndroidJbr(c);
    pushJetBrainsAndroidUnderProgramFiles(c);
    pushEclipseAdoptium(c);
    pushMicrosoftJdk(c);
    pushProgramFilesJava(c);
  } else if (plat === 'darwin') {
    pushUnique(c, '/Applications/Android Studio.app/Contents/jbr/Contents/Home');
  }
  return c;
}

function findGradleJdk() {
  for (const h of jdkCandidates()) {
    if (jdkOk(h)) {
      return h;
    }
  }
  return null;
}

function reprightDiagnosticsLines() {
  const paths = [];
  pushUnique(paths, process.env.REPRIGHT_ANDROID_JDK);
  pushUnique(paths, reprightAndroidJdkFromWindowsUser());
  const out = [];
  const seen = new Set();
  for (const p of paths) {
    if (!p || seen.has(p)) {
      continue;
    }
    seen.add(p);
    if (/full[\\/]path[\\/]to/i.test(p)) {
      out.push(
        '[run-expo-android] REPRIGHT_ANDROID_JDK is the README placeholder — set the real JDK root (must contain bin/java.exe).',
      );
      continue;
    }
    const jb = javaBin(p);
    if (!fs.existsSync(jb)) {
      out.push(`[run-expo-android] REPRIGHT_ANDROID_JDK="${p}" is not a JDK home (missing bin\\java.exe).`);
      continue;
    }
    const m = javaMajor(p);
    if (m > 0 && (m < 17 || m > 23)) {
      out.push(`[run-expo-android] REPRIGHT_ANDROID_JDK="${p}" is Java ${m} — use JDK 17, 21, etc. (not 24+).`);
    }
  }
  return out;
}

function adbPath() {
  const sdk = findAndroidSdk();
  if (!sdk) {
    if (process.platform === 'win32') {
      return path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
    }
    return null;
  }
  const bin = process.platform === 'win32' ? 'adb.exe' : 'adb';
  return path.join(sdk, 'platform-tools', bin);
}

function parseAdbDevicesLong(stdout) {
  return (stdout || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return null;
      }
      const m = trimmed.match(/^(\S+)\s+(\S+)/);
      if (!m) {
        return null;
      }
      const modelMatch = trimmed.match(/model:(\S+)/);
      return {
        serial: m[1],
        state: m[2],
        model: modelMatch ? modelMatch[1] : null,
      };
    })
    .filter(Boolean);
}

/** Expo `--device` expects a friendly model name, not the ADB serial. */
function expoDeviceArgForSerial(adb, serial) {
  const stdout = spawnSync(adb, ['devices', '-l'], { encoding: 'utf8' }).stdout;
  const row = parseAdbDevicesLong(stdout).find((d) => d.serial === serial);
  return row?.model || null;
}

function parseAdbDevices(stdout) {
  return parseAdbDevicesLong(stdout).map(({ serial, state }) => ({ serial, state }));
}

/** Ghost emulators (offline) break Expo’s `adb reverse` — drop them before run:android. */
function pruneStaleAdbDevices(adb) {
  let listed = parseAdbDevices(spawnSync(adb, ['devices'], { encoding: 'utf8' }).stdout);
  for (const d of listed) {
    if (d.state !== 'device') {
      spawnSync(adb, ['disconnect', d.serial], { stdio: 'ignore' });
      if (d.serial.startsWith('emulator-')) {
        spawnSync(adb, ['-s', d.serial, 'emu', 'kill'], { stdio: 'ignore' });
      }
    }
  }
  spawnSync(adb, ['reconnect', 'offline'], { stdio: 'ignore' });
  listed = parseAdbDevices(spawnSync(adb, ['devices'], { encoding: 'utf8' }).stdout);
  return listed.filter((d) => d.state === 'device');
}

function refreshAdb() {
  const adb = adbPath();
  if (!adb || !fs.existsSync(adb)) {
    return [];
  }
  spawnSync(adb, ['kill-server'], { stdio: 'ignore' });
  spawnSync(adb, ['start-server'], { stdio: 'ignore' });
  spawnSync(adb, ['disconnect'], { stdio: 'ignore' });
  const online = pruneStaleAdbDevices(adb);
  console.error('\nADB devices:');
  spawnSync(adb, ['devices', '-l'], { stdio: 'inherit' });
  return online;
}

function pickPhysicalDeviceSerial(onlineDevices) {
  const physical = onlineDevices.find((d) => !d.serial.startsWith('emulator-'));
  return (physical || onlineDevices[0])?.serial || null;
}

function hasOnlineDevice() {
  const adb = adbPath();
  if (!adb || !fs.existsSync(adb)) {
    return true;
  }
  const lines = parseAdbDevices(spawnSync(adb, ['devices'], { encoding: 'utf8' }).stdout);
  return lines.some((d) => d.state === 'device');
}

function main() {
  const argv = process.argv.slice(2);
  const usb = argv.includes('--usb');
  const expoPass = argv.filter((a) => a !== '--usb' && a !== '--dry-jdk');

  if (argv.includes('--dry-jdk')) {
    const j = findGradleJdk();
    if (j) {
      console.log(j);
      process.exit(0);
    }
    reprightDiagnosticsLines().forEach((line) => console.error(line));
    console.error('[run-expo-android] No JDK 17–23 found (same search as a normal run).');
    process.exit(1);
  }

  const jdk = findGradleJdk();
  if (!jdk) {
    reprightDiagnosticsLines().forEach((line) => console.error(line));
    console.error(
      [
        '[run-expo-android] No usable JDK found (need 17–23; Java 24+ breaks Gradle).',
        '  Install Android Studio (or Temurin 17/21), then either:',
        '    • reopen the terminal and run again, or',
        '    • set User env REPRIGHT_ANDROID_JDK to the JDK root folder (must contain bin\\java.exe), e.g.:',
        '      setx REPRIGHT_ANDROID_JDK "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.xx.x-hotspot"',
      ].join('\n'),
    );
    process.exit(1);
  }

  const v = spawnSync(javaBin(jdk), ['-version'], { encoding: 'utf8' });
  const firstLine = (`${v.stderr || ''}${v.stdout || ''}`).split(/\r?\n/).find(Boolean) || '';
  console.error(`[run-expo-android] JAVA_HOME=${jdk}`);
  console.error(`[run-expo-android] ${firstLine.trim()}`);

  const sdk = findAndroidSdk();
  if (!sdk) {
    console.error(
      [
        '[run-expo-android] Android SDK not found.',
        '  Install Android Studio (SDK Manager) or set ANDROID_HOME to your SDK folder, e.g.:',
        '    setx ANDROID_HOME "%LOCALAPPDATA%\\Android\\Sdk"',
        '  Default on Windows: %LOCALAPPDATA%\\Android\\Sdk',
      ].join('\n'),
    );
    process.exit(1);
  }
  ensureLocalProperties(sdk);
  console.error(`[run-expo-android] ANDROID_HOME=${sdk}`);

  refreshAdb();

  const adb = adbPath();
  let deviceSerial = null;
  if (usb && adb && fs.existsSync(adb)) {
    const online = parseAdbDevices(spawnSync(adb, ['devices'], { encoding: 'utf8' }).stdout).filter(
      (d) => d.state === 'device',
    );
    deviceSerial = pickPhysicalDeviceSerial(online);
  }

  if (usb && !deviceSerial) {
    console.error(
      [
        '',
        '[run-expo-android] No ADB device online. Enable USB debugging, authorize this PC,',
        '  or use wireless debugging (pair → adb connect …).',
        '',
      ].join('\n'),
    );
  } else if (usb && deviceSerial) {
    const expoName = expoDeviceArgForSerial(adb, deviceSerial);
    console.error(`[run-expo-android] Target device: ${deviceSerial}${expoName ? ` (${expoName})` : ''}`);
  }

  const args = ['expo', 'run:android'];
  if (deviceSerial) {
    const expoName = adb && fs.existsSync(adb) ? expoDeviceArgForSerial(adb, deviceSerial) : null;
    if (expoName) {
      args.push('--device', expoName);
    }
    // Always pin adb/gradle to the USB serial; Expo --device alone is not enough on Windows.
  } else if (usb) {
    args.push('--device');
  }
  args.push(...expoPass);

  console.error(`[run-expo-android] npx ${args.join(' ')}\n`);

  const env = {
    ...process.env,
    JAVA_HOME: jdk,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    ...(deviceSerial ? { ANDROID_SERIAL: deviceSerial } : {}),
    PATH:
      path.join(jdk, 'bin') +
      (process.platform === 'win32' ? ';' : ':') +
      (process.env.PATH || ''),
  };

  const r = spawnSync('npx', args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  process.exit(r.status ?? 1);
}

main();
