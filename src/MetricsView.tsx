import { TabLoading } from './components/TabLoading';
import { TabButton } from './components/TabButton';
import { TimeChart } from './components/TimeChart';
import { TableHead, TableRow, TableCell } from './components/Table';
import { Button } from './components/Button';
import { useMetrics } from './hooks/useMetrics';
import { formatNumber, clock, colors, unitLabel, convert, explanation } from './lib/metrics';
import { Dropdown } from './components/Dropdown';
import { SearchInput } from './components/SearchInput';
import { ArrowUpRight, ChevronRight, Database } from 'lucide-react';
import { formatMemory } from './format';
export default function MetricsView({
  version,
  onSetup,
}: {
  version: number;
  onSetup: () => void;
}) {
  const {
    memory,
    mode,
    setMode,
    service,
    setService,
    range,
    setRange,
    query,
    setQuery,
    setMetricId,
    error,
    loading,
    services,
    visibleMemoryPoints,
    memoryCurrent,
    peak,
    memoryRows,
    metricOptions,
    metric,
    last,
    chartData,
    mean,
    label,
  } = useMetrics(version);

  if (loading) return <TabLoading label="metrics" />;
  return (
    <section
      className="metrics-workspace flex min-h-0 flex-1 flex-col gap-4 px-8 pb-4 max-compact:gap-3
        max-compact:px-4"
      aria-label="Metrics workspace"
    >
      <div
        className="metrics-control-bar flex shrink-0 flex-wrap items-center justify-between gap-3"
      >
        <div className="metrics-mode flex items-center gap-1" aria-label="Metric category">
          <TabButton active={mode === 'memory'} onClick={() => setMode('memory')}>
            Memory
          </TabButton>
          <TabButton active={mode === 'application'} onClick={() => setMode('application')}>
            Application metrics
          </TabButton>
        </div>
        <div className="metrics-filters flex items-center gap-2 max-compact:w-full">
          <Dropdown
            label="Filter metrics by service"
            value={service}
            onValueChange={(value) => {
              setService(value);
              setMetricId('');
            }}
            options={[
              {
                value: '',
                label: 'All services',
              },
              ...services.map((name) => ({
                value: name,
                label: name,
              })),
            ]}
            className="max-w-60 max-compact:min-w-0 max-compact:flex-1"
          />
          <Dropdown
            label="Metric time range"
            value={String(range)}
            onValueChange={(value) => setRange(Number(value))}
            options={[
              {
                value: '60000',
                label: 'Last minute',
              },
              {
                value: '300000',
                label: 'Last 5 minutes',
              },
              {
                value: '360000',
                label: 'Last 6 minutes',
              },
            ]}
            className="max-w-60 max-compact:min-w-0 max-compact:flex-1"
          />
          {mode === 'application' && (
            <Button variant="text" onClick={onSetup}>
              Setup
              <ArrowUpRight size={14} />
            </Button>
          )}
        </div>
      </div>
      {(error || memory?.error) && (
        <div
          className="telemetry-error shrink-0 rounded-lg bg-danger-surface px-3 py-2 text-small
            text-danger"
          role="alert"
        >
          {error || memory?.error}
        </div>
      )}
      {mode === 'memory' ? (
        <div className="memory-dashboard flex min-h-0 flex-1 flex-col gap-4 max-compact:gap-3">
          <div className="measurement-heading flex shrink-0 items-start justify-between gap-4">
            <div>
              <h2>{service ? `${service} memory` : 'Memory usage'}</h2>
              <p className="mt-1 text-secondary">
                RAM used by {service ? 'this service' : 'your managed services'}, including child
                processes.
              </p>
            </div>
            <span
              className="sample-status flex items-center gap-2 text-small whitespace-nowrap
                text-secondary max-compact:hidden"
            >
              <span
                className="dot online-dot inline-block size-1.5 shrink-0 rounded-full bg-current
                  text-healthy"
              />
              Every 3 seconds
            </span>
          </div>
          <div className="memory-summary flex shrink-0 items-start gap-10 max-compact:gap-5">
            <div>
              <span className="mb-2 block text-small text-secondary">Current RSS</span>
              <strong className="block text-heading font-medium tracking-tight">
                {formatMemory(memoryCurrent)}
              </strong>
            </div>
            <div>
              <span className="mb-2 block text-small text-secondary">Peak in session</span>
              <strong className="block text-heading font-medium tracking-tight">
                {formatMemory(peak)}
              </strong>
            </div>
            <div>
              <span className="mb-2 block text-small text-secondary">Machine RAM</span>
              <strong className="block text-heading font-medium tracking-tight">
                {formatMemory(memory?.totalBytes)}
              </strong>
            </div>
            <div className="memory-scope ml-auto max-desktop:hidden">
              <span className="mb-2 block text-small text-secondary">Measurement</span>
              <p>Resident memory</p>
              <small className="mt-1 block">Process + descendants</small>
            </div>
          </div>
          <div className="memory-chart max-h-82 min-h-45 flex-1 max-compact:max-h-55">
            <TimeChart
              data={visibleMemoryPoints}
              unit="MiB"
              label={service || 'All managed services'}
            />
          </div>
          <div className="memory-table-area flex min-h-24 flex-1 flex-col">
            <div
              className="memory-table-heading flex shrink-0 items-center justify-between gap-4 pb-3
                text-small text-secondary"
            >
              <h3>Memory by service</h3>
              <span className="max-compact:hidden">RSS includes shared pages</span>
            </div>
            <div className="memory-table-scroll min-h-0 overflow-auto">
              <table
                className="memory-table w-full table-fixed border-separate border-spacing-0
                  text-left"
              >
                <thead>
                  <tr>
                    <TableHead className="first:w-[35%] last:w-[30%] max-compact:last:hidden">
                      Service
                    </TableHead>
                    <TableHead className="first:w-[35%] last:w-[30%] max-compact:last:hidden">
                      Current
                    </TableHead>
                    <TableHead className="first:w-[35%] last:w-[30%] max-compact:last:hidden">
                      Peak
                    </TableHead>
                    <TableHead className="first:w-[35%] last:w-[30%] max-compact:last:hidden">
                      Share of managed RSS
                    </TableHead>
                  </tr>
                </thead>
                <tbody>
                  {memoryRows.map((s, index) => (
                    <TableRow
                      key={s.id}
                      onClick={() => setService(service === s.name ? '' : s.name)}
                    >
                      <TableCell className="max-compact:last:hidden">
                        <button
                          onClick={() => setService(service === s.name ? '' : s.name)}
                          className="inline-flex max-w-full items-center gap-2 overflow-hidden
                            bg-transparent p-0 text-small text-ink"
                        >
                          <span
                            className="series-dot inline-block h-[7px] w-[7px] shrink-0
                              rounded-full"
                            style={{
                              background: colors[index % colors.length],
                            }}
                          />
                          {s.name}
                          <ChevronRight size={14} />
                        </button>
                      </TableCell>
                      <TableCell className="max-compact:last:hidden">
                        {formatMemory(s.memoryBytes)}
                      </TableCell>
                      <TableCell className="max-compact:last:hidden">
                        {formatMemory(s.peakBytes)}
                      </TableCell>
                      <TableCell className="max-compact:last:hidden">
                        <div className="memory-share flex items-center gap-4">
                          <span className="h-1.5 flex-1 overflow-hidden rounded bg-control">
                            <i
                              style={{
                                width: `${Math.min(100, ((s.memoryBytes ?? 0) / Math.max(memory?.managedBytes ?? 0, 1)) * 100)}%`,
                                background: colors[index % colors.length],
                              }}
                              className="block h-full rounded"
                            />
                          </span>
                          <strong className="w-12 text-right text-small font-normal">
                            {(
                              ((s.memoryBytes ?? 0) / Math.max(memory?.managedBytes ?? 0, 1)) *
                              100
                            ).toFixed(1)}
                            %
                          </strong>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </table>
              {!memoryRows.length && (
                <div
                  className="memory-empty flex flex-1 flex-col items-center justify-center gap-4 p-6
                    text-center text-small text-secondary"
                >
                  <Database size={20} />
                  <p>
                    {service
                      ? 'This service is not managed by Devloom.'
                      : 'Register and start a service to measure its memory.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div
            className="measurement-footer flex shrink-0 justify-between gap-4 text-small
              text-secondary"
          >
            <span className="max-compact:first:hidden">Read from the OS · no SDK required</span>
            <span className="max-compact:first:hidden">
              {memory?.sampledAt
                ? `Updated ${clock(memory.sampledAt)}`
                : 'Waiting for first sample'}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="application-metrics grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-6
            max-compact:grid-cols-1 max-compact:grid-rows-[140px_1fr] max-compact:gap-3"
        >
          <aside className="metric-picker flex min-h-0 flex-col gap-3">
            <SearchInput
              label="Search metrics"
              placeholder="Find a metric…"
              value={query}
              onValueChange={setQuery}
              className="w-full"
            />
            <div className="metric-picker-list min-h-0 flex-1 overflow-auto">
              {metricOptions.map((m) => (
                <button
                  key={m.id}
                  className={
                    (metric?.id === m.id ? 'selected bg-selected! text-ink!' : '') +
                    ` mb-1 flex w-full flex-col gap-1 rounded-lg bg-transparent p-3 text-left
                      hover:bg-hover`
                  }
                  onClick={() => setMetricId(m.id)}
                >
                  <span className="text-small text-secondary">{m.name}</span>
                  <small>
                    {m.service} · {m.kind}
                  </small>
                </button>
              ))}
              {!metricOptions.length && <p>No matching metrics.</p>}
            </div>
          </aside>
          {metric ? (
            <div className="app-metric-panel flex min-h-0 min-w-0 flex-col gap-4 overflow-auto">
              <div className="measurement-heading flex shrink-0 items-start justify-between gap-4">
                <div>
                  <h2>{metric.name}</h2>
                  <p className="mt-1 text-secondary">{metric.description || explanation(metric)}</p>
                </div>
                <span className="metric-source text-small text-secondary">{metric.service}</span>
              </div>
              <div className="app-metric-summary flex items-start gap-8">
                <div>
                  <span className="mb-2 block text-small text-secondary">
                    {mean
                      ? 'Average observation'
                      : metric.kind === 'sum'
                        ? 'Recorded total'
                        : 'Latest measurement'}
                  </span>
                  <strong className="block text-heading font-medium">
                    {formatNumber(convert(last?.value ?? 0, metric.unit))}
                    <small className="mt-1 block">{unitLabel(metric.unit)}</small>
                  </strong>
                </div>
                {last?.count !== undefined && (
                  <div>
                    <span className="mb-2 block text-small text-secondary">Observations</span>
                    <strong className="block text-heading font-medium">
                      {formatNumber(last.count)}
                    </strong>
                  </div>
                )}
                <div>
                  <span className="mb-2 block text-small text-secondary">Aggregation</span>
                  <p>{metric.temporality}</p>
                  <small className="mt-1 block">{explanation(metric)}</small>
                </div>
              </div>
              <div className="app-metric-chart max-h-72 min-h-48 flex-1">
                <TimeChart
                  data={chartData}
                  label={label ?? metric.name}
                  unit={unitLabel(metric.unit)}
                />
              </div>
              <div className="metric-extra space-y-3">
                {last?.buckets?.length ? (
                  <>
                    <h3>Distribution of observations</h3>
                    <div className="distribution-table space-y-2">
                      {last.buckets.map((count, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[140px_1fr_60px] items-center gap-4 text-small"
                        >
                          <span>
                            {index === 0
                              ? '≤'
                              : `${formatNumber(convert(last.bounds?.[index - 1] ?? 0, metric.unit))} –`}{' '}
                            {last.bounds?.[index] === undefined
                              ? '∞'
                              : formatNumber(convert(last.bounds[index], metric.unit))}{' '}
                            {unitLabel(metric.unit)}
                          </span>
                          <div className="h-2 overflow-hidden rounded bg-control">
                            <i
                              className="block h-full rounded bg-accent"
                              style={{
                                width: `${(count / Math.max(1, ...(last.buckets ?? []))) * 100}%`,
                              }}
                            />
                          </div>
                          <strong className="text-right font-medium">{formatNumber(count)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="metric-definition text-small leading-relaxed text-secondary">
                    {explanation(metric)} Values are recorded when the service exports a sample.
                  </p>
                )}
                {Object.keys(metric.attributes).length > 0 && (
                  <dl className="metric-attributes space-y-3">
                    {Object.entries(metric.attributes).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              <div
                className="measurement-footer flex shrink-0 justify-between gap-4 text-small
                  text-secondary"
              >
                <span className="max-compact:first:hidden">
                  {metric.points.length} retained samples
                </span>
                <span className="max-compact:first:hidden">
                  {last ? `Latest ${clock(last.time)}` : 'Waiting for export'}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="memory-empty flex flex-1 flex-col items-center justify-center gap-4 p-6
                text-center text-small text-secondary"
            >
              <Database size={23} />
              <h2>No application metrics yet</h2>
              <p>
                Connect an OpenTelemetry SDK to see request counts, durations, and application
                measurements.
              </p>
              <Button variant="secondary" onClick={onSetup}>
                Connection setup
                <ArrowUpRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
