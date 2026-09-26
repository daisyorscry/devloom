import express from 'express';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WorkspaceRegistry } from '../server/workspaces.js';
import { createReceiver } from '../server/telemetry.js';

async function freePort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = (s.address() as { port: number }).port;
  await new Promise<void>((r) => s.close(() => r()));
  return port;
}

test('projects preserve legacy data, isolate processes and telemetry, and persist independently', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'devloom-projects-'));
  const legacy = {
    id: 'legacy-service',
    name: 'API',
    directory: process.cwd(),
    command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'],
    kind: 'api',
  };
  writeFileSync(join(dir, 'services.json'), JSON.stringify([legacy]));
  const port = await freePort(),
    otlp = await freePort();
  const registry = new WorkspaceRegistry(dir, process.cwd(), port, otlp);
  const app = express();
  app.use(registry.middleware());
  const server = createServer(app);
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  const receiver = await createReceiver(
    registry.defaultTelemetry,
    process.cwd(),
    otlp,
    '127.0.0.1',
    (id) => registry.context(id)?.telemetry,
  );
  if (!receiver.server.listening) await once(receiver.server, 'listening');
  t.after(async () => {
    receiver.close();
    await registry.shutdown();
    server.closeAllConnections();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  async function request(path: string, workspace = 'default', method = 'GET', body?: unknown) {
    const { token } = await (await fetch(`${base}/api/session?workspace=${workspace}`)).json();
    return fetch(`${base}/api${path}?workspace=${workspace}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-devloom-token': token },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  }
  assert.equal((await (await request('/services')).json()).services[0].id, legacy.id);
  const project = await (
    await request('/workspaces', 'default', 'POST', { name: 'Commerce' })
  ).json();
  const other = registry.context(project.id)!;
  assert.deepEqual((await (await request('/services', project.id)).json()).services, []);
  assert.equal((await request('/workspaces', 'default', 'POST', { name: 'commerce' })).status, 409);
  assert.equal((await request('/workspaces', 'default', 'POST', { name: '  ' })).status, 400);
  const service = await (
    await request('/services', project.id, 'POST', {
      ...legacy,
      args: [
        '-e',
        'console.log(process.env.OTEL_EXPORTER_OTLP_ENDPOINT); setInterval(()=>{},1000)',
      ],
    })
  ).json();
  assert.equal((await request(`/services/${service.id}/start`, 'default', 'POST')).status, 400);
  assert.equal((await request(`/services/${service.id}/start`, project.id, 'POST')).status, 200);
  for (let i = 0; i < 50 && !other.manager.logs(service.id).some((l) => l.stream === 'stdout'); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.ok(
    other.manager.logs(service.id).some((l) => l.message.includes(`/workspaces/${project.id}`)),
  );
  assert.equal(registry.context('default')!.manager.logs().length, 0);
  await other.manager.sampleMemory();
  assert.ok(other.manager.memory().managedBytes > 0);
  assert.equal(registry.context('default')!.manager.memory().managedBytes, 0);
  assert.equal((await request(`/workspaces/${project.id}`, 'default', 'DELETE')).status, 409);
  await request('/services', 'default');
  assert.equal(
    other.manager.list()[0].status,
    'running',
    'viewing another project leaves services running',
  );
  const payload = {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'API' } }] },
        scopeSpans: [
          {
            spans: [
              {
                traceId: 'a'.repeat(32),
                spanId: 'b'.repeat(16),
                name: 'GET /test',
                startTimeUnixNano: '1770000000000000000',
                endTimeUnixNano: '1770000000010000000',
              },
            ],
          },
        ],
      },
    ],
  };
  const exportTrace = (path: string) =>
    fetch(`http://127.0.0.1:${otlp}${path}/v1/traces`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  assert.equal((await exportTrace(`/workspaces/${project.id}`)).status, 200);
  assert.equal(other.telemetry.snapshot().spanCount, 1);
  assert.equal(registry.defaultTelemetry.snapshot().spanCount, 0);
  assert.equal((await exportTrace('/workspaces/missing')).status, 404);
  assert.equal((await exportTrace('')).status, 200);
  assert.equal(registry.defaultTelemetry.snapshot().spanCount, 1);
  assert.equal((await fetch(`${base}/api/services?workspace=missing`)).status, 404);
  const { token: wrongToken } = await (await request('/session')).json();
  assert.equal(
    (
      await fetch(`${base}/api/services?workspace=${project.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-devloom-token': wrongToken },
        body: '{}',
      })
    ).status,
    403,
  );
  await request(`/workspaces/${project.id}`, 'default', 'PUT', { name: 'Storefront' });
  await registry.shutdown();
  const restored = new WorkspaceRegistry(dir, process.cwd(), port, otlp);
  assert.equal(restored.list().find((w) => w.id === project.id)?.name, 'Storefront');
  assert.equal(restored.context(project.id)!.manager.list()[0].status, 'stopped');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'services.json'), 'utf8')), [legacy]);
  restored.context(project.id)!.manager.remove(service.id);
  await restored.remove(project.id);
  assert.equal(restored.context(project.id), undefined);
  await assert.rejects(() => restored.remove('default'));
  await restored.shutdown();
});
