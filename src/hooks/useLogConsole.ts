import type { Service } from '../types';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogEntry } from '../types';
export function useLogConsole({
  logs,
  services,
  serviceId,
}: {
  logs: LogEntry[];
  services: Service[];
  serviceId?: string;
}) {
  const [query, setQuery] = useState('');
  const [stream, setStream] = useState('all');
  const [follow, setFollow] = useState(true);
  const [paused, setPaused] = useState<LogEntry[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const names = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services]);
  const filtered = (paused ?? logs).filter(
    (log) =>
      (!serviceId || log.serviceId === serviceId) &&
      (stream === 'all' || log.stream === stream) &&
      `${log.message} ${names.get(log.serviceId)}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (follow && box.current && !paused) box.current.scrollTop = box.current.scrollHeight;
  }, [logs, follow, paused, serviceId, query, stream]);
  useEffect(() => {
    setPaused(null);
  }, [serviceId]);
  function download() {
    const text = filtered
      .map(
        (log) =>
          `${new Date(log.time).toISOString()} [${names.get(log.serviceId) ?? 'service'}] [${log.stream}] ${log.message}`,
      )
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([text], {
        type: 'text/plain',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'devloom-logs.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
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
  };
}
