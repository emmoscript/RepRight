#!/usr/bin/env node
'use strict';

/**
 * Wi‑Fi session trace receiver — no USB / adb required.
 * Phone POSTs RR| lines over LAN (same Wi‑Fi as Metro).
 *
 *   npm run log:session
 *
 * Allow inbound TCP on the log port in Windows Firewall (like 8081 for Metro).
 */

const http = require('http');
const { pickLanIp } = require('./lan-ip.cjs');
const { ingestLine, writeSessionHeader, LOG_FILE } = require('./rr-log-format.cjs');

const PORT = Number(process.env.SESSION_LOG_PORT || 8787);
const HOST = '0.0.0.0';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function handleLogPayload(body) {
  let count = 0;
  for (const line of body.split(/\r?\n/)) {
    const pretty = ingestLine(line);
    if (pretty) {
      console.log(pretty);
      count += 1;
    }
  }
  return count;
}

async function main() {
  writeSessionHeader();
  const lanIp = pickLanIp();

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, port: PORT }));
      return;
    }

    if (req.method === 'POST' && (req.url === '/log' || req.url === '/')) {
      try {
        const body = await readBody(req);
        let n = 0;
        if (body.trim().startsWith('{')) {
          const parsed = JSON.parse(body);
          const line = typeof parsed.line === 'string' ? parsed.line : '';
          if (line) {
            const pretty = ingestLine(line);
            if (pretty) {
              console.log(pretty);
              n = 1;
            }
          }
        } else {
          n = handleLogPayload(body);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ingested: n }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(PORT, HOST, () => {
    console.error('[session-log-server] Wi‑Fi trace receiver (no USB)');
    console.error(`[session-log-server] Listening on http://${HOST}:${PORT}/log`);
    if (lanIp) {
      console.error(`[session-log-server] Phone sends to http://${lanIp}:${PORT}/log`);
      console.error(`[session-log-server] Allow inbound TCP ${PORT} in firewall if needed.`);
    } else {
      console.error('[session-log-server] Could not guess LAN IP — phone uses Metro bundle host + port 8787.');
    }
    console.error(`[session-log-server] Writing ${LOG_FILE}`);
    console.error('[session-log-server] Start Metro (npm run start:lan), then run a Live Session.\n');
  });

  process.on('SIGINT', () => {
    console.error('\n[session-log-server] stopped');
    server.close(() => process.exit(0));
  });
}

main();
