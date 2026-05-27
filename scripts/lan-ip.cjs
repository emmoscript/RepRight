'use strict';

const { networkInterfaces } = require('os');

/** @returns {boolean} */
function ipv4Eligible(addr) {
  if (addr.internal) return false;
  const f = addr.family;
  return f === 'IPv4' || f === 4;
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

function pickLanIp() {
  return pickLanIpStrict() ?? pickLanIpRelaxed();
}

module.exports = { pickLanIp, pickLanIpStrict, pickLanIpRelaxed };
