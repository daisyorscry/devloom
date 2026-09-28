import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { basicAuth } from '../server/auth.js';
import { WorkspaceRegistry } from '../server/workspaces.js';

test('Basic Auth rejects incomplete and invalid configuration', () => {
  for (const env of [
    { DEVLOOM_AUTH_USERNAME: 'admin' },
    { DEVLOOM_AUTH_PASSWORD: 'secret' },
    { DEVLOOM_AUTH_USERNAME: 'ad:min', DEVLOOM_AUTH_PASSWORD: 'secret' },
    { DEVLOOM_AUTH_USERNAME: 'admin', DEVLOOM_AUTH_PASSWORD: 'secret\n' },
  ])
    assert.throws(() => basicAuth(env), /Set both DEVLOOM_AUTH/);
  assert.doesNotThrow(() => basicAuth({}));
});

test('Basic Auth protects frontend, workspace APIs and SSE while preserving session checks', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'devloom-auth-'));
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  const registry = new WorkspaceRegistry(dir, process.cwd(), port, 4318);
  const app = express();
  app.use(
    basicAuth({
      DEVLOOM_AUTH_USERNAME: 'admin',
      DEVLOOM_AUTH_PASSWORD: 'sëcret:pass',
    }),
  );
  app.use(registry.middleware());
  app.get('/{*path}', (_req, res) => res.send('frontend'));
  server.on('request', app);
  t.after(async () => {
    await registry.shutdown();
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${port}`;
  const authorization = `Basic ${Buffer.from('admin:sëcret:pass').toString('base64')}`;
  for (const path of [
    '/',
    '/assets/app.js',
    '/api/session',
    '/api/events',
    '/api/services?workspace=missing',
  ]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get('www-authenticate'),
      'Basic realm="Devloom", charset="UTF-8"',
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  for (const value of [
    'Basic !!!',
    'Bearer token',
    'Basic YWRtaW4=',
    `Basic ${Buffer.from('admin:wrong').toString('base64')}`,
    `Basic ${Buffer.from('wrong:sëcret:pass').toString('base64')}`,
  ]) {
    assert.equal(
      (await fetch(url + '/api/session', { headers: { authorization: value } })).status,
      401,
    );
  }
  const headers = { authorization };
  assert.equal(await (await fetch(url, { headers })).text(), 'frontend');
  const { token } = await (await fetch(url + '/api/session', { headers })).json();
  const create = (session: string) =>
    fetch(url + '/api/workspaces', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'x-devloom-token': session,
      },
      body: JSON.stringify({ name: 'Authenticated project' }),
    });
  assert.equal((await create('wrong')).status, 403);
  const created = await create(token);
  assert.equal(created.status, 201);
  const workspace = await created.json();
  assert.equal(
    (await fetch(url + '/api/session?workspace=' + workspace.id, { headers })).status,
    200,
  );
  const stream = await fetch(url + '/api/events', { headers });
  assert.equal(stream.status, 200);
  const reader = stream.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: snapshot/);
  await reader.cancel();
});
