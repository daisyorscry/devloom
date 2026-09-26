import { convert } from '../lib/metrics';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { MemorySnapshot, TelemetrySnapshot } from '../types';
export function useMetrics(version: number) {
  const [memory, setMemory] = useState<MemorySnapshot>();
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>();
  const [mode, setMode] = useState<'memory' | 'application'>('memory');
  const [service, setService] = useState('');
  const [range, setRange] = useState(300000);
  const [query, setQuery] = useState('');
  const [metricId, setMetricId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([api<MemorySnapshot>('/runtime/memory'), api<TelemetrySnapshot>('/telemetry')])
      .then(([m, t]) => {
        if (active) {
          setMemory(m);
          setTelemetry(t);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [version]);
  const services = [
    ...new Set([...(memory?.services.map((s) => s.name) ?? []), ...(telemetry?.services ?? [])]),
  ].sort();
  const memoryService = memory?.services.find((s) => s.name === service);
  const memoryPoints = service ? (memoryService?.history ?? []) : (memory?.history ?? []);
  const now = Date.now();
  const visibleMemoryPoints = memoryPoints
    .filter((p) => p.time >= now - range)
    .map((p) => ({
      time: p.time,
      value: p.bytes / 1024 ** 2,
    }));
  const memoryCurrent = service ? memoryService?.memoryBytes : memory?.managedBytes;
  const peak = service ? memoryService?.peakBytes : memory?.peakBytes;
  const memoryRows = (memory?.services ?? [])
    .filter((s) => !service || s.name === service)
    .sort((a, b) => (b.memoryBytes ?? 0) - (a.memoryBytes ?? 0));
  const metricOptions =
    telemetry?.metrics.filter(
      (m) =>
        (!service || m.service === service) &&
        `${m.name} ${m.description}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  const metric = metricOptions.find((m) => m.id === metricId) ?? metricOptions[0];
  const last = metric?.points.at(-1);
  const chartData =
    metric?.points
      .filter((p) => p.time >= now - range)
      .map((p) => ({
        time: p.time,
        value: convert(p.value, metric.unit),
      })) ?? [];
  const mean = !!metric && ['histogram', 'exponentialHistogram', 'summary'].includes(metric.kind);
  const label = metric?.name.split('.').join(' ');
  return {
    loading: !memory && !error,
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
  };
}
