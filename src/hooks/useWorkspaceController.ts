import { useTabNavigation } from './useTabNavigation';
import type { Snapshot } from '../types';
import { alive } from '../lib/services';
import { useTheme } from '../useTheme';
import { useEffect, useState } from 'react';
import { api, apiUrl } from '../api';
import type { LogEntry, Service } from '../types';
export function useWorkspaceController() {
  const { theme, toggleTheme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [telemetryVersion, setTelemetryVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const { page, requestedPage, setPage, isSwitching } = useTabNavigation();
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState<Service | 'new' | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    error?: boolean;
  }>();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Service>();
  const [help, setHelp] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const events = new EventSource(apiUrl('/events'));
    events.addEventListener('snapshot', (event) => {
      const data: Snapshot = JSON.parse(event.data);
      setServices(data.services);
      setLogs(data.logs);
      setConnected(true);
      setLoaded(true);
    });
    events.addEventListener('state', (event) => setServices(JSON.parse(event.data)));
    events.addEventListener('log', (event) => {
      const entry: LogEntry = JSON.parse(event.data);
      setLogs((current) => {
        const next = [...current, entry];
        const excess =
          next.reduce((count, log) => count + Number(log.serviceId === entry.serviceId), 0) - 1000;
        let count = 0;
        return excess > 0
          ? next.filter((log) => log.serviceId !== entry.serviceId || ++count > excess)
          : next;
      });
    });
    events.addEventListener('telemetry', () => setTelemetryVersion((value) => value + 1));
    events.onerror = () => {
      setConnected(false);
      setLoaded(true);
    };
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      events.close();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (selectedId && !services.some((s) => s.id === selectedId)) setSelectedId(undefined);
  }, [services, selectedId]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(undefined), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('[role="listbox"]') &&
        !dialog &&
        !deleteTarget &&
        !help &&
        page === 'services'
      )
        setSelectedId(undefined);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [dialog, deleteTarget, help, page]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        page === 'services' &&
        selectedId &&
        !dialog &&
        !deleteTarget &&
        !help &&
        !target.closest('.service-drawer, .process-table tbody tr, dialog, [data-devloom-dropdown]')
      )
        setSelectedId(undefined);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [page, selectedId, dialog, deleteTarget, help]);
  const selected = services.find((s) => s.id === selectedId);
  const running = services.filter((s) => s.status === 'running').length;
  const attention = services.filter(
    (s) => s.status === 'failed' || s.health === 'unhealthy',
  ).length;
  const visible = services.filter(
    (s) =>
      (filter === 'all' ||
        (filter === 'attention'
          ? s.status === 'failed' || s.health === 'unhealthy'
          : s.status === filter)) &&
      `${s.name} ${s.command}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function run(key: string, work: () => Promise<unknown>, success?: string) {
    setPending((current) => new Set(current).add(key));
    try {
      await work();
      if (success)
        setNotice({
          message: success,
        });
    } catch (error) {
      setNotice({
        message: (error as Error).message,
        error: true,
      });
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }
  function action(service: Service, type: 'start' | 'stop' | 'restart') {
    void run(service.id, () => api(`/services/${service.id}/${type}`, 'POST'));
  }
  async function all(type: 'start' | 'stop') {
    await run('all', async () => {
      const targets = services.filter((s) => (type === 'start' ? !alive(s) : alive(s)));
      const results = await Promise.allSettled(
        targets.map((s) => api(`/services/${s.id}/${type}`, 'POST')),
      );
      const errors = results.filter((r) => r.status === 'rejected');
      if (errors.length)
        throw new Error(
          `${errors.length} service action(s) failed. Check each service's status and logs.`,
        );
    });
  }
  function loadExamples() {
    return run(
      'examples',
      () => api('/examples', 'POST'),
      'Six example services added. Use Start all to run them.',
    );
  }
  async function confirmRemove() {
    if (!deleteTarget) return;
    await run(
      'delete',
      async () => {
        await api(`/services/${deleteTarget.id}`, 'DELETE');
        setDeleteTarget(undefined);
      },
      'Service removed. Project files were kept.',
    );
  }
  return {
    theme,
    toggleTheme,
    services,
    logs,
    connected,
    telemetryVersion,
    loaded,
    page,
    requestedPage,
    isSwitching,
    setPage,
    selectedId,
    setSelectedId,
    query,
    setQuery,
    filter,
    setFilter,
    dialog,
    setDialog,
    notice,
    setNotice,
    pending,
    deleteTarget,
    setDeleteTarget,
    help,
    setHelp,
    selected,
    running,
    attention,
    visible,
    action,
    all,
    loadExamples,
    confirmRemove,
  };
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;
