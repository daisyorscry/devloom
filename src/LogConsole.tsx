import { LogRow } from './components/LogRow';
import { Button } from './components/Button';
import type { LogEntry, Service } from './types';
import { useLogConsole } from './hooks/useLogConsole';
import { Dropdown } from './components/Dropdown';
import { SearchInput } from './components/SearchInput';
import { ArrowDownToLine, Download, Pause, Play, Terminal } from 'lucide-react';
export default function LogConsole({
  logs,
  services,
  serviceId,
  connected,
  expanded = false,
}: {
  logs: LogEntry[];
  services: Service[];
  serviceId?: string;
  connected: boolean;
  expanded?: boolean;
}) {
  const {
    query,
    setQuery,
    stream,
    setStream,
    follow,
    setFollow,
    paused,
    setPaused,
    box,
    names,
    filtered,
    download,
  } = useLogConsole({
    logs,
    services,
    serviceId,
  });
  return (
    <section
      className={`console flex h-full min-h-0 flex-col text-small ${expanded ? 'expanded' : ''}`}
      aria-label="Service logs"
    >
      <div className="console-heading flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        <div className="flex items-center gap-2">
          <Terminal size={17} />
          <h3>{serviceId ? 'Output' : 'Output'}</h3>
          <span
            className={`live-label inline-flex items-center gap-2 text-small text-log-success
              ${connected && !paused ? 'online' : ''}`}
          >
            <span className="dot inline-block size-1.5 shrink-0 rounded-full bg-current" />
            {paused ? 'PAUSED' : connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <span className="log-count">{filtered.length} lines</span>
      </div>
      <div
        className={`console-toolbar flex shrink-0 items-center gap-2 px-4 py-3 max-compact:flex-wrap
          ${expanded ? '' : 'max-compact:hidden'}`}
      >
        <SearchInput
          label="Search logs"
          placeholder="Search output…"
          value={query}
          onValueChange={setQuery}
          tone="console"
          className="log-search min-w-0 flex-1 max-compact:basis-full"
        />
        <div className="console-tools flex shrink-0 items-center gap-1">
          <Dropdown
            label="Filter log stream"
            value={stream}
            onValueChange={setStream}
            tone="console"
            options={[
              {
                value: 'all',
                label: 'All streams',
              },
              {
                value: 'stdout',
                label: 'stdout',
              },
              {
                value: 'stderr',
                label: 'stderr',
              },
              {
                value: 'system',
                label: 'system',
              },
            ]}
          />
          <Button
            variant="icon"
            tone="console"
            className={`icon-button ${follow ? 'active-tool text-console-text!' : ''}`}
            aria-label="Follow latest logs"
            title="Follow latest logs"
            aria-pressed={follow}
            onClick={() => setFollow(!follow)}
          >
            <ArrowDownToLine size={16} />
          </Button>
          <Button
            variant="icon"
            aria-label={paused ? 'Resume logs' : 'Pause logs'}
            title={paused ? 'Resume logs' : 'Pause logs'}
            onClick={() => setPaused(paused ? null : [...logs])}
            tone="console"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </Button>
          <Button
            variant="icon"
            aria-label="Download filtered logs"
            title="Download filtered logs"
            onClick={download}
            tone="console"
          >
            <Download size={16} />
          </Button>
        </div>
      </div>
      <div
        className="console-body min-h-0 flex-1 overflow-auto px-4 py-2"
        ref={box}
        tabIndex={0}
        aria-label="Log output"
      >
        {filtered.length ? (
          filtered.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              serviceName={names.get(log.serviceId) ?? 'removed'}
              showService={!serviceId}
            />
          ))
        ) : (
          <div
            className="console-empty flex h-full flex-col items-center justify-center gap-3
              text-console-muted"
          >
            <Terminal size={24} />
            <span>
              {query || stream !== 'all' ? 'No output matches your filters.' : 'No output yet.'}
            </span>
            <small>
              {query || stream !== 'all'
                ? 'Try another search or stream.'
                : 'Start a service to see its live output here.'}
            </small>
          </div>
        )}
      </div>
      <div
        className="console-footer flex shrink-0 items-center justify-between gap-4 px-4 py-2
          text-console-muted max-compact:hidden"
      >
        <span className="flex items-center gap-2">
          <span className="terminal-cursor flex h-4 w-1.5 items-center gap-2 bg-console-muted" />{' '}
          stdout + stderr
        </span>
        <span className="flex items-center gap-2">Last 1,000 lines / service</span>
      </div>
    </section>
  );
}
