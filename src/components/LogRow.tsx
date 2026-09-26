import type { LogEntry } from '../types';
import { logServiceColor, logTone } from '../logPresentation';
import { LogMessage } from './LogMessage';
const serviceColors = [
  'text-log-path',
  'text-log-debug',
  'text-log-success',
  'text-log-warn',
  'text-log-info',
  'text-pink-300',
];
export function LogRow({
  log,
  serviceName,
  showService,
}: {
  log: LogEntry;
  serviceName: string;
  showService: boolean;
}) {
  const tone = logTone(log);
  const streamColor =
    log.stream === 'stderr'
      ? 'bg-log-error/10 text-log-error'
      : log.stream === 'system'
        ? 'bg-console-muted/10 text-console-muted'
        : 'bg-log-path/10 text-log-path';
  return (
    <div
      className={`log-line flex items-start gap-3 py-1 leading-relaxed ${log.stream} tone-${tone}`}
    >
      <time className="shrink-0 text-console-muted">
        {new Date(log.time).toLocaleTimeString('en-GB', {
          hour12: false,
        })}
      </time>
      {showService && (
        <span
          className={`log-service w-28 shrink-0 truncate max-compact:w-20
          ${serviceColors[logServiceColor(log.serviceId)]}`}
          title={serviceName}
        >
          {serviceName}
        </span>
      )}
      <span
        className={`log-stream w-11 shrink-0 rounded px-1 text-center ${streamColor}`}
        title={`${log.stream} · ${tone}`}
        aria-label={`${log.stream} stream`}
      >
        {log.stream === 'system' ? 'SYS' : log.stream === 'stderr' ? 'ERR' : 'OUT'}
      </span>
      <LogMessage message={log.message} tone={tone} />
    </div>
  );
}
