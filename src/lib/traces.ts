import type { TelemetrySpan } from '../types';
export const duration = (value: number) =>
  value < 1
    ? `${(value * 1000).toFixed(0)} µs`
    : value < 1000
      ? `${value.toFixed(1)} ms`
      : `${(value / 1000).toFixed(2)} s`;
export const timestamp = (value: number) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour12: false,
  });
export function orderedSpans(spans: TelemetrySpan[]) {
  const sorted = [...spans].sort(
    (a, b) => a.startTime - b.startTime || a.spanId.localeCompare(b.spanId),
  );
  const result: {
    span: TelemetrySpan;
    depth: number;
  }[] = [];
  const seen = new Set<string>();
  const ids = new Set(spans.map((span) => span.spanId));
  const children = new Map<string, TelemetrySpan[]>();
  for (const span of sorted)
    children.set(span.parentSpanId, [...(children.get(span.parentSpanId) ?? []), span]);
  function visit(span: TelemetrySpan, depth: number) {
    if (seen.has(span.spanId)) return;
    seen.add(span.spanId);
    result.push({
      span,
      depth,
    });
    for (const child of children.get(span.spanId) ?? []) visit(child, depth + 1);
  }
  for (const span of sorted) if (!span.parentSpanId || !ids.has(span.parentSpanId)) visit(span, 0);
  for (const span of sorted) visit(span, 0);
  return result;
}

export function traceRows(spans: TelemetrySpan[]) {
  const rows = orderedSpans(spans);
  const indices = new Map(rows.map(({ span }, index) => [span.spanId, index]));
  return rows.map((row, index) => {
    const parent = indices.get(row.span.parentSpanId);
    return {
      ...row,
      // Only draw causal edges retained by the traversal; malformed cycles stay disconnected.
      parentIndex: row.depth > 0 && parent !== undefined && parent < index ? parent : null,
      missingParent: !!row.span.parentSpanId && parent === undefined,
    };
  });
}
