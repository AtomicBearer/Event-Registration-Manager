/* AC-STEM official staff UI static server. Node.js 20+. No npm dependencies.
   Locally bound, no private database credentials. Tailscale Serve only, never Funnel. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid PORT');
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
});
function serve(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  const fail = (code) => { res.statusCode = code; res.setHeader('Content-Type', 'text/plain'); res.end(code === 404 ? 'Not found' : 'Method not allowed'); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405);
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch (_) { return fail(404); }
  // Only the exact UI entrypoint and these asset folders can be served.
  let rel;
  if (pathname === '/' || pathname === '/index.html') rel = 'index.html';
  else if (/^\/(?:js|css|vendor|assets)\/[a-zA-Z0-9_.\/-]+$/.test(pathname) && !pathname.includes('..'))
    rel = pathname.slice(1);
  else return fail(404);
  const full = path.join(root, rel);
  const ext = path.extname(full);
  if (!MIME[ext]) return fail(404);
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return fail(404);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext]);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(full);
    stream.on('error', () => { if (!res.headersSent) fail(404); else res.destroy(); });
    stream.pipe(res);
  });
}
if (require.main === module) {
  http.createServer(serve).listen(port, '127.0.0.1', () => {
    console.log(`AC-STEM staff Event Desk: http://localhost:${port}`);
    console.log('Production staff login enabled; official AC-STEM 9.0 only.');
    console.log('Use Tailscale Serve for private HTTPS camera access. Do not use Funnel.');
  });
}
module.exports = { serve };
