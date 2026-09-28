import { useId } from 'react';
import type { TelemetrySpan, TraceSummary } from '../types';
import { duration, traceRows } from '../lib/traces';

export type TraceView = 'flow' | 'sequence' | 'timeline';
type Props = {
  spans: TelemetrySpan[];
  trace: TraceSummary;
  view: TraceView;
  selected: string;
  onSelect: (id: string) => void;
};

export function TraceDiagram({ spans, trace, view, selected, onSelect }: Props) {
  const arrow = useId().replace(/:/g, '');
  const rows = traceRows(spans);
  const services = [...new Set(rows.map(({ span }) => span.service))];
  const step = 100;
  const top = view === 'sequence' ? 68 : 0;
  const depthX = (depth: number) => 24 + Math.min(depth, 10) * 28;
  const laneX = (service: string) => 140 + services.indexOf(service) * 260;
  const width =
    view === 'sequence'
      ? Math.max(560, services.length * 260 + 20)
      : Math.max(280, ...rows.map(({ depth }) => depthX(depth) + 250));
  const height = top + rows.length * step;
  if (!spans.length) return <p className="p-6 text-secondary">Loading trace steps…</p>;

  if (view === 'timeline')
    return (
      <div className="min-w-[620px] p-4" aria-label="Trace timeline">
        <div className="mb-4 grid grid-cols-[240px_1fr_80px] gap-4 text-small text-muted">
          <span>Service / operation</span>
          <div className="flex justify-between">
            <span>0 ms</span>
            <span>{duration(trace.duration / 2)}</span>
            <span>{duration(trace.duration)}</span>
          </div>
          <span className="text-right">Duration</span>
        </div>
        {rows.map(({ span, depth }) => (
          <button
            key={span.spanId}
            aria-pressed={selected === span.spanId}
            onClick={() => onSelect(span.spanId)}
            className={`waterfall-row mb-1 grid w-full grid-cols-[240px_1fr_80px] items-center gap-4
            rounded-lg px-3 py-3 text-left hover:bg-hover
            ${selected === span.spanId ? 'bg-selected' : 'bg-stripe'}`}
          >
            <span className="min-w-0" style={{ paddingLeft: Math.min(depth, 8) * 12 }}>
              <span className="block truncate text-small text-secondary">{span.service}</span>
              <span className="block truncate" title={span.name}>
                {span.name}
              </span>
            </span>
            <span className="relative h-8 overflow-hidden rounded bg-control">
              <span
                className={`absolute top-2 h-4 min-w-1 rounded
                ${span.status === 'error' ? 'bg-danger' : 'bg-accent'}`}
                style={{
                  left: `${Math.min(99.5, Math.max(0, ((span.startTime - trace.startTime) / Math.max(trace.duration, 0.01)) * 100))}%`,
                  width: `${Math.max(0.5, (span.duration / Math.max(trace.duration, 0.01)) * 100)}%`,
                }}
              />
            </span>
            <span className="text-right text-small tabular-nums">{duration(span.duration)}</span>
          </button>
        ))}
      </div>
    );

  return (
    <div
      className="relative m-4"
      style={{ minWidth: width, height }}
      aria-label={view === 'flow' ? 'Trace process flow' : 'Trace service sequence'}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-muted"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
          </marker>
        </defs>
        {view === 'sequence' &&
          services.map((service) => (
            <line
              key={service}
              x1={laneX(service)}
              x2={laneX(service)}
              y1={44}
              y2={height}
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeDasharray="4 6"
            />
          ))}
        {rows.map(({ span, depth, parentIndex }, index) => {
          if (parentIndex === null) return null;
          const parent = rows[parentIndex];
          const x1 = view === 'flow' ? depthX(parent.depth) : laneX(parent.span.service);
          const x2 = view === 'flow' ? depthX(depth) : laneX(span.service);
          const y1 = top + parentIndex * step + (view === 'flow' ? 46 : 82);
          const y2 = top + index * step + (view === 'flow' ? 38 : 0);
          const path =
            view === 'flow'
              ? `M ${x1 + 16} ${y1} H ${x1} V ${y2} H ${x2 + 16}`
              : `M ${x1} ${y1} V ${y2 - 12} H ${x2} V ${y2}`;
          return (
            <path
              key={span.spanId}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              markerEnd={`url(#${arrow})`}
            />
          );
        })}
      </svg>
      {view === 'sequence' &&
        services.map((service, index) => (
          <div
            key={service}
            className="absolute top-0 w-60 truncate border-b-2 border-accent pb-3 text-center
              font-medium"
            style={{ left: 20 + index * 260 }}
            title={service}
          >
            {service}
          </div>
        ))}
      {rows.map(({ span, depth, parentIndex, missingParent }, index) => {
        const parent = parentIndex === null ? null : rows[parentIndex].span;
        return (
          <button
            key={span.spanId}
            data-span-id={span.spanId}
            aria-label={`Inspect ${span.service}: ${span.name}`}
            aria-pressed={selected === span.spanId}
            onClick={() => onSelect(span.spanId)}
            className={`trace-flow-step absolute flex h-20 flex-col justify-center gap-1 rounded-lg
            border px-4 text-left hover:border-accent
            ${selected === span.spanId ? 'border-accent bg-selected' : 'border-line bg-panel'}`}
            style={{
              top: top + index * step,
              left: view === 'flow' ? depthX(depth) + 16 : laneX(span.service) - 120,
              right: view === 'flow' ? 0 : undefined,
              width: view === 'sequence' ? 240 : undefined,
            }}
          >
            <span
              className="flex w-full items-center justify-between gap-4 text-small text-secondary"
            >
              <span className="truncate">
                {view === 'flow' ? `${span.service} · ${span.kind}` : `Step ${index + 1}`}
              </span>
              <span
                className={`shrink-0 tabular-nums ${span.status === 'error' ? 'text-danger' : ''}`}
              >
                {span.status === 'error' ? 'Error · ' : ''}
                {duration(span.duration)}
              </span>
            </span>
            <span className="block w-full truncate font-medium" title={span.name}>
              {span.name}
            </span>
            <span
              className="block w-full truncate text-small text-muted"
              title={parent ? `${parent.service} / ${parent.name}` : undefined}
            >
              {missingParent
                ? 'Parent span not received'
                : parent
                  ? `From ${parent.service} / ${parent.name}`
                  : span.parentSpanId
                    ? 'Unlinked step'
                    : 'Entry point'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
