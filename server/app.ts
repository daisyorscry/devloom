import { listDirectories } from './directories.js';
import type { WorkspaceRegistry } from './workspaces.js';
import type { TelemetryStore } from './telemetry.js';
import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import { ConflictError, InputError, ProcessManager } from './manager.js';

export function createApp(
  manager: ProcessManager,
  projectRoot: string,
  port: number,
  telemetry?: TelemetryStore,
  workspace?: { registry: WorkspaceRegistry; id: string },
) {
  const app = express();
  const token = randomBytes(32).toString('hex');
  const clients = new Set<ServerResponse>();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!allowed.includes(req.headers.host ?? ''))
      return res.status(403).json({ error: 'Devloom accepts localhost requests only.' });
    if (req.headers.origin && !allowed.map((host) => `http://${host}`).includes(req.headers.origin))
      return res.status(403).json({ error: 'Cross-origin access is not allowed.' });
    if (req.headers['sec-fetch-site'] === 'cross-site')
      return res.status(403).json({ error: 'Cross-site access is not allowed.' });
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD'].includes(req.method)) return next();
    const supplied = req.headers['x-devloom-token'];
    if (
      typeof supplied !== 'string' ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
    )
      return res.status(403).json({ error: 'Invalid session. Reload Devloom and try again.' });
    if (!req.is('application/json'))
      return res.status(415).json({ error: 'Use application/json.' });
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  // Read-only, but session-protected because folder names can be private.
  app.post('/api/directories', async (req, res) => {
    res.json(await listDirectories(req.body, projectRoot));
  });
  if (workspace) {
    app.get('/api/workspaces', (_req, res) => res.json(workspace.registry.list()));
    app.post('/api/workspaces', (req, res) =>
      res.status(201).json(workspace.registry.add(req.body.name)),
    );
    app.put('/api/workspaces/:id', (req, res) =>
      res.json(workspace.registry.rename(String(req.params.id), req.body.name)),
    );
    app.delete('/api/workspaces/:id', async (req, res) => {
      await workspace.registry.remove(String(req.params.id));
      res.status(204).end();
    });
  }
  const snapshot = () => ({
    services: manager.list(),
    logs: manager.logs(),
    workspace:
      workspace?.registry.list().find((w) => w.id === workspace.id)?.name ?? 'Local workspace',
  });
  app.get('/api/telemetry', (_req, res) =>
    res.json(
      telemetry?.snapshot() ?? {
        receiver: 'error',
        receiverError: 'Receiver unavailable',
        services: [],
        traces: [],
        metrics: [],
        spanCount: 0,
      },
    ),
  );
  app.get('/api/telemetry/traces/:id', (req, res) => {
    const spans = telemetry?.trace(String(req.params.id)) ?? [];
    if (!spans.length) return res.status(404).json({ error: 'Trace is no longer retained.' });
    res.json(spans);
  });
  app.get('/api/runtime/memory', (_req, res) => res.json(manager.memory()));
  app.get('/api/session', (_req, res) => res.json({ token }));
  app.get('/api/services', (_req, res) => res.json(snapshot()));
  app.post('/api/services', (req, res) => res.status(201).json(manager.add(req.body)));
  app.put('/api/services/:id', (req, res) =>
    res.json(manager.update(String(req.params.id), req.body)),
  );
  app.delete('/api/services/:id', (req, res) => {
    manager.remove(String(req.params.id));
    res.status(204).end();
  });
  app.get('/api/services/:id/logs', (req, res) => res.json(manager.logs(String(req.params.id))));
  app.post('/api/services/:id/:action', async (req, res) => {
    const action = String(req.params.action);
    if (!['start', 'stop', 'restart'].includes(action))
      return res.status(404).json({ error: 'Unknown action.' });
    return res.json(
      await manager.action(String(req.params.id), action as 'start' | 'stop' | 'restart'),
    );
  });
  app.post('/api/examples', (_req, res) => {
    if (manager.list().length)
      throw new ConflictError('Examples can only be added to an empty workspace.');
    const examples = [
      { name: 'Auth Service', kind: 'api', port: 18080 },
      { name: 'Project Service', kind: 'api', port: 18081 },
      { name: 'API Gateway', kind: 'api', port: 18082 },
      { name: 'Worker', kind: 'worker' },
      { name: 'Scheduler', kind: 'scheduler' },
      { name: 'Frontend', kind: 'frontend', port: 15173 },
    ];
    for (const example of examples)
      manager.add({
        ...example,
        directory: projectRoot,
        command: process.execPath,
        args: [
          join(projectRoot, 'examples/service.mjs'),
          example.name,
          ...(example.port ? [String(example.port)] : []),
        ],
        healthUrl: example.port ? `http://127.0.0.1:${example.port}/health` : undefined,
      });
    res.status(201).json(snapshot());
  });
  const send = (res: ServerResponse, event: string, data: unknown) => {
    if (res.writableLength > 1024 * 1024) {
      res.destroy();
      return;
    }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    clients.add(res);
    send(res, 'snapshot', snapshot());
    if (telemetry) send(res, 'telemetry', { changed: true });
    req.on('close', () => clients.delete(res));
  });
  const broadcastState = (data: unknown) => {
    for (const client of clients) send(client, 'state', data);
  };
  const broadcastLog = (data: unknown) => {
    for (const client of clients) send(client, 'log', data);
  };
  const broadcastTelemetry = () => {
    for (const client of clients) send(client, 'telemetry', { changed: true });
  };
  telemetry?.on('change', broadcastTelemetry);
  manager.on('memory', broadcastTelemetry);
  manager.on('state', broadcastState);
  manager.on('log', broadcastLog);
  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(': heartbeat\n\n');
  }, 15000);
  heartbeat.unref();
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  const errorHandler: express.ErrorRequestHandler = (error, _req, res, _next) => {
    const status =
      error instanceof ConflictError
        ? 409
        : error instanceof InputError || error.type === 'entity.parse.failed'
          ? 400
          : error.type === 'entity.too.large'
            ? 413
            : 500;
    if (status === 500) console.error(error);
    res.status(status).json({
      error: status === 500 ? 'Something went wrong. Check the Devloom terminal.' : error.message,
    });
  };
  app.use(errorHandler);
  return {
    app,
    dispose: () => {
      clearInterval(heartbeat);
      telemetry?.off('change', broadcastTelemetry);
      manager.off('memory', broadcastTelemetry);
      manager.off('state', broadcastState);
      manager.off('log', broadcastLog);
      for (const client of clients) client.end();
    },
  };
}
