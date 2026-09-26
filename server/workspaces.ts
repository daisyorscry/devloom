import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { ProcessManager, InputError, ConflictError } from './manager.js';
import { TelemetryStore } from './telemetry.js';
import { createApp } from './app.js';
import type { Workspace } from '../src/types.js';

export class WorkspaceRegistry {
  private entries: Workspace[];
  private contexts = new Map<
    string,
    ReturnType<typeof createApp> & { manager: ProcessManager; telemetry: TelemetryStore }
  >();
  readonly file: string;
  readonly defaultTelemetry: TelemetryStore;
  constructor(
    readonly dataDir: string,
    readonly projectRoot: string,
    readonly port: number,
    readonly otlpPort: number,
  ) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.file = join(dataDir, 'workspaces.json');
    this.entries = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, 'utf8'))
      : [{ id: 'default', name: 'Local workspace' }];
    if (
      !Array.isArray(this.entries) ||
      !this.entries.some((w) => w.id === 'default') ||
      this.entries.length > 50 ||
      new Set(this.entries.map((w) => w.id)).size !== this.entries.length ||
      this.entries.some(
        (w) => !w || !/^[a-zA-Z0-9-]+$/.test(w.id) || typeof w.name !== 'string' || !w.name.trim(),
      )
    )
      throw new Error('Invalid workspaces.json. Restore a valid workspace index.');
    this.save();
    this.defaultTelemetry = this.context('default')!.telemetry;
  }
  list() {
    return this.entries.map((w) => ({ ...w }));
  }
  private name(input: unknown) {
    if (
      typeof input !== 'string' ||
      !input.trim() ||
      input.trim().length > 80 ||
      /[\x00-\x1f\x7f]/.test(input)
    )
      throw new InputError('Enter a project name between 1 and 80 characters.');
    if (this.entries.some((w) => w.name.toLowerCase() === input.trim().toLowerCase()))
      throw new ConflictError('A project with this name already exists.');
    return input.trim();
  }
  private save() {
    writeFileSync(`${this.file}.tmp`, JSON.stringify(this.entries, null, 2), { mode: 0o600 });
    renameSync(`${this.file}.tmp`, this.file);
  }
  add(input: unknown) {
    if (this.entries.length >= 50)
      throw new ConflictError('A maximum of 50 projects can be registered.');
    const entry = { id: randomUUID(), name: this.name(input) };
    this.entries.push(entry);
    try {
      this.save();
    } catch (error) {
      this.entries.pop();
      throw error;
    }
    return entry;
  }
  rename(id: string, input: unknown) {
    const entry = this.entries.find((w) => w.id === id);
    if (!entry) throw new InputError('Project does not exist.');
    if (input === entry.name) return { ...entry };
    const previous = entry.name;
    entry.name = this.name(input);
    try {
      this.save();
    } catch (error) {
      entry.name = previous;
      throw error;
    }
    return { ...entry };
  }
  async remove(id: string) {
    if (id === 'default')
      throw new ConflictError('The original local workspace cannot be removed.');
    const context = this.context(id);
    if (!context) throw new InputError('Project does not exist.');
    if (context.manager.list().length)
      throw new ConflictError("Remove this project's services before deleting it.");
    const previous = this.entries;
    this.entries = this.entries.filter((w) => w.id !== id);
    try {
      this.save();
    } catch (error) {
      this.entries = previous;
      throw error;
    }
    context.dispose();
    await context.manager.shutdown();
    context.telemetry.close();
    this.contexts.delete(id);
    rmSync(join(this.dataDir, 'workspaces', id), { recursive: true, force: true });
  }
  context(id: string) {
    if (!this.entries.some((w) => w.id === id)) return undefined;
    let context = this.contexts.get(id);
    if (!context) {
      const endpoint = `http://127.0.0.1:${this.otlpPort}${id === 'default' ? '' : `/workspaces/${id}`}`;
      const telemetry = new TelemetryStore(endpoint);
      const manager = new ProcessManager(
        id === 'default' ? this.dataDir : join(this.dataDir, 'workspaces', id),
        5000,
        endpoint,
      );
      context = {
        manager,
        telemetry,
        ...createApp(manager, this.projectRoot, this.port, telemetry, { registry: this, id }),
      };
      this.contexts.set(id, context);
    }
    if (this.defaultTelemetry && context.telemetry !== this.defaultTelemetry) {
      context.telemetry.receiver = this.defaultTelemetry.receiver;
      context.telemetry.receiverError = this.defaultTelemetry.receiverError;
    }
    return context;
  }
  middleware(): express.RequestHandler {
    return (req, res, next) => {
      const id = req.query.workspace ?? 'default';
      const context = typeof id === 'string' ? this.context(id) : undefined;
      if (!context)
        return res.status(404).json({ error: 'Project does not exist. Select another project.' });
      context.app(req, res, next);
    };
  }
  async shutdown() {
    await Promise.all(
      [...this.contexts.values()].map(async (c) => {
        c.dispose();
        c.telemetry.close();
        await c.manager.shutdown();
      }),
    );
  }
}
