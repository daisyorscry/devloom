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
  const result: {
    span: TelemetrySpan;
    depth: number;
  }[] = [];
  const seen = new Set<string>();
  const ids = new Set(spans.map((span) => span.spanId));
  const children = new Map<string, TelemetrySpan[]>();
  for (const span of spans)
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
  for (const span of spans) if (!span.parentSpanId || !ids.has(span.parentSpanId)) visit(span, 0);
  for (const span of spans) visit(span, 0);
  return result;
}
