import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import bookingChannelsService from './services/bookingChannels';
import ownerManagementService from './services/ownerManagement';
import paymentGatewayService from './services/paymentGateways';
import userAccountService from './services/userAccounts';

interface ProductionStatus {
  status: 'ready' | 'not_ready';
  environment: string;
  activeChannels: string[];
  activePaymentGateways: string[];
  externalChannelsConfigured: number;
  cardGatewaysConfigured: number;
}

const sessions = new Map<string, string>();

function getProductionStatus(): ProductionStatus {
  const activeChannels = bookingChannelsService
    .getActiveChannels()
    .map((channel) => channel.platform);
  const activePaymentGateways = paymentGatewayService
    .getActiveGateways()
    .map((gateway) => gateway.name);
  const externalChannelsConfigured = activeChannels.filter((platform) => platform !== 'direct').length;
  const cardGatewaysConfigured = activePaymentGateways.filter((name) => name !== 'Pay at property').length;

  return {
    status: externalChannelsConfigured > 0 && cardGatewaysConfigured > 0 ? 'ready' : 'not_ready',
    environment: process.env.NODE_ENV ?? 'production',
    activeChannels,
    activePaymentGateways,
    externalChannelsConfigured,
    cardGatewaysConfigured,
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}

function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  });
  response.end(html);
}

function readCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const rawCookie of header?.split(';') ?? []) {
    const [name, ...rest] = rawCookie.trim().split('=');
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function getSessionUser(request: IncomingMessage) {
  const sessionId = readCookies(request.headers.cookie).session;
  if (!sessionId) return null;
  const userId = sessions.get(sessionId);
  if (!userId) return null;
  try {
    return userAccountService.getProfile(userId, userId);
  } catch {
    sessions.delete(sessionId);
    return null;
  }
}

function parseJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    request.on('error', reject);
  });
}

function renderLoginPage(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>ScopeBridge Login</title>
<style>body{font-family:Arial,sans-serif;background:#0b1020;color:#e5eefb;padding:24px} form{max-width:420px;background:#121c2e;padding:24px;border-radius:12px;margin:40px auto} input{width:100%;padding:10px;margin:8px 0;border-radius:8px;border:1px solid #2f3d5f;background:#0d1527;color:#eaf3ff} button{background:#2f7df6;color:white;padding:12px 18px;border:none;border-radius:8px;cursor:pointer;width:100%} .hint{font-size:12px;color:#9fb7d9;margin-top:12px}</style></head>
<body><form id="loginForm"><div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><div style="display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#5aa2ff,#2d7df6);font-size:24px" aria-label="ScopeBridge panda logo">🐼</div><div><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9fb7d9">Production access</div><h2 style="margin:4px 0 0">ScopeBridge</h2></div></div><p style="color:#afc2de">Secure access for guests, property owners, and administrators.</p><label>User ID</label><input id="userId" required><label>Password</label><input id="password" type="password" required><button type="submit">Log in</button><div class="hint"><a href="/register" style="color:#b9d5ff">Create a profile</a></div></form><script>
const form = document.getElementById('loginForm');
form.addEventListener('submit', async (event) => { event.preventDefault();
  const userId = document.getElementById('userId').value.trim();
  const password = document.getElementById('password').value;
  const response = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, password }) });
  const payload = await response.json();
  if (!response.ok) { alert(payload.error || 'Login failed'); return; }
  window.location.href = payload.user.role === 'admin' ? '/admin' : '/profile';
});
</script></body></html>`;
}

function renderAdminPage(): string {
  const users = userAccountService.listAccounts();
  const rows = users.map((user) => `<tr><td>${user.userId}</td><td>${user.role}</td><td>${user.profile.fullName ?? ''}</td><td>${user.profile.email ?? ''}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>ScopeBridge Admin Dashboard</title><style>body{font-family:Arial,sans-serif;background:#0b1020;color:#e5eefb;padding:24px} table{width:100%;border-collapse:collapse;background:#121c2e} th,td{padding:12px;border-bottom:1px solid #2d3b5a;text-align:left} .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.btn{padding:10px 16px;border-radius:8px;background:#2f7df6;color:white;text-decoration:none;display:inline-block}</style></head><body><div class="topbar"><h2>Admin Dashboard</h2><a class="btn" href="/api/logout">Log out</a></div><table><thead><tr><th>User ID</th><th>Role</th><th>Name</th><th>Email</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function renderProfilePage(user: { userId: string; role: string; profile: Record<string, string | undefined> }): string {
  const name = user.profile.fullName ?? 'User';
  return `<!doctype html><html><head><meta charset="utf-8"><title>ScopeBridge Profile</title><style>body{font-family:Arial,sans-serif;background:#0b1020;color:#e5eefb;padding:24px} .card{max-width:500px;background:#121c2e;padding:24px;border-radius:12px;margin:40px auto} .tag{display:inline-block;padding:4px 8px;border-radius:999px;background:#1c2d4d;color:#b8d0ff;font-size:12px;margin-bottom:12px}.meta{margin:10px 0;color:#dfe9ff}.btn{padding:10px 16px;border-radius:8px;background:#2f7df6;color:white;text-decoration:none;display:inline-block;margin-top:8px}</style></head><body><div class="card"><div class="tag">${user.role}</div><h2>${name}</h2><div class="meta"><strong>User ID:</strong> ${user.userId}</div><div class="meta"><strong>Email:</strong> ${user.profile.email ?? 'Not set'}</div><div class="meta"><strong>Phone:</strong> ${user.profile.phone ?? 'Not set'}</div><a class="btn" href="/api/logout">Log out</a></div></body></html>`;
}

export function createApplicationServer() {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    if (requestUrl.pathname === '/') {
      response.writeHead(302, { Location: '/login' });
      response.end();
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.method === 'GET' && (requestUrl.pathname === '/readyz' || requestUrl.pathname === '/api/production-status')) {
      const status = getProductionStatus();
      sendJson(response, status.status === 'ready' ? 200 : 503, status);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/login') {
      sendHtml(response, 200, renderLoginPage());
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/admin') {
      const user = getSessionUser(request);
      if (!user || user.role !== 'admin') {
        sendHtml(response, 403, '<html><body><h2>Admin access required</h2><p><a href="/login">Login</a></p></body></html>');
        return;
      }
      sendHtml(response, 200, renderAdminPage());
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/profile') {
      const user = getSessionUser(request);
      if (!user) {
        sendHtml(response, 401, '<html><body><h2>Login required</h2><p><a href="/login">Login</a></p></body></html>');
        return;
      }
      sendHtml(response, 200, renderProfilePage(user));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/login') {
      try {
        const body = await parseJsonBody(request);
        const userId = String(body.userId ?? '').trim();
        const password = String(body.password ?? '');
        const user = userAccountService.authenticate(userId, password);
        const sessionId = randomUUID();
        sessions.set(sessionId, user.userId);
        response.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
        sendJson(response, 200, { ok: true, user });
      } catch (error) {
        sendJson(response, 401, { error: error instanceof Error ? error.message : 'Invalid user ID or password' });
      }
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/register') {
      try {
        const body = await parseJsonBody(request);
        const role = String(body.role ?? 'guest').trim();
        const fullName = String(body.fullName ?? '').trim();
        const email = String(body.email ?? '').trim();
        const password = String(body.password ?? '');
        const phone = String(body.phone ?? '').trim();
        const address = String(body.address ?? '').trim();

        if (!['guest', 'owner', 'admin'].includes(role)) {
          throw new Error('Role must be guest, owner, or admin');
        }
        if (!fullName || !email || !password) {
          throw new Error('Full name, email, and password are required');
        }

        const created = userAccountService.register(role as 'guest' | 'owner' | 'admin', {
          fullName,
          email,
          phone: phone || undefined,
          address: address || undefined,
        }, password);

        const user = userAccountService.authenticate(created.userId, password);
        const sessionId = randomUUID();
        sessions.set(sessionId, user.userId);
        response.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
        sendJson(response, 201, { ok: true, user, created });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : 'Registration failed' });
      }
      return;
    }

    if ((request.method === 'GET' || request.method === 'POST') && requestUrl.pathname === '/api/logout') {
      const sessionId = readCookies(request.headers.cookie).session;
      if (sessionId) sessions.delete(sessionId);
      response.setHeader('Set-Cookie', 'session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      sendJson(response, 200, { ok: true, message: 'Logged out' });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/me') {
      const user = getSessionUser(request);
      if (!user) { sendJson(response, 401, { error: 'Authentication required' }); return; }
      sendJson(response, 200, { user });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/admin/users') {
      const user = getSessionUser(request);
      if (!user || user.role !== 'admin') {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }
      sendJson(response, 200, { users: userAccountService.listAccounts() });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/admin/dashboard') {
      const user = getSessionUser(request);
      if (!user || user.role !== 'admin') {
        sendJson(response, 403, { error: 'Admin access required' });
        return;
      }
      sendJson(response, 200, { users: userAccountService.listAccounts(), status: getProductionStatus() });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });
}

export async function initializeApplication(): Promise<void> {
  userAccountService.seedProductionAccounts();
  await ownerManagementService.initialize();
}

export { getProductionStatus };