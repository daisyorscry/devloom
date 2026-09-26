import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TelemetrySnapshot, TelemetrySpan } from '../types';
export function useTraces(version: number) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>();
  const [service, setService] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [traceId, setTraceId] = useState('');
  const [spans, setSpans] = useState<TelemetrySpan[]>([]);
  const [spanId, setSpanId] = useState('');
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    let active = true;
    api<TelemetrySnapshot>('/telemetry')
      .then((data) => {
        if (active) {
          setSnapshot(data);
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
  useEffect(() => {
    if (!traceId) {
      setSpans([]);
      return;
    }
    let active = true;
    api<TelemetrySpan[]>(`/telemetry/traces/${traceId}`)
      .then((data) => {
        if (active) setSpans(data);
      })
      .catch((err) => {
        if (active) {
          setSpans([]);
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [traceId, version]);
  const traces =
    snapshot?.traces.filter(
      (t) =>
        (!service || t.services.includes(service)) &&
        `${t.name} ${t.id} ${t.services.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  const trace = snapshot?.traces.find((t) => t.id === traceId);
  const span = spans.find((s) => s.spanId === spanId);
  function filterService(value: string) {
    setService(value);
    setTraceId('');
  }
  return {
    loading: !snapshot && !error,
    snapshot,
    service,
    query,
    setQuery,
    error,
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
  };
}
