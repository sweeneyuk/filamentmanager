// Mock Filament Manager API and socket on port 3001, for browser tests and
// local design work. Never talks to a printer.
//
//   node dev/mock-server.mjs [--port 3001] [--scenario default]
//
// Control routes:
//   POST /__scenario {name}   switch scenario; clears request log and delay
//   GET  /__requests          recorded non-GET requests [{method, path, body}]
//   POST /__emit {event,data} emit a socket event to every client
//   POST /__delay {ms}        delay every API response by ms
import http from 'node:http';
import { Server } from 'socket.io';
import { buildScenario } from './fixtures.mjs';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const PORT = Number(argValue('--port', process.env.MOCK_PORT || 3001));

let data = buildScenario(argValue('--scenario', 'default'));
let requests = [];
let delayMs = 0;

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
});

const parseBody = (req, buf) => {
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try { return JSON.parse(buf.toString() || 'null'); } catch { return null; }
  }
  if (type.includes('multipart/form-data')) {
    // Record field names and file names only.
    const text = buf.toString('latin1');
    const names = [...text.matchAll(/name="([^"]+)"(?:; filename="([^"]*)")?/g)]
      .map(([, name, filename]) => (filename !== undefined ? { name, filename } : { name }));
    return { multipart: names };
  }
  return buf.length ? buf.toString() : null;
};

const authOk = (req) => /^Bearer \S+/.test(req.headers.authorization || '');

function getRoute(path) {
  const d = data;
  const table = {
    '/api/settings': () => d.settings,
    '/api/printers': () => ({ success: true, printers: d.printers }),
    '/api/ams': () => d.ams,
    '/api/ams/assignments': () => d.assignments,
    '/api/print_status': () => d.states,
    '/api/spools': () => d.spools,
    '/api/brands': () => d.brands,
    '/api/materials': () => d.materials,
    '/api/knowledge/brands': () => d.knowledge,
    '/api/archives': () => d.archives,
    '/api/analytics': () => d.analytics,
    '/api/jobs': () => d.jobs,
    '/api/scrapsaver/models': () => d.scrapModels,
    '/api/backups': () => d.backups,
    '/api/ha/rate': () => ({ rate: 0.5 }),
    '/api/export/csv': () => 'id,brand\n1,Bambu Lab\n',
  };
  return table[path];
}

function postAnswer(method, path, body) {
  if (method === 'POST' && path === '/api/brands') {
    const brand = { id: 99, name: body?.name, default_empty_weight: body?.default_empty_weight };
    data.brands = [...data.brands.filter((b) => b.id !== 99), brand];
    return brand;
  }
  if (method === 'POST' && path === '/api/materials') {
    const material = { id: 98, name: body?.name };
    data.materials = [...data.materials.filter((m) => m.id !== 98), material];
    return material;
  }
  if (path === '/api/chat') return { text: 'Mock reply' };
  if (path === '/api/calculator/parse') {
    return { weights: [{ weight: 50, hex: '#112233' }, { weight: 20, hex: '#ffffff' }], printTimeSeconds: 7200, thumbnailPath: null };
  }
  if (path === '/api/backups/manual') return { success: true, filename: 'backup.zip' };
  if (path === '/api/auth/login') return { success: true, token: 'test', user: { username: 'tester' } };
  if (path === '/api/auth/setup') return { success: true, token: 'test', user: { username: 'tester' } };
  if (path === '/api/gemini/resolve-variant') return { variantId: '456' };
  if (/^\/api\/archives\/\d+\/regenerate-image$/.test(path)) return { success: true, photo_path: '/media/1_photo.jpg' };
  if (/^\/api\/archives\/\d+\/media$/.test(path)) return { success: true, path: '/media/1_upload.jpg' };
  if (path === '/api/test/ha' || path === '/api/test/bambu') return { success: true, message: 'Connected' };
  return { success: true };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;
  const buf = await readBody(req);

  // Control routes
  if (path.startsWith('/__')) {
    const body = parseBody(req, buf) || {};
    if (path === '/__scenario') {
      data = buildScenario(body.name);
      requests = [];
      delayMs = 0;
      return send(res, 200, { ok: true });
    }
    if (path === '/__requests') return send(res, 200, requests);
    if (path === '/__emit') { io.emit(body.event, body.data); return send(res, 200, { ok: true }); }
    if (path === '/__delay') { delayMs = Number(body.ms) || 0; return send(res, 200, { ok: true }); }
    return send(res, 404, { error: 'unknown control route' });
  }

  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));

  if (path.startsWith('/media/')) return send(res, 200, PNG, 'image/png');

  // Auth routes
  if (path === '/api/auth/setup-check') {
    return send(res, 200, { setupRequired: data.setupRequired, ssoConfigured: data.ssoConfigured });
  }
  if (path === '/api/auth/verify') {
    if (!authOk(req)) return send(res, 401, { error: 'Unauthorised' });
    return send(res, 200, { valid: true, user: { username: 'tester' } });
  }

  if (method !== 'GET') {
    const body = parseBody(req, buf);
    requests.push({ method, path, body });
    return send(res, 200, postAnswer(method, path, body));
  }

  if (path.startsWith('/api/backups/download/')) return send(res, 200, Buffer.from('PK'), 'application/zip');
  if (data.fail) return send(res, 500, { error: 'Mock failure' });
  const route = getRoute(path);
  if (!route) return send(res, 404, { error: `No mock for ${path}` });
  const value = route();
  return send(res, 200, value, typeof value === 'string' ? 'text/csv' : 'application/json');
});

const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (socket) => {
  for (const [pid, state] of Object.entries(data.states)) {
    socket.emit('print_state_update', { printer_id: Number(pid), state });
  }
  for (const [pid, ams] of Object.entries(data.ams)) {
    socket.emit('ams_update', { printer_id: Number(pid), ams });
  }
});

server.listen(PORT, () => console.log(`mock server on http://localhost:${PORT} (${data.name})`));
