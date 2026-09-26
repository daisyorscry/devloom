import type { LogEntry } from './types';

export type LogTone = 'output' | 'system' | 'info' | 'success' | 'warn' | 'error' | 'debug';
export type LogToken = {
  text: string;
  tone?: LogTone | 'method' | 'path' | 'duration';
};
const levels: Record<string, LogTone> = {
  info: 'info',
  information: 'info',
  debug: 'debug',
  trace: 'debug',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  err: 'error',
  fatal: 'error',
  panic: 'error',
  success: 'success',
  ok: 'success',
};

// Severity is a display hint only; stdout/stderr remain the source of truth for filtering.
export function logTone(log: Pick<LogEntry, 'stream' | 'message'>): LogTone {
  if (log.stream === 'system') return 'system';
  const message = log.message.trimStart();
  if (message.startsWith('{')) {
    try {
      const data = JSON.parse(message);
      const level = data?.level ?? data?.severity ?? data?.severityText;
      if (typeof level === 'string' && levels[level.toLowerCase()])
        return levels[level.toLowerCase()];
    } catch {
      /* Partial JSON is still valid process output. */
    }
  }
  const prefix = message.replace(/^(?:\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?\s+|\[[\dT:. +Z-]+\]\s*)/, '');
  const level = prefix.match(
    /^\[?(info|information|debug|trace|warn|warning|error|err|fatal|panic|success|ok)\b/i,
  )?.[1];
  return level ? levels[level.toLowerCase()] : log.stream === 'stderr' ? 'error' : 'output';
}

/** React renders each token as text, preserving the original output exactly. */
export function logTokens(message: string): LogToken[] {
  const pattern =
    /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+(?:HTTP\/[\d.]+\s+)?[1-5]\d{2}\b|https?:\/\/[^\s"'<>]+|\b\d+(?:\.\d+)?(?:ns|µs|us|ms|s)\b|\b(?:INFO|INFORMATION|DEBUG|TRACE|WARN|WARNING|ERROR|ERR|FATAL|PANIC|SUCCESS|OK)\b/gi;
  const result: LogToken[] = [];
  let end = 0;
  for (const match of message.matchAll(pattern)) {
    const text = match[0],
      index = match.index!;
    if (index > end) result.push({ text: message.slice(end, index) });
    const http = text.match(
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(\s+)(\S+)(\s+(?:HTTP\/[\d.]+\s+)?)([1-5]\d{2})$/i,
    );
    if (http) {
      result.push(
        { text: http[1], tone: 'method' },
        { text: http[2] },
        { text: http[3], tone: 'path' },
        { text: http[4] },
        {
          text: http[5],
          tone:
            Number(http[5]) >= 500
              ? 'error'
              : Number(http[5]) >= 400
                ? 'warn'
                : Number(http[5]) >= 300
                  ? 'info'
                  : 'success',
        },
      );
    } else {
      result.push({
        text,
        tone: /^https?:/i.test(text) ? 'path' : (levels[text.toLowerCase()] ?? 'duration'),
      });
    }
    end = index + text.length;
  }
  if (end < message.length) result.push({ text: message.slice(end) });
  return result;
}

export function logServiceColor(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}
