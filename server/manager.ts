import { EventEmitter } from 'node:events';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir, totalmem, freemem } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { stripVTControlCharacters, promisify } from 'node:util';
import type {
  Health,
  LogEntry,
  Service,
  ServiceConfig,
  MemorySnapshot,
  MemoryPoint,
} from '../src/types.js';

export class InputError extends Error {}
export class ConflictError extends Error {}

type Runtime = {
  service: Service;
  child?: ChildProcess;
  closed?: Promise<void>;
  logs: LogEntry[];
  checking: boolean;
};
const MAX_LOGS = 1000;
const expandHome = (path: string) =>
  path === '~' ? homedir() : path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;

export function validateConfig(input: unknown): Omit<ServiceConfig, 'id'> {
  if (!input || typeof input !== 'object')
    throw new InputError('Service configuration is required.');
  const x = input as Record<string, unknown>;
  const required = (key: string, max: number) => {
    if (
      typeof x[key] !== 'string' ||
      !x[key].trim() ||
      x[key].length > max ||
      x[key].includes('\0')
    )
      throw new InputError(`Enter a valid ${key}.`);
    return x[key].trim();
  };
  const name = required('name', 80);
  const directory = expandHome(required('directory', 4096));
  if (!isAbsolute(directory))
    throw new InputError('Directory must be an absolute path or start with ~/.');
  try {
    if (!statSync(directory).isDirectory()) throw new Error();
  } catch {
    throw new InputError('Project directory does not exist.');
  }
  const command = required('command', 4096);
  if (
    !Array.isArray(x.args) ||
    x.args.length > 100 ||
    x.args.some((a) => typeof a !== 'string' || a.length > 8192 || a.includes('\0'))
  )
    throw new InputError('Arguments must be a list of strings (up to 100).');
  const port =
    x.port === undefined || x.port === null || x.port === '' ? undefined : Number(x.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535))
    throw new InputError('Port must be between 1 and 65535.');
  let healthUrl: string | undefined;
  if (x.healthUrl) {
    try {
      if (typeof x.healthUrl !== 'string' || x.healthUrl.length > 4096) throw new Error();
      const url = new URL(x.healthUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.username ||
        url.password
      )
        throw new Error();
      healthUrl = url.href;
    } catch {
      throw new InputError('Health URL must use HTTP(S) on localhost, 127.0.0.1, or [::1].');
    }
  }
  const kind = x.kind ?? 'service';
  if (!['api', 'worker', 'frontend', 'scheduler', 'service'].includes(String(kind)))
    throw new InputError('Choose a valid service type.');
  return {
    name,
    directory: resolve(directory),
    command,
    args: x.args as string[],
    port,
    healthUrl,
    kind: kind as ServiceConfig['kind'],
  };
}

export class ProcessManager extends EventEmitter {
  private runtimes = new Map<string, Runtime>();
  private sequence = 0;
  private timer: ReturnType<typeof setInterval>;
  private memoryTimer: ReturnType<typeof setInterval>;
  private memoryBusy = false;
  private memoryHistory = new Map<string, MemoryPoint[]>();
  private totalMemoryHistory: MemoryPoint[] = [];
  private memoryError?: string;
  private totalMemoryPeak = 0;
  private memorySampledAt?: number;
  private memoryPeaks = new Map<string, number>();
  private closing = false;
  private busy = new Set<string>();
  readonly file: string;

  constructor(
    readonly dataDir: string,
    healthInterval = 5000,
    readonly telemetryEndpoint = 'http://127.0.0.1:4318',
  ) {
    super();
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.file = join(dataDir, 'services.json');
    if (existsSync(this.file)) {
      const configs: unknown = JSON.parse(readFileSync(this.file, 'utf8'));
      if (!Array.isArray(configs)) throw new Error('services.json must contain an array.');
      for (const input of configs) {
        // Preserve unavailable project directories, but never resume old processes.
        if (
          !input ||
          typeof input.id !== 'string' ||
          !/^[a-zA-Z0-9-]+$/.test(input.id) ||
          this.runtimes.has(input.id) ||
          typeof input.name !== 'string' ||
          typeof input.directory !== 'string' ||
          typeof input.command !== 'string' ||
          !Array.isArray(input.args)
        )
          throw new Error('Invalid services.json. Restore a valid configuration.');
        this.runtimes.set(input.id, this.runtime(input));
      }
    }
    this.timer = setInterval(() => {
      for (const runtime of this.runtimes.values()) void this.checkHealth(runtime);
    }, healthInterval);
    this.timer.unref();
    this.memoryTimer = setInterval(() => {
      void this.sampleMemory();
    }, 3000);
    this.memoryTimer.unref();
    void this.sampleMemory();
  }

  memory(): MemorySnapshot {
    return {
      sampledAt: this.memorySampledAt,
      totalBytes: totalmem(),
      freeBytes: freemem(),
      error: this.memoryError,
      managedBytes: this.list().reduce((sum, s) => sum + (s.memoryBytes ?? 0), 0),
      peakBytes: this.totalMemoryPeak,
      history: this.totalMemoryHistory,
      services: this.list().map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        pid: s.pid,
        memoryBytes: s.memoryBytes,
        peakBytes: this.memoryPeaks.get(s.id) ?? 0,
        history: this.memoryHistory.get(s.id) ?? [],
      })),
    };
  }
  async sampleMemory() {
    if (this.memoryBusy || this.closing) return;
    this.memoryBusy = true;
    const owners = [...this.runtimes.values()].map((r) => ({
      r,
      pid: r.service.pid,
    }));
    try {
      const processes = new Map<number, { parent: number; bytes: number }>();
      if (owners.some((x) => x.pid)) {
        const { stdout } = await promisify(execFile)('/bin/ps', ['-axo', 'pid=,ppid=,rss='], {
          timeout: 2000,
          maxBuffer: 4 * 1024 * 1024,
        });
        for (const line of stdout.trim().split('\n')) {
          const [pid, parent, kib] = line.trim().split(/\s+/).map(Number);
          if (Number.isFinite(pid) && Number.isFinite(parent) && Number.isFinite(kib))
            processes.set(pid, { parent, bytes: kib * 1024 });
        }
      }
      if (this.closing) return;
      const children = new Map<number, number[]>();
      for (const [pid, process] of processes)
        children.set(process.parent, [...(children.get(process.parent) ?? []), pid]);
      const now = Date.now();
      for (const { r, pid } of owners) {
        if (r.service.pid !== pid || !this.runtimes.has(r.service.id)) continue;
        const visited = new Set<number>();
        const pending = pid ? [pid] : [];
        let bytes = 0;
        while (pending.length) {
          const current = pending.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          bytes += processes.get(current)?.bytes ?? 0;
          pending.push(...(children.get(current) ?? []));
        }
        r.service.memoryBytes = bytes;
        r.service.memorySampledAt = now;
        const history = this.memoryHistory.get(r.service.id) ?? [];
        history.push({ time: now, bytes });
        this.memoryHistory.set(r.service.id, history.slice(-120));
        this.memoryPeaks.set(
          r.service.id,
          Math.max(this.memoryPeaks.get(r.service.id) ?? 0, bytes),
        );
      }
      this.memorySampledAt = now;
      this.memoryError = undefined;
      this.totalMemoryPeak = Math.max(this.totalMemoryPeak, this.memory().managedBytes);
      this.totalMemoryHistory.push({
        time: now,
        bytes: this.memory().managedBytes,
      });
      this.totalMemoryHistory = this.totalMemoryHistory.slice(-120);
      this.changed();
      this.emit('memory');
    } catch (error) {
      this.memoryError = (error as Error).message;
      this.emit('memory');
    } finally {
      this.memoryBusy = false;
    }
  }

  private runtime(config: ServiceConfig): Runtime {
    return {
      service: {
        ...config,
        status: 'stopped',
        health: config.healthUrl ? 'pending' : 'none',
      },
      logs: [],
      checking: false,
    };
  }
  list() {
    return [...this.runtimes.values()].map((r) => ({ ...r.service }));
  }
  logs(id?: string) {
    return (id ? this.get(id).logs : [...this.runtimes.values()].flatMap((r) => r.logs))
      .slice()
      .sort((a, b) => a.id - b.id);
  }
  private get(id: string) {
    const r = this.runtimes.get(id);
    if (!r) throw new InputError('Service not found.');
    return r;
  }
  private changed() {
    this.emit('state', this.list());
  }
  private save() {
    const configs = this.list().map(
      ({ id, name, directory, command, args, port, healthUrl, kind }) => ({
        id,
        name,
        directory,
        command,
        args,
        port,
        healthUrl,
        kind,
      }),
    );
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(configs, null, 2) + '\n', {
      mode: 0o600,
    });
    renameSync(tmp, this.file);
  }
  add(input: unknown) {
    if (this.runtimes.size >= 100) throw new InputError('A workspace supports up to 100 services.');
    const config = { ...validateConfig(input), id: randomUUID() };
    this.runtimes.set(config.id, this.runtime(config));
    try {
      this.save();
    } catch (error) {
      this.runtimes.delete(config.id);
      throw error;
    }
    this.changed();
    return this.get(config.id).service;
  }
  update(id: string, input: unknown) {
    const r = this.get(id);
    if (r.child || this.busy.has(id))
      throw new ConflictError('Stop this service before editing it.');
    const config = { ...validateConfig(input), id };
    const previous = r.service;
    r.service = this.runtime(config).service;
    try {
      this.save();
    } catch (error) {
      r.service = previous;
      throw error;
    }
    this.changed();
    return r.service;
  }
  remove(id: string) {
    const r = this.get(id);
    if (r.child || this.busy.has(id))
      throw new ConflictError('Stop this service before removing it.');
    this.runtimes.delete(id);
    try {
      this.save();
    } catch (error) {
      this.runtimes.set(id, r);
      throw error;
    }
    this.memoryHistory.delete(id);
    this.memoryPeaks.delete(id);
    this.changed();
  }
  private log(r: Runtime, stream: LogEntry['stream'], message: string) {
    const entry: LogEntry = {
      id: ++this.sequence,
      time: Date.now(),
      serviceId: r.service.id,
      stream,
      message: stripVTControlCharacters(message)
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
        .slice(0, 8192),
    };
    r.logs.push(entry);
    if (r.logs.length > MAX_LOGS) r.logs.splice(0, r.logs.length - MAX_LOGS);
    this.emit('log', entry);
  }
  private signal(child: ChildProcess, signal: NodeJS.Signals) {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }
  private startProcess(id: string) {
    const r = this.get(id);
    if (this.closing) throw new ConflictError('Devloom is shutting down.');
    if (r.child) return r.service;
    validateConfig(r.service);
    r.service = {
      ...r.service,
      status: 'starting',
      health: r.service.healthUrl ? 'pending' : 'none',
      pid: undefined,
      startedAt: undefined,
      exitCode: undefined,
      error: undefined,
    };
    this.log(r, 'system', `Starting ${r.service.command} ${r.service.args.join(' ')}`);
    this.changed();
    const child = spawn(r.service.command, r.service.args, {
      cwd: r.service.directory,
      detached: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DEVLOOM_AUTH_USERNAME: undefined,
        DEVLOOM_AUTH_PASSWORD: undefined,
        FORCE_COLOR: '0',
        PYTHONUNBUFFERED: '1',
        OTEL_SERVICE_NAME: r.service.name,
        OTEL_EXPORTER_OTLP_ENDPOINT:
          process.env.OTEL_EXPORTER_OTLP_ENDPOINT || this.telemetryEndpoint,
        OTEL_EXPORTER_OTLP_PROTOCOL: process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http/protobuf',
      },
    });
    r.child = child;
    const buffers = { stdout: '', stderr: '' };
    for (const stream of ['stdout', 'stderr'] as const) {
      child[stream]!.setEncoding('utf8');
      child[stream]!.on('data', (chunk: string) => {
        buffers[stream] += chunk;
        let newline: number;
        while ((newline = buffers[stream].indexOf('\n')) >= 0) {
          this.log(r, stream, buffers[stream].slice(0, newline));
          buffers[stream] = buffers[stream].slice(newline + 1);
        }
        while (buffers[stream].length >= 8192) {
          this.log(r, stream, buffers[stream].slice(0, 8192));
          buffers[stream] = buffers[stream].slice(8192);
        }
      });
    }
    // Flush output without a newline, so interactive progress messages are visible too.
    const flush = setInterval(() => {
      for (const stream of ['stdout', 'stderr'] as const)
        if (buffers[stream]) {
          this.log(r, stream, buffers[stream]);
          buffers[stream] = '';
        }
    }, 250);
    child.on('spawn', () => {
      if (r.service.status === 'starting') r.service.status = 'running';
      r.service.pid = child.pid;
      r.service.startedAt = Date.now();
      this.log(r, 'system', `Process started · PID ${child.pid}`);
      this.changed();
      void this.checkHealth(r);
      void this.sampleMemory();
    });
    child.on('error', (error) => {
      r.service.error = error.message;
      this.log(r, 'stderr', error.message);
    });
    r.closed = new Promise<void>((done) => {
      child.on('exit', () => {
        try {
          this.signal(child, 'SIGKILL');
        } catch (error) {
          // Exit can race with OS process-group cleanup. Never prevent the close
          // event from settling lifecycle operations if cleanup is denied.
          this.log(r, 'system', `Process-group cleanup: ${(error as Error).message}`);
        }
      });
      child.on('close', (code, signal) => {
        clearInterval(flush);
        for (const stream of ['stdout', 'stderr'] as const)
          if (buffers[stream]) this.log(r, stream, buffers[stream]);
        const stopped = r.service.status === 'stopping';
        r.service.status = stopped || (code === 0 && !r.service.error) ? 'stopped' : 'failed';
        r.service.exitCode = code;
        r.service.pid = undefined;
        r.service.memoryBytes = 0;
        r.service.startedAt = undefined;
        r.service.health = r.service.healthUrl ? 'pending' : 'none';
        r.child = undefined;
        this.log(
          r,
          'system',
          `Process ${stopped ? 'stopped' : 'exited'} · ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}`,
        );
        this.changed();
        done();
      });
    });
    return r.service;
  }
  private async stopProcess(id: string) {
    const r = this.get(id);
    if (!r.child) return;
    const child = r.child;
    r.service.status = 'stopping';
    this.changed();
    this.log(r, 'system', 'Stopping process group…');
    this.signal(child, 'SIGTERM');
    const timeout = setTimeout(() => {
      this.log(r, 'system', 'Grace period elapsed; forcing process group to stop.');
      this.signal(child, 'SIGKILL');
    }, 3000);
    try {
      await r.closed;
    } finally {
      clearTimeout(timeout);
    }
  }
  async action(id: string, action: 'start' | 'stop' | 'restart') {
    this.get(id);
    if (this.busy.has(id)) throw new ConflictError('A lifecycle action is already in progress.');
    this.busy.add(id);
    try {
      if (action !== 'start') await this.stopProcess(id);
      if (action !== 'stop') this.startProcess(id);
      return this.get(id).service;
    } finally {
      this.busy.delete(id);
    }
  }
  private async checkHealth(r: Runtime) {
    if (r.checking || !r.service.healthUrl || r.service.status !== 'running') return;
    r.checking = true;
    const child = r.child;
    let health: Health;
    try {
      const response = await fetch(r.service.healthUrl, {
        signal: AbortSignal.timeout(2000),
        redirect: 'error',
      });
      health = response.ok ? 'healthy' : 'unhealthy';
      await response.body?.cancel();
    } catch {
      health = 'unhealthy';
    } finally {
      r.checking = false;
    }
    if (r.child === child && r.service.status === 'running' && r.service.health !== health) {
      r.service.health = health;
      this.changed();
    }
  }
  async shutdown() {
    this.closing = true;
    clearInterval(this.timer);
    clearInterval(this.memoryTimer);
    await Promise.all([...this.runtimes.keys()].map((id) => this.stopProcess(id)));
  }
}
