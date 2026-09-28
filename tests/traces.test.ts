import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRows } from '../src/lib/traces.js';
import type { TelemetrySpan } from '../src/types.js';

const span = (
  spanId: string,
  parentSpanId: string,
  startTime: number,
  service = 'API',
): TelemetrySpan => ({
  traceId: 'shared-trace',
  spanId,
  parentSpanId,
  startTime,
  service,
  name: spanId,
  scope: '',
  duration: 20,
  status: 'unset',
  statusMessage: '',
  kind: 'Internal',
  attributes: {},
  events: [],
});

test('trace flow links services by parent ID and orders siblings despite export order', () => {
  const rows = traceRows([
    span('db', 'payment', 15, 'Database'),
    span('inventory', 'root', 5, 'Inventory'),
    span('payment', 'root', 10, 'Payments'),
    span('root', '', 0),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.span.spanId, r.depth, r.parentIndex]),
    [
      ['root', 0, null],
      ['inventory', 1, 0],
      ['payment', 1, 0],
      ['db', 2, 2],
    ],
  );
});

test('partial traces and malformed cycles retain every step without inventing edges', () => {
  const rows = traceRows([span('orphan', 'missing', 0), span('a', 'b', 1), span('b', 'a', 2)]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].missingParent, true);
  assert.equal(rows[0].parentIndex, null);
  assert.equal(rows[1].parentIndex, null);
  assert.equal(rows[2].parentIndex, 1);
});
