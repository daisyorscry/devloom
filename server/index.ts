import { createReceiver } from './telemetry.js';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import express from 'express';
import { WorkspaceRegistry } from './workspaces.js';

if (process.platform === 'win32')
  throw new Error('Devloom currently supports macOS and Linux. On Windows, use WSL.');
const projectRoot = process.cwd();
const port = Number(process.env.DEVLOOM_PORT || 4310);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('DEVLOOM_PORT must be between 1 and 65535.');
const otlpPort = Number(process.env.DEVLOOM_OTLP_PORT || 4318);
if (!Number.isInteger(otlpPort) || otlpPort < 1 || otlpPort > 65535 || otlpPort === port)
  throw new Error('DEVLOOM_OTLP_PORT must be a valid port different from DEVLOOM_PORT.');
const host = process.env.DEVLOOM_HOST || '127.0.0.1';
if (!['127.0.0.1', '0.0.0.0'].includes(host))
  throw new Error('DEVLOOM_HOST must be 127.0.0.1 or 0.0.0.0.');
const dataDir = resolve(process.env.DEVLOOM_DATA_DIR || join(projectRoot, '.devloom'));
const workspaces = new WorkspaceRegistry(dataDir, projectRoot, port, otlpPort);
const receiver = await createReceiver(
  workspaces.defaultTelemetry,
  projectRoot,
  otlpPort,
  host,
  (id) => workspaces.context(id)?.telemetry,
);
const app = express();
app.use(workspaces.middleware());
const server = createServer(app);
const production = import.meta.url.includes('/dist/server/');
let closeVite: (() => Promise<void>) | undefined;
if (!production) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  closeVite = () => vite.close();
} else {
  const clientDir = join(projectRoot, 'dist/client');
  if (!existsSync(join(clientDir, 'index.html')))
    throw new Error('Build Devloom first with npm run build.');
  app.use(express.static(clientDir));
  app.get('/{*path}', (_req, res) => res.sendFile(join(clientDir, 'index.html')));
}
server.on('error', (error) => {
  console.error(`Cannot start Devloom: ${error.message}`);
  process.exit(1);
});
server.listen(port, host, () =>
  console.log(
    `\n  Devloom · Weave your services into one workspace.\n  http://localhost:${port}\n  Data: ${dataDir}\n`,
  ),
);
let exiting = false;
async function shutdown() {
  if (exiting) return;
  exiting = true;
  console.log('\nStopping managed services…');

  receiver.close();
  server.close();
  await workspaces.shutdown();
  await closeVite?.();
  server.closeAllConnections();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
