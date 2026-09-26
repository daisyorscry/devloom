import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { ProcessManager, validateConfig } from '../server/manager.js';

const config = (script: string) => ({
  name: 'Test service',
  directory: process.cwd(),
  command: process.execPath,
  args: ['-e', script],
  kind: 'service',
});
async function until(predicate: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for process state');
    await new Promise((r) => setTimeout(r, 25));
  }
}
function setup(t: test.TestContext, interval = 100) {
  const dir = mkdtempSync(join(tmpdir(), 'devloom-test-'));
  const manager = new ProcessManager(dir, interval);
  t.after(async () => {
    await manager.shutdown();
    rmSync(dir, { recursive: true, force: true });
  });
  return manager;
}
test('persists configuration, captures stdout/stderr, restarts and stops real processes', async (t) => {
  const manager = setup(t);
  const service = manager.add(
    config(
      'console.log("hello stdout"); console.error("hello stderr"); setInterval(() => {}, 1000)',
    ),
  );
  const saved = JSON.parse(readFileSync(manager.file, 'utf8'));
  assert.equal(saved[0].name, 'Test service');
  assert.equal(saved[0].status, undefined);
  await manager.action(service.id, 'start');
  await until(() => manager.logs(service.id).some((l) => l.message === 'hello stderr'));
  assert.equal(manager.list()[0].status, 'running');
  const firstPid = manager.list()[0].pid;
  assert.ok(firstPid);
  assert.ok(
    manager.logs(service.id).some((l) => l.stream === 'stdout' && l.message === 'hello stdout'),
  );
  assert.ok(
    manager.logs(service.id).some((l) => l.stream === 'stderr' && l.message === 'hello stderr'),
  );
  assert.throws(() => manager.update(service.id, config('')), /Stop this service/);
  assert.throws(() => manager.remove(service.id), /Stop this service/);
  await manager.action(service.id, 'restart');
  await until(() => manager.list()[0].status === 'running');
  assert.notEqual(manager.list()[0].pid, firstPid);
  assert.throws(() => process.kill(firstPid, 0));
  await manager.action(service.id, 'stop');
  assert.equal(manager.list()[0].status, 'stopped');
  assert.equal(manager.list()[0].pid, undefined);
  manager.update(service.id, { ...config(''), name: 'Renamed service' });
  const reloaded = new ProcessManager(manager.dataDir);
  assert.equal(reloaded.list()[0].name, 'Renamed service');
  assert.equal(reloaded.list()[0].status, 'stopped');
  await reloaded.shutdown();
  manager.remove(service.id);
  assert.equal(manager.list().length, 0);
});
test('marks missing executables and nonzero exits as failed', async (t) => {
  const manager = setup(t);
  const missing = manager.add({
    ...config(''),
    command: '/devloom/no-such-command',
  });
  await manager.action(missing.id, 'start');
  await until(() => manager.list()[0].status === 'failed');
  assert.match(manager.list()[0].error!, /ENOENT/);
  const fail = manager.add(config('console.error("intentional failure"); process.exit(7)'));
  await manager.action(fail.id, 'start');
  await until(() => manager.list().find((s) => s.id === fail.id)?.status === 'failed');
  assert.equal(manager.list().find((s) => s.id === fail.id)?.exitCode, 7);
});
test('rejects invalid directories, ports, health URLs and arguments', () => {
  assert.throws(
    () => validateConfig({ ...config(''), directory: '/devloom/missing' }),
    /does not exist/,
  );
  assert.throws(() => validateConfig({ ...config(''), directory: 'relative' }), /absolute path/);
  assert.throws(() => validateConfig({ ...config(''), port: 65536 }), /Port/);
  assert.throws(
    () =>
      validateConfig({
        ...config(''),
        healthUrl: 'https://example.com/health',
      }),
    /Health URL/,
  );
  assert.throws(() => validateConfig({ ...config(''), args: 'run dev' }), /Arguments/);
});
test('health reflects HTTP success, failure and stopped state', async (t) => {
  let healthy = true;
  const server = createServer((_req, res) => {
    res.writeHead(healthy ? 200 : 503);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const port = (server.address() as { port: number }).port;
  const manager = setup(t);
  const service = manager.add({
    ...config('setInterval(() => {},1000)'),
    healthUrl: `http://127.0.0.1:${port}/health`,
  });
  await manager.action(service.id, 'start');
  await until(() => manager.list()[0].health === 'healthy');
  healthy = false;
  await until(() => manager.list()[0].health === 'unhealthy');
  await manager.action(service.id, 'stop');
  assert.equal(manager.list()[0].health, 'pending');
});
test('caps logs and flushes output without trailing newlines', async (t) => {
  const manager = setup(t);
  const service = manager.add(
    config(
      'for(let i=0;i<1200;i++) console.log("line " + i); process.stdout.write("partial"); setInterval(() => {},1000)',
    ),
  );
  await manager.action(service.id, 'start');
  await until(() => manager.logs(service.id).some((l) => l.message === 'partial'));
  assert.equal(manager.logs(service.id).length, 1000);
  assert.ok(!manager.logs(service.id).some((l) => l.message === 'line 0'));
});
test('stops process groups including descendants that ignore SIGTERM', async (t) => {
  const manager = setup(t);
  const childScript = 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)';
  const script = `const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e',${JSON.stringify(childScript)}],{stdio:'inherit'}); console.log('descendant:'+child.pid); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`;
  const service = manager.add(config(script));
  await manager.action(service.id, 'start');
  await until(() => manager.logs(service.id).some((l) => l.message.startsWith('descendant:')));
  const pid = Number(
    manager
      .logs(service.id)
      .find((l) => l.message.startsWith('descendant:'))!
      .message.split(':')[1],
  );
  await new Promise((r) => setTimeout(r, 150));
  await manager.action(service.id, 'stop');
  assert.equal(manager.list()[0].status, 'stopped');
  await until(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch {
      return true;
    }
  });
});
test('concurrent lifecycle actions cannot duplicate processes', async (t) => {
  const manager = setup(t);
  const service = manager.add(config('setInterval(()=>{},1000)'));
  await manager.action(service.id, 'start');
  await until(() => manager.list()[0].status === 'running');
  const firstPid = manager.list()[0].pid;
  await manager.action(service.id, 'start');
  assert.equal(manager.list()[0].pid, firstPid);
  const results = await Promise.allSettled([
    manager.action(service.id, 'restart'),
    manager.action(service.id, 'restart'),
  ]);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

test('samples actual resident memory for a process and its child process', async (t) => {
  const manager = setup(t);
  const childScript = 'global.buffer=Buffer.alloc(24*1024*1024,1);setInterval(()=>{},1000)';
  const script = `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',${JSON.stringify(childScript)}],{stdio:'inherit'});console.log('memory ready');setInterval(()=>{},1000)`;
  const service = manager.add(config(script));
  await manager.action(service.id, 'start');
  await until(() => manager.logs(service.id).some((l) => l.message === 'memory ready'));
  await new Promise((r) => setTimeout(r, 150));
  await manager.sampleMemory();
  const measured = manager.memory();
  assert.ok(measured.services[0].memoryBytes! > 24 * 1024 * 1024);
  assert.equal(measured.managedBytes, measured.services[0].memoryBytes);
  assert.ok(measured.totalBytes > measured.managedBytes);
  assert.ok(measured.history.length > 0);
  assert.ok(manager.list()[0].memoryBytes! > 0);
  await manager.action(service.id, 'stop');
  await manager.sampleMemory();
  assert.equal(manager.memory().services[0].memoryBytes, 0);
  assert.ok(manager.memory().services[0].peakBytes > 0);
});
