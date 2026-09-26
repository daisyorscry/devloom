import { TabLoading } from './components/TabLoading';
import { TracesView } from './components/TracesView';
import { TelemetrySetup } from './components/TelemetrySetup';
import { useEffect, useState, lazy, Suspense } from 'react';
import { api } from './api';
import type { TelemetrySnapshot } from './types';
const MetricsView = lazy(() => import('./MetricsView'));

export default function TelemetryPanel({
  mode,
  version,
}: {
  mode: 'traces' | 'metrics';
  version: number;
}) {
  const [setup, setSetup] = useState(false);
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>();
  useEffect(() => {
    if (setup) void api<TelemetrySnapshot>('/telemetry').then(setSnapshot);
  }, [setup]);
  return (
    <>
      {mode === 'metrics' ? (
        <Suspense fallback={<TabLoading label="metrics" />}>
          <MetricsView version={version} onSetup={() => setSetup(true)} />
        </Suspense>
      ) : (
        <TracesView version={version} />
      )}{' '}
      {setup && <TelemetrySetup snapshot={snapshot} onClose={() => setSetup(false)} />}
    </>
  );
}
