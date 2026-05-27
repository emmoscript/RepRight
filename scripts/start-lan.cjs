'use strict';

/**
 * Picks your real LAN IPv4 (skips Loopback/WSL/Hyper‑V/virtual adapters where possible),
 * sets REACT_NATIVE_PACKAGER_HOSTNAME so the dev manifest points at Wi‑Fi, and listens
 * on all interfaces. Discovery from the Dev Client often fails without this on Windows.
 */

const { spawn } = require('child_process');
const path = require('path');
const { pickLanIp } = require('./lan-ip.cjs');

const root = path.join(__dirname, '..');

const ip = pickLanIp();

if (ip) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  console.log(
    `\x1b[32mRepright dev (wireless LAN / Wi‑Fi)\x1b[0m  Advertised packager host: ${ip}\n` +
      `  Same Wi‑Fi as this PC: shake → Dev menu → Change bundle URL → \x1b[36mhttp://${ip}:8081\x1b[0m\n` +
      `  Use \x1b[1mhttp\x1b[0m only (not https). TLS error \"Unable to parse TLS packet header\" = wrong scheme or wrong port/host.\n` +
      `  Discovery often fails on Windows until firewall allows inbound TCP 8081.\n` +
      `  Session debug (wireless): npm run log:session → phone posts traces to \x1b[36mhttp://${ip}:8787\x1b[0m\n`,
  );
} else {
  console.warn(
    '[Repright] Could not guess a LAN IPv4. Set REACT_NATIVE_PACKAGER_HOSTNAME manually ' +
      'or run: npm run start:tunnel\n',
  );
}

const forwarded = process.argv.slice(2);
const useShell = process.platform === 'win32';
const expoArgs = ['expo', 'start', '--lan', ...forwarded];

const child = spawn('npx', expoArgs, {
  cwd: root,
  shell: useShell,
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', (code, signal) => {
  process.exit(code != null ? code : signal ? 1 : 0);
});
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
