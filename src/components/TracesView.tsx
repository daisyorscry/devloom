import { TabLoading } from './TabLoading';
import { TelemetrySetup } from './TelemetrySetup';
import { AttributeList } from './AttributeList';
import { duration, timestamp, orderedSpans } from '../lib/traces';
import { TableHead, TableRow, TableCell } from './Table';
import { Button } from './Button';
import { useTraces } from '../hooks/useTraces';
import { Dropdown } from './Dropdown';
import { SearchInput } from './SearchInput';
import { ArrowUpRight, Radio, X } from 'lucide-react';
export function TracesView({ version }: { version: number }) {
  const {
    snapshot,
    service,
    query,
    setQuery,
    error,
    loading,
    traceId,
    setTraceId,
    spans,
    spanId,
    setSpanId,
    setup,
    setSetup,
    traces,
    trace,
    span,
    filterService,
  } = useTraces(version);

  if (loading) return <TabLoading label="traces" />;
  return (
    <section
      className="telemetry-view flex min-h-0 flex-1 flex-col gap-4 px-8 pb-4 max-compact:px-4"
      aria-label="traces viewer"
    >
      <div className="telemetry-toolbar flex shrink-0 flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 text-small">
          Service
          <Dropdown
            label="Filter traces by service"
            value={service}
            onValueChange={filterService}
            options={[
              {
                value: '',
                label: 'All services',
              },
              ...(snapshot?.services ?? []).map((name) => ({
                value: name,
                label: name,
              })),
            ]}
            className="max-w-60"
          />
        </label>
        <SearchInput
          label="Search traces"
          placeholder="Search operation or trace ID…"
          value={query}
          onValueChange={setQuery}
          className="max-w-96 flex-1 max-compact:max-w-none max-compact:basis-full"
        />
        <div className="receiver-state ml-auto flex items-center gap-2 text-small text-secondary">
          <span
            className={`dot inline-block size-1.5 shrink-0 rounded-full bg-current
              ${snapshot?.receiver === 'listening' ? 'online-dot text-healthy' : ''}`}
          />
          <span>
            {snapshot?.receiver === 'listening' ? 'OTLP connected' : 'Receiver unavailable'}
          </span>
          <Button variant="text" onClick={() => setSetup(true)}>
            Setup
            <ArrowUpRight size={13} />
          </Button>
        </div>
      </div>
      {(error || snapshot?.receiverError) && (
        <div
          className="telemetry-error shrink-0 rounded-lg bg-danger-surface px-3 py-2 text-small
            text-danger"
          role="alert"
        >
          {error || snapshot?.receiverError}
        </div>
      )}
      <div
        className={`telemetry-body flex min-h-0 flex-1 gap-5 max-compact:flex-col
          ${trace ? 'has-selection' : ''}`}
      >
        <div className="telemetry-list min-h-0 min-w-0 flex-1 overflow-auto">
          <table
            className="telemetry-table w-full table-fixed border-separate border-spacing-y-0.5
              text-left"
          >
            <thead>
              <tr>
                <TableHead>Operation</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => (
                <TableRow
                  key={t.id}
                  className={traceId === t.id ? 'is-selected bg-selected!' : ''}
                  onClick={() => {
                    setTraceId(t.id);
                    setSpanId('');
                  }}
                >
                  <TableCell>
                    <button
                      className="flex max-w-full items-center gap-2 truncate bg-transparent p-0
                        text-left text-ink"
                      onClick={() => {
                        setTraceId(t.id);
                        setSpanId('');
                      }}
                    >
                      <span
                        className={`dot inline-block size-1.5 shrink-0 rounded-full bg-current
                        ${t.error ? 'error-dot text-danger' : 'online-dot text-healthy'}`}
                      />
                      {t.name}
                    </button>
                    <small className="block truncate">
                      {t.spanCount} spans · {t.id.slice(0, 12)}
                    </small>
                  </TableCell>
                  <TableCell>
                    {t.services.length === 1 ? t.services[0] : `${t.services.length} services`}
                  </TableCell>
                  <TableCell className="mono tabular-nums">{duration(t.duration)}</TableCell>
                  <TableCell className="mono tabular-nums">{timestamp(t.startTime)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </table>
          {!traces.length && (
            <div
              className="telemetry-empty flex min-h-0 flex-1 flex-col items-center justify-center
                gap-4 p-6 text-center text-secondary"
            >
              <Radio size={22} />
              <h2>{query || service ? 'No matching traces' : 'Waiting for traces'}</h2>
              <p>
                {query || service
                  ? 'Change the service filter or search.'
                  : `Point your instrumented services to ${snapshot?.endpoint ?? 'the local receiver'}.`}
              </p>
              {!query && !service && (
                <Button variant="secondary" onClick={() => setSetup(true)}>
                  Connection setup
                  <ArrowUpRight size={14} />
                </Button>
              )}
            </div>
          )}
        </div>
        {trace && (
          <aside
            className="trace-detail flex w-[48%] min-w-0 flex-col gap-4 overflow-auto border-l
              border-line pl-5 max-compact:max-h-[55%] max-compact:w-full max-compact:border-l-0
              max-compact:pl-0"
          >
            <div className="telemetry-detail-heading flex items-start justify-between gap-4">
              <div>
                <h2>{trace.name}</h2>
                <span>
                  {duration(trace.duration)} · {trace.spanCount} spans
                </span>
              </div>
              <Button variant="icon" aria-label="Close trace" onClick={() => setTraceId('')}>
                <X size={17} />
              </Button>
            </div>
            <div className="trace-id text-small break-all text-muted">{trace.id}</div>
            <div className="waterfall-header flex justify-between text-small text-muted">
              <span>Service / operation</span>
              <span>{duration(trace.duration)}</span>
            </div>
            <div className="waterfall space-y-1">
              {orderedSpans(spans).map(({ span: s, depth }) => (
                <button
                  key={s.spanId}
                  className={`waterfall-row grid w-full grid-cols-[minmax(100px,40%)_1fr_70px]
                  items-center gap-3 rounded-md bg-transparent py-2 text-left text-small
                  hover:bg-hover ${spanId === s.spanId ? 'selected bg-selected! text-ink!' : ''}`}
                  onClick={() => setSpanId(s.spanId)}
                >
                  <span
                    style={{
                      paddingLeft: Math.min(depth, 8) * 12,
                    }}
                  >
                    <small className="block truncate">{s.service}</small>
                    <strong className="block truncate font-medium">{s.name}</strong>
                  </span>
                  <span className="waterfall-track relative h-6 overflow-hidden rounded bg-control">
                    <i
                      className={
                        (s.status === 'error' ? 'error-span bg-danger!' : '') +
                        ' absolute top-1 h-4 min-w-1 rounded bg-accent'
                      }
                      style={{
                        left: `${Math.max(0, ((s.startTime - trace.startTime) / Math.max(trace.duration, 0.01)) * 100)}%`,
                        width: `${Math.max(0.7, (s.duration / Math.max(trace.duration, 0.01)) * 100)}%`,
                      }}
                    />
                  </span>
                  <em className="text-right not-italic">{duration(s.duration)}</em>
                </button>
              ))}
            </div>
            {span ? (
              <div className="span-inspector space-y-3 border-t border-line pt-4">
                <h3>{span.name}</h3>
                <p>
                  {span.kind} · {span.status === 'unset' ? 'No error reported' : span.status} ·{' '}
                  {duration(span.duration)}
                </p>
                {span.statusMessage && (
                  <p className="error-text text-danger">{span.statusMessage}</p>
                )}
                <AttributeList attributes={span.attributes} />
                {span.events.length > 0 && (
                  <>
                    <h3>Events</h3>
                    {span.events.map((event, index) => (
                      <div className="span-event mt-4 border-t border-line pt-3" key={index}>
                        <strong>{event.name}</strong>
                        <span>{timestamp(event.time)}</span>
                        <AttributeList attributes={event.attributes} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <p className="inspect-hint text-small text-muted">
                Select a span to inspect attributes and events.
              </p>
            )}
          </aside>
        )}
      </div>
      <div
        className="telemetry-footer flex shrink-0 justify-between gap-4 text-small text-secondary"
      >
        <span>{`${snapshot?.traces.length ?? 0} traces · ${snapshot?.spanCount ?? 0} spans`}</span>
        <span>
          In-memory ·{' '}
          {snapshot?.lastReceived
            ? `Last export ${timestamp(snapshot.lastReceived)}`
            : 'No exports received'}
        </span>
      </div>
      {setup && <TelemetrySetup snapshot={snapshot} onClose={() => setSetup(false)} />}
    </section>
  );
}
