import { useState } from 'react';
import { ArrowLeft, GitBranch, GanttChart, Workflow } from 'lucide-react';
import type { TelemetrySpan, TraceSummary } from '../types';
import { duration, timestamp } from '../lib/traces';
import { Button } from './Button';
import { TabButton } from './TabButton';
import { AttributeList } from './AttributeList';
import { TraceDiagram, type TraceView } from './TraceDiagram';

export function TraceDetail({
  trace,
  spans,
  span,
  onSelect,
  onClose,
}: {
  trace: TraceSummary;
  spans: TelemetrySpan[];
  span?: TelemetrySpan;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<TraceView>('flow');
  const modes = [
    { id: 'flow', label: 'Process flow', icon: GitBranch },
    { id: 'sequence', label: 'Service sequence', icon: Workflow },
    { id: 'timeline', label: 'Timeline', icon: GanttChart },
  ] as const;
  return (
    <section
      className="trace-detail flex min-h-0 min-w-0 flex-1 flex-col gap-4
        max-compact:overflow-y-auto"
      aria-label="Trace details"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="text" onClick={onClose}>
            <ArrowLeft size={16} />
            All traces
          </Button>
          <h2 className="mt-2 break-words">{trace.name}</h2>
          <p className="mt-1 text-small text-secondary">
            {duration(trace.duration)} · {trace.spanCount} steps · {trace.services.length} services
            · {timestamp(trace.startTime)}
          </p>
        </div>
        <span
          className={`rounded-lg px-3 py-2 text-small
            ${trace.error ? 'bg-danger-surface text-danger' : 'bg-control text-secondary'}`}
        >
          {trace.error ? 'Contains errors' : 'No errors reported'}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap gap-1" aria-label="Trace diagrams">
          {modes.map(({ id, label, icon: Icon }) => (
            <TabButton key={id} active={view === id} onClick={() => setView(id)}>
              <Icon size={16} />
              {label}
            </TabButton>
          ))}
        </div>
        <span className="text-small break-all text-muted">Trace {trace.id}</span>
      </div>
      <p className="text-small text-secondary">
        {view === 'flow'
          ? 'Follow the parent–child relationships across every service in this trace.'
          : view === 'sequence'
            ? 'Each lane is a service. Arrows connect parent and child steps; vertical spacing is not elapsed time.'
            : 'Compare start times and durations. Overlapping bars show work happening at the same time.'}
      </p>
      <div className="flex min-h-0 flex-1 gap-5 max-desktop:flex-col max-compact:flex-none">
        <div
          className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-line bg-stripe/30
            max-compact:h-[420px] max-compact:flex-none"
        >
          <TraceDiagram
            trace={trace}
            spans={spans}
            view={view}
            selected={span?.spanId ?? ''}
            onSelect={onSelect}
          />
        </div>
        <aside
          className="span-inspector w-80 shrink-0 space-y-4 overflow-auto border-l border-line pl-5
            max-desktop:max-h-[35%] max-desktop:w-full max-desktop:border-t max-desktop:border-l-0
            max-desktop:pt-3 max-desktop:pl-0 max-compact:max-h-none"
          aria-label="Step details"
        >
          {span ? (
            <>
              <div>
                <p className="text-small text-secondary">{span.service}</p>
                <h3 className="mt-1 break-words">{span.name}</h3>
              </div>
              <p className="text-small">
                {span.kind} · {duration(span.duration)} ·{' '}
                {span.status === 'unset' ? 'No error reported' : span.status}
              </p>
              <dl className="space-y-2 text-small">
                <div>
                  <dt className="text-muted">Span ID</dt>
                  <dd className="break-all">{span.spanId}</dd>
                </div>
                <div>
                  <dt className="text-muted">Parent span</dt>
                  <dd className="break-all">{span.parentSpanId || 'Entry point'}</dd>
                </div>
              </dl>
              {span.statusMessage && <p className="text-danger">{span.statusMessage}</p>}
              <AttributeList attributes={span.attributes} />
              {span.events.length > 0 && (
                <>
                  <h3>Events</h3>
                  {span.events.map((event, index) => (
                    <div className="space-y-2 border-t border-line pt-3" key={index}>
                      <strong>{event.name}</strong>
                      <p className="text-small text-muted">{timestamp(event.time)}</p>
                      <AttributeList attributes={event.attributes} />
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <h3>Explore this trace</h3>
              <p className="text-small text-secondary">
                Select any step to inspect its service, attributes, and events. Switch diagrams to
                see the same process from another angle.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
