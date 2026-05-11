'use strict';

/**
 * Picks your real LAN IPv4 (skips Loopback/WSL/Hyper‑V/virtual adapters where possible),
 * sets REACT_NATIVE_PACKAGER_HOSTNAME so the dev manifest points at Wi‑Fi, and listens
 * on all interfaces. Discovery from the Dev Client often fails without this on Windows.
 */

const { networkInterfaces } = require('os');
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

/** @returns {boolean} */
function ipv4Eligible(addr) {
  if (addr.internal) return false;
  const f = addr.family;
  if (f === 'IPv4' || f === 4) return true;
  return false;
}

function pickLanIpStrict() {
  const nets = networkInterfaces();
  /** @type {{ address: string; pri: number }[]} */
  const scored = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs?.length) continue;
    const skipIface =
      /^(lo|Loopback)/i.test(name) ||
      /vEthernet/i.test(name) ||
      /^Virtual\s/i.test(name) ||
      /VMware/i.test(name) ||
      /\b(VMware Network|VBox|WSL|docker|hyperv)\b/i.test(name);
    if (skipIface) continue;

    for (const a of addrs) {
      if (!ipv4Eligible(a)) continue;
      const address = typeof a.address === 'string' ? a.address : '';
      if (!address || /^169\.254\./.test(address)) continue;

      let pri = 2;
      // Match Windows "Wi‑Fi" literal hyphen (\u2011) vs ASCII hyphen
      if (/Wi[\s\u2011]?Fi|WLAN|Wireless|wlan|WiFi|Ethernet/i.test(name)) pri += 6;
      if (/^192\.168\./.test(address)) pri += 12;
      if (/^10\./.test(address)) pri += 8;
      if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) pri += 6;

      scored.push({ address, pri });
    }
  }

  scored.sort((a, b) => b.pri - a.pri);
  return scored[0]?.address ?? null;
}

/** Fallback when strict filter removes every iface (some Windows setups). Penalizes WSL/virtual names. */
function pickLanIpRelaxed() {
  const nets = networkInterfaces();
  /** @type {{ address: string; pri: number }[]} */
  const scored = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs?.length) continue;
    if (/^lo$/i.test(name) || /^Loopback/i.test(name)) continue;

    const virtualPenalty = /WSL|vEthernet|VirtualBox|VMware|\bDocker\b|Hyper[\s\u2011]?V/i.test(name)
      ? -60
      : 0;

    for (const a of addrs) {
      if (!ipv4Eligible(a)) continue;
      const address = typeof a.address === 'string' ? a.address : '';
      if (!address || /^169\.254\./.test(address) || address === '127.0.0.1') continue;

      let pri = virtualPenalty + 1;
      if (/^192\.168\./.test(address)) pri += 100;
      else if (/^10\./.test(address)) pri += 85;
      else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) pri += 40;
      if (/Wi[\s\u2011]?Fi|WLAN|Wireless|Ethernet/i.test(name)) pri += 25;

      scored.push({ address, pri });
    }
  }

  scored.sort((a, b) => b.pri - a.pri);
  return scored[0]?.address ?? null;
}

const ip = pickLanIpStrict() ?? pickLanIpRelaxed();

if (ip) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  console.log(
    `\x1b[32mRepright dev (wireless LAN / Wi‑Fi)\x1b[0m  Advertised packager host: ${ip}\n` +
      `  Same Wi‑Fi as this PC: shake → Dev menu → Change bundle URL → \x1b[36mhttp://${ip}:8081\x1b[0m\n` +
      `  Use \x1b[1mhttp\x1b[0m only (not https). TLS error \"Unable to parse TLS packet header\" = wrong scheme or wrong port/host.\n` +
      `  Discovery often fails on Windows until firewall allows inbound TCP 8081.\n`,
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
