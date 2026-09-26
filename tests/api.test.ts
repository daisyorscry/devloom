import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { ProcessManager } from '../server/manager.js';
import { createApp } from '../server/app.js';

test('API protects mutations, persists CRUD and streams snapshots', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'devloom-api-'));
  const manager = new ProcessManager(dir);
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  const { app, dispose } = createApp(manager, process.cwd(), port);
  server.on('request', app);
  t.after(async () => {
    dispose();
    await manager.shutdown();
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${port}`;
  const { token } = await (await fetch(`${url}/api/session`)).json();
  const config = {
    name: 'API test',
    directory: process.cwd(),
    command: process.execPath,
    args: ['-e', 'console.log("test")'],
  };
  const post = (headers: Record<string, string> = {}) =>
    fetch(`${url}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(config),
    });
  assert.equal((await post()).status, 403);
  assert.equal(
    (
      await post({
        'x-devloom-token': token,
        Origin: 'https://untrusted.example',
      })
    ).status,
    403,
  );
  const rebindingStatus = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(
      `${url}/api/session`,
      { headers: { Host: 'attacker.example' } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(rebindingStatus, 403);
  assert.equal(
    (
      await fetch(`${url}/api/session`, {
        headers: { 'sec-fetch-site': 'cross-site' },
      })
    ).status,
    403,
  );
  assert.equal((await post({ 'x-devloom-token': 'é'.repeat(64) })).status, 403);
  const created = await post({ 'x-devloom-token': token });
  assert.equal(created.status, 201);
  const service = await created.json();
  assert.equal((await (await fetch(`${url}/api/services`)).json()).services.length, 1);
  const stream = await fetch(`${url}/api/events`);
  const reader = stream.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: snapshot/);
  assert.match(first, /API test/);
  await reader.cancel();
  const headers = {
    'Content-Type': 'application/json',
    'x-devloom-token': token,
  };
  const update = await fetch(`${url}/api/services/${service.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...config, name: 'Updated' }),
  });
  assert.equal((await update.json()).name, 'Updated');
  const deleted = await fetch(`${url}/api/services/${service.id}`, {
    method: 'DELETE',
    headers,
    body: '{}',
  });
  assert.equal(deleted.status, 204);
  assert.equal((await (await fetch(`${url}/api/services`)).json()).services.length, 0);
});
