'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'session-live.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendRaw(line) {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function parseRrLine(line) {
  const idx = line.indexOf('RR|');
  if (idx === -1) return null;
  const chunk = line.slice(idx);
  const parts = chunk.split('|');
  if (parts.length < 3) return null;
  const cat = parts[1];
  const event = parts[2];
  const json = parts.slice(3).join('|');
  let data = {};
  try {
    data = json ? JSON.parse(json) : {};
  } catch {
    return { cat, event, raw: json };
  }
  return { cat, event, data };
}

function fmtVal(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (typeof v === 'object' && v != null) return JSON.stringify(v);
  return String(v);
}

function pretty(parsed) {
  const { cat, event, data } = parsed;
  const pairs = Object.entries(data || {})
    .map(([k, v]) => `${k}=${fmtVal(v)}`)
    .join(' ');
  const ts = new Date().toLocaleTimeString();
  return `[${ts}] ${cat.padEnd(9)} ${event}${pairs ? ` | ${pairs}` : ''}`;
}

function ingestLine(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('RR|')) return null;
  appendRaw(trimmed);
  const parsed = parseRrLine(trimmed);
  return parsed ? pretty(parsed) : null;
}

function writeSessionHeader() {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `\n# --- session trace ${new Date().toISOString()} ---\n`, 'utf8');
}

module.exports = {
  LOG_FILE,
  ensureLogDir,
  appendRaw,
  parseRrLine,
  pretty,
  ingestLine,
  writeSessionHeader,
};
