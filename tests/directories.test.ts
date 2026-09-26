import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { listDirectories } from '../server/directories.js';
import { ProcessManager } from '../server/manager.js';
import { createApp } from '../server/app.js';
import { createServer } from 'node:http';
import { once } from 'node:events';

test('folder browser lists directories, follows links, filters, paginates and handles invalid paths', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'devloom-folders-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await Promise.all([
    mkdir(join(dir, 'Auth Service')),
    mkdir(join(dir, '.hidden')),
    writeFile(join(dir, 'config.json'), '{}'),
  ]);
  await symlink(join(dir, 'Auth Service'), join(dir, 'linked'));
  await symlink(join(dir, 'missing'), join(dir, 'broken'));
  await symlink(join(dir, 'config.json'), join(dir, 'file-link'));
  const list = await listDirectories({ path: dir }, process.cwd());
  assert.deepEqual(
    list.entries.map((f) => f.name),
    ['Auth Service', 'linked'],
  );
  assert.equal(list.entries[1].symlink, true);
  assert.equal(
    (await listDirectories({ path: join(dir, 'linked') }, process.cwd())).path,
    join(dir, 'Auth Service'),
  );
  assert.equal((await listDirectories({ path: dir, hidden: true }, process.cwd())).total, 3);
  assert.deepEqual(
    (await listDirectories({ path: dir, query: 'aUtH' }, process.cwd())).entries.map((f) => f.name),
    ['Auth Service'],
  );
  assert.equal(
    (await listDirectories({ path: '~' }, process.cwd())).path,
    await realpath(homedir()),
  );
  assert.equal((await listDirectories({ path: '/' }, process.cwd())).parent, null);
  await Promise.all(Array.from({ length: 105 }, (_, i) => mkdir(join(dir, `Folder ${i}`))));
  const first = await listDirectories({ path: dir, query: 'Folder' }, process.cwd());
  const second = await listDirectories({ path: dir, query: 'Folder', offset: 100 }, process.cwd());
  assert.equal(first.entries.length, 100);
  assert.equal(first.hasMore, true);
  assert.equal(second.entries.length, 5);
  assert.equal(second.hasMore, false);
  assert.equal(first.entries[2].name, 'Folder 2');
  assert.equal(second.entries[0].name, 'Folder 100');
  for (const options of [
    null,
    [],
    { path: 3 },
    { path: 'relative/path' },
    { path: '\0' },
    { offset: -1 },
    { hidden: 'yes' },
  ])
    await assert.rejects(() => listDirectories(options, process.cwd()));
  await assert.rejects(
    () => listDirectories({ path: join(dir, 'missing') }, process.cwd()),
    /does not exist/,
  );
  await assert.rejects(
    () => listDirectories({ path: join(dir, 'config.json') }, process.cwd()),
    /is a file/,
  );
});

test('folder listing API requires a session and rejects cross-origin access', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'devloom-folder-api-'));
  const manager = new ProcessManager(dir);
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const { app, dispose } = createApp(manager, process.cwd(), port);
  server.on('request', app);
  t.after(async () => {
    dispose();
    await manager.shutdown();
    server.closeAllConnections();
    server.close();
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  const { token } = await (await fetch(`${base}/api/session`)).json();
  const request = (headers = {}) =>
    fetch(`${base}/api/directories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ path: dir }),
    });
  assert.equal((await request()).status, 403);
  assert.equal(
    (await request({ 'x-devloom-token': token, origin: 'https://example.org' })).status,
    403,
  );
  const response = await request({ 'x-devloom-token': token });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).path, await realpath(dir));
});
