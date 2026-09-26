import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import protobuf from 'protobufjs';
import type {
  MetricPoint,
  MetricSeries,
  TelemetrySnapshot,
  TelemetrySpan,
  TraceSummary,
} from '../src/types.js';

type Obj = Record<string, unknown>;
const object = (x: unknown): Obj =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {};
const array = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const text = (x: unknown, fallback = '') => (typeof x === 'string' ? x.slice(0, 4096) : fallback);
const numeric = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
function attributes(input: unknown): Record<string, string> {
  return Object.fromEntries(
    array(input)
      .slice(0, 64)
      .map((item) => {
        const x = object(item);
        const value = object(x.value);
        const raw =
          value.stringValue ??
          value.intValue ??
          value.doubleValue ??
          value.boolValue ??
          value.arrayValue ??
          value.kvlistValue ??
          '';
        return [
          text(x.key),
          (typeof raw === 'object' ? JSON.stringify(raw) : String(raw)).slice(0, 4096),
        ];
      }),
  );
}
function nanos(value: unknown): bigint {
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}
const toMs = (ns: bigint) => Number(ns / 1_000_000n) + Number(ns % 1_000_000n) / 1_000_000;
function id(value: unknown, length: number) {
  const result =
    value instanceof Uint8Array ? Buffer.from(value).toString('hex') : text(value).toLowerCase();
  return new RegExp(`^[a-f0-9]{${length}}$`).test(result) && !/^0+$/.test(result) ? result : '';
}
const serviceName = (resource: unknown) =>
  attributes(object(resource).attributes)['service.name'] || 'unknown_service';
const spanKinds = ['Internal', 'Internal', 'Server', 'Client', 'Producer', 'Consumer'];

export class TelemetryStore extends EventEmitter {
  private traces = new Map<string, Map<string, TelemetrySpan>>();
  private series = new Map<string, MetricSeries>();
  private changedTimer?: ReturnType<typeof setTimeout>;
  private spanCount = 0;
  private lastReceived?: number;
  receiver: TelemetrySnapshot['receiver'] = 'starting';
  receiverError?: string;
  constructor(readonly endpoint: string) {
    super();
  }
  private changed() {
    this.lastReceived = Date.now();
    if (!this.changedTimer)
      this.changedTimer = setTimeout(() => {
        this.changedTimer = undefined;
        this.emit('change');
      }, 200);
  }
  close() {
    clearTimeout(this.changedTimer);
  }
  setReceiver(state: TelemetrySnapshot['receiver'], error?: string) {
    this.receiver = state;
    this.receiverError = error;
    this.emit('change');
  }
  ingestTraces(payload: unknown) {
    if (
      object(payload).resourceSpans !== undefined &&
      !Array.isArray(object(payload).resourceSpans)
    )
      throw new Error('Expected resourceSpans array.');
    let rejected = 0;
    for (const resource of array(object(payload).resourceSpans)) {
      const r = object(resource);
      const service = serviceName(r.resource);
      for (const scoped of array(r.scopeSpans)) {
        const scope = object(scoped);
        for (const raw of array(scope.spans)) {
          const s = object(raw);
          const traceId = id(s.traceId, 32);
          const spanId = id(s.spanId, 16);
          const start = nanos(s.startTimeUnixNano);
          const end = nanos(s.endTimeUnixNano);
          if (!traceId || !spanId || start <= 0n || end < start) {
            rejected++;
            continue;
          }
          const status = object(s.status);
          const span: TelemetrySpan = {
            traceId,
            spanId,
            parentSpanId: id(s.parentSpanId, 16),
            service,
            name: text(s.name, '(unnamed span)'),
            scope: text(object(scope.scope).name),
            startTime: toMs(start),
            duration: toMs(end - start),
            status: status.code === 2 ? 'error' : status.code === 1 ? 'ok' : 'unset',
            statusMessage: text(status.message),
            kind: spanKinds[numeric(s.kind)] || 'Internal',
            attributes: {
              ...attributes(object(r.resource).attributes),
              ...attributes(s.attributes),
            },
            events: array(s.events)
              .slice(0, 64)
              .map((event) => {
                const e = object(event);
                return {
                  name: text(e.name),
                  time: toMs(nanos(e.timeUnixNano)),
                  attributes: attributes(e.attributes),
                };
              }),
          };
          let spans = this.traces.get(traceId);
          if (!spans) {
            spans = new Map();
            this.traces.set(traceId, spans);
          }
          if (spans.size >= 500 && !spans.has(spanId)) {
            rejected++;
            continue;
          }
          if (!spans.has(spanId)) this.spanCount++;
          spans.set(spanId, span);
          // Evict whole traces, preserving parent/child relationships in retained traces.
          while (this.traces.size > 300 || this.spanCount > 10000) {
            const oldest = this.traces.keys().next().value!;
            this.spanCount -= this.traces.get(oldest)!.size;
            this.traces.delete(oldest);
          }
        }
      }
    }
    this.changed();
    return rejected;
  }
  ingestMetrics(payload: unknown) {
    if (
      object(payload).resourceMetrics !== undefined &&
      !Array.isArray(object(payload).resourceMetrics)
    )
      throw new Error('Expected resourceMetrics array.');
    let rejected = 0;
    for (const resource of array(object(payload).resourceMetrics)) {
      const r = object(resource);
      const service = serviceName(r.resource);
      for (const scoped of array(r.scopeMetrics)) {
        const scope = object(scoped);
        for (const raw of array(scope.metrics)) {
          const metric = object(raw);
          const kind = (
            ['gauge', 'sum', 'histogram', 'exponentialHistogram', 'summary'] as const
          ).find((key) => metric[key]);
          if (!kind || !text(metric.name)) {
            rejected++;
            continue;
          }
          const data = object(metric[kind]);
          for (const point of array(data.dataPoints)) {
            const p = object(point);
            if (numeric(p.flags) & 1) continue; // NO_RECORDED_VALUE
            const time = toMs(nanos(p.timeUnixNano));
            if (!time) {
              rejected++;
              continue;
            }
            const attrs = attributes(p.attributes);
            const identity = JSON.stringify([
              service,
              attributes(object(r.resource).attributes),
              object(scope.scope),
              metric.name,
              kind,
              metric.unit,
              data.aggregationTemporality,
              Object.entries(attrs).sort(),
            ]);
            const key = createHash('sha256').update(identity).digest('hex').slice(0, 24);
            const histogram = ['histogram', 'exponentialHistogram', 'summary'].includes(kind);
            const count = histogram ? numeric(p.count) : undefined;
            const sum = histogram && p.sum !== undefined ? numeric(p.sum) : undefined;
            const value = histogram
              ? sum !== undefined && count
                ? sum / count
                : (count ?? 0)
              : numeric(p.asDouble ?? p.asInt);
            const next: MetricPoint = {
              time,
              value,
              count,
              sum,
              min: p.min === undefined ? undefined : numeric(p.min),
              max: p.max === undefined ? undefined : numeric(p.max),
              buckets: kind === 'histogram' ? array(p.bucketCounts).map(numeric) : undefined,
              bounds: kind === 'histogram' ? array(p.explicitBounds).map(numeric) : undefined,
            };
            let series = this.series.get(key);
            if (!series) {
              series = {
                id: key,
                name: text(metric.name),
                service,
                description: text(metric.description),
                unit: text(metric.unit),
                kind,
                temporality:
                  numeric(data.aggregationTemporality) === 1
                    ? 'Delta'
                    : numeric(data.aggregationTemporality) === 2
                      ? 'Cumulative'
                      : 'Instant',
                attributes: attrs,
                points: [],
              };
              this.series.set(key, series);
            }
            const existing = series.points.findIndex((x) => x.time === time);
            if (existing >= 0) series.points[existing] = next;
            else series.points.push(next);
            series.points.sort((a, b) => a.time - b.time);
            series.points = series.points.slice(-120);
            while (this.series.size > 500) this.series.delete(this.series.keys().next().value!);
          }
        }
      }
    }
    this.changed();
    return rejected;
  }
  trace(traceId: string) {
    return [...(this.traces.get(traceId)?.values() ?? [])].sort(
      (a, b) => a.startTime - b.startTime,
    );
  }
  snapshot(): TelemetrySnapshot {
    const traces: TraceSummary[] = [...this.traces]
      .map(([traceId, entries]) => {
        const spans = [...entries.values()];
        const root =
          spans.find((s) => !s.parentSpanId) ??
          spans.reduce((a, b) => (a.startTime < b.startTime ? a : b));
        const start = Math.min(...spans.map((s) => s.startTime));
        return {
          id: traceId,
          name: root.name,
          startTime: start,
          duration: Math.max(...spans.map((s) => s.startTime + s.duration)) - start,
          services: [...new Set(spans.map((s) => s.service))],
          spanCount: spans.length,
          error: spans.some((s) => s.status === 'error'),
        };
      })
      .sort((a, b) => b.startTime - a.startTime);
    const metrics = [...this.series.values()].sort((a, b) => a.name.localeCompare(b.name));
    return {
      endpoint: this.endpoint,
      receiver: this.receiver,
      receiverError: this.receiverError,
      services: [
        ...new Set([...traces.flatMap((t) => t.services), ...metrics.map((m) => m.service)]),
      ].sort(),
      traces,
      metrics,
      spanCount: this.spanCount,
      lastReceived: this.lastReceived,
    };
  }
}

export async function createReceiver(
  store: TelemetryStore,
  projectRoot: string,
  port: number,
  host = '127.0.0.1',
  resolveStore?: (id: string) => TelemetryStore | undefined,
) {
  const root = new protobuf.Root();
  root.resolvePath = (_origin, target) => join(projectRoot, 'server/proto', target);
  await root.load([
    'opentelemetry/proto/collector/trace/v1/trace_service.proto',
    'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
  ]);
  const types = {
    traces: root.lookupType('opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest'),
    metrics: root.lookupType(
      'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
    ),
  };
  const responses = {
    traces: root.lookupType('opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse'),
    metrics: root.lookupType(
      'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceResponse',
    ),
  };
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (
      ![`localhost:${port}`, `127.0.0.1:${port}`].includes(req.headers.host ?? '') ||
      req.headers.origin ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      return res.status(403).json({ message: 'Local SDK export only.' });
    next();
  });
  app.use(
    express.raw({
      type: ['application/json', 'application/x-protobuf'],
      limit: '4mb',
      inflate: true,
    }),
  );
  for (const signal of ['traces', 'metrics'] as const)
    app.post([`/v1/${signal}`, `/workspaces/:workspaceId/v1/${signal}`], (req, res) => {
      const target = req.params.workspaceId
        ? resolveStore?.(String(req.params.workspaceId))
        : store;
      if (!target) return res.status(404).json({ message: 'Project does not exist.' });
      const binary = req.is('application/x-protobuf');
      if (!Buffer.isBuffer(req.body))
        return res.status(415).json({ message: 'Use application/json or application/x-protobuf.' });
      try {
        const payload = binary
          ? types[signal].toObject(types[signal].decode(req.body), {
              longs: String,
              bytes: Buffer,
              enums: Number,
            })
          : JSON.parse(req.body.toString('utf8'));
        const rejected =
          signal === 'traces' ? target.ingestTraces(payload) : target.ingestMetrics(payload);
        const response = rejected
          ? {
              partialSuccess: {
                [signal === 'traces' ? 'rejectedSpans' : 'rejectedDataPoints']: rejected,
                errorMessage: 'Invalid identifiers, timestamps, or unsupported data points.',
              },
            }
          : {};
        if (binary)
          return res
            .type('application/x-protobuf')
            .send(
              Buffer.from(
                responses[signal].encode(responses[signal].fromObject(response)).finish(),
              ),
            );
        return res.json(response);
      } catch (error) {
        return res.status(400).json({
          code: 3,
          message: `Invalid OTLP ${signal}: ${(error as Error).message}`,
        });
      }
    });
  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      protocol: 'OTLP/HTTP',
      signals: ['traces', 'metrics'],
    }),
  );
  app.use((_req, res) => res.status(404).json({ message: 'Use /v1/traces or /v1/metrics.' }));
  const handleError: express.ErrorRequestHandler = (error, _req, res, _next) =>
    res
      .status(error.type === 'entity.too.large' ? 413 : 400)
      .json({ code: 3, message: error.message });
  app.use(handleError);
  const server = createServer(app);
  server.on('error', (error) => {
    store.setReceiver('error', error.message);
    console.error(`Telemetry receiver: ${error.message}`);
  });
  server.listen(port, host, () => {
    store.setReceiver('listening');
    console.log(`  OTLP/HTTP: ${store.endpoint}`);
  });
  return {
    server,
    types,
    close: () => {
      store.close();
      server.close();
      server.closeAllConnections();
    },
  };
}
