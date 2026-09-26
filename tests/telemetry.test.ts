import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { TelemetryStore, createReceiver } from '../server/telemetry.js';

const span = (traceId = 'a'.repeat(32), spanId = 'b'.repeat(16)) => ({
  traceId,
  spanId,
  name: 'GET /test',
  startTimeUnixNano: '1770000000000000000',
  endTimeUnixNano: '1770000000012000000',
  status: { code: 1 },
  attributes: [{ key: 'http.route', value: { stringValue: '/test' } }],
});
const payload = (spans: unknown[], name = 'Test API') => ({
  resourceSpans: [
    {
      resource: {
        attributes: [{ key: 'service.name', value: { stringValue: name } }],
      },
      scopeSpans: [{ scope: { name: 'test' }, spans }],
    },
  ],
});
async function availablePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
async function until(fn: () => boolean) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 7000) throw new Error('Telemetry not received');
    await new Promise((r) => setTimeout(r, 30));
  }
}

test('trace store correlates services, keeps hierarchy, deduplicates spans and reports errors', () => {
  const store = new TelemetryStore('http://127.0.0.1:4318');
  store.ingestTraces(payload([span()]));
  store.ingestTraces(
    payload(
      [
        {
          ...span('a'.repeat(32), 'c'.repeat(16)),
          parentSpanId: 'b'.repeat(16),
          status: { code: 2, message: 'Example failure' },
        },
      ],
      'Test Worker',
    ),
  );
  store.ingestTraces(payload([span()]));
  const snapshot = store.snapshot();
  assert.equal(snapshot.traces.length, 1);
  assert.equal(snapshot.spanCount, 2);
  assert.equal(snapshot.traces[0].duration, 12);
  assert.equal(snapshot.traces[0].error, true);
  assert.deepEqual(snapshot.traces[0].services, ['Test API', 'Test Worker']);
  assert.equal(store.trace('a'.repeat(32))[1].parentSpanId, 'b'.repeat(16));
  assert.equal(store.ingestTraces(payload([{ ...span(), traceId: 'bad' }])), 1);
  store.close();
});
test('metric store preserves gauges, sums, histogram buckets and temporality', () => {
  const store = new TelemetryStore('http://127.0.0.1:4318');
  store.ingestMetrics({
    resourceMetrics: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'Metrics API' } }],
        },
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'queue.depth',
                unit: '{job}',
                gauge: {
                  dataPoints: [{ timeUnixNano: '1770000000000000000', asInt: '7' }],
                },
              },
              {
                name: 'requests',
                sum: {
                  aggregationTemporality: 2,
                  dataPoints: [{ timeUnixNano: '1770000000000000000', asInt: '100' }],
                },
              },
              {
                name: 'latency',
                unit: 'ms',
                histogram: {
                  aggregationTemporality: 1,
                  dataPoints: [
                    {
                      timeUnixNano: '1770000000000000000',
                      count: '4',
                      sum: 100,
                      bucketCounts: ['1', '2', '1'],
                      explicitBounds: [10, 30],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  });
  const series = store.snapshot().metrics;
  assert.equal(series.find((m) => m.name === 'queue.depth')!.points[0].value, 7);
  assert.equal(series.find((m) => m.name === 'requests')!.temporality, 'Cumulative');
  const histogram = series.find((m) => m.name === 'latency')!;
  assert.equal(histogram.temporality, 'Delta');
  assert.equal(histogram.points[0].value, 25);
  assert.deepEqual(histogram.points[0].buckets, [1, 2, 1]);
  store.close();
});
test('OTLP receiver accepts protobuf, JSON and real Node SDK exports, rejects malformed data', async (t) => {
  const port = await availablePort();
  const endpoint = `http://127.0.0.1:${port}`;
  const store = new TelemetryStore(endpoint);
  const receiver = await createReceiver(store, process.cwd(), port);
  t.after(() => receiver.close());
  if (!receiver.server.listening) await once(receiver.server, 'listening');
  assert.equal(
    (
      await fetch(`${endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload([span()])),
      })
    ).status,
    200,
  );
  const binaryPayload = payload([
    {
      ...span('d'.repeat(32), 'e'.repeat(16)),
      traceId: Buffer.from('d'.repeat(32), 'hex'),
      spanId: Buffer.from('e'.repeat(16), 'hex'),
    },
  ]);
  const binary = receiver.types.traces
    .encode(receiver.types.traces.fromObject(binaryPayload))
    .finish();
  const response = await fetch(`${endpoint}/v1/traces`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-protobuf' },
    body: Buffer.from(binary),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /protobuf/);
  assert.equal(store.snapshot().traces.length, 2);
  assert.equal(
    (
      await fetch(`${endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{broken',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${endpoint}/v1/traces`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://untrusted.example',
        },
        body: '{}',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${endpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
    200,
  );
  await promisify(execFile)(process.execPath, ['examples/telemetry.mjs'], {
    env: {
      ...process.env,
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      OTEL_SERVICE_NAME: 'SDK test',
    },
  });
  await until(() => store.snapshot().traces.some((t) => t.name === 'POST /checkout'));
  assert.equal(store.snapshot().traces.find((t) => t.name === 'POST /checkout')!.spanCount, 4);
  assert.ok(store.snapshot().metrics.some((m) => m.name === 'checkout.duration'));
});
