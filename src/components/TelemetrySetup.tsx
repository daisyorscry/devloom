import { Button } from './Button';
import { useEffect, useState } from 'react';
import { Activity, Check, Copy, X } from 'lucide-react';
import type { TelemetrySnapshot } from '../types';
export function TelemetrySetup({
  snapshot,
  onClose,
}: {
  snapshot?: TelemetrySnapshot;
  onClose: () => void;
}) {
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    node?.showModal();
  }, [node]);
  const config = `OTEL_EXPORTER_OTLP_ENDPOINT=${snapshot?.endpoint ?? 'http://127.0.0.1:4318'}\nOTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf\nOTEL_SERVICE_NAME=your-service`;
  return (
    <dialog
      ref={setNode}
      className="service-dialog telemetry-setup max-h-[90dvh] w-200 max-w-[calc(100vw-32px)]
        space-y-4 overflow-auto rounded-2xl bg-panel p-7 text-ink shadow-dialog
        backdrop:bg-black/50"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top mb-6 flex items-center gap-3">
        <Activity size={21} />
        <Button variant="icon" aria-label="Close telemetry setup" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <h2 className="text-heading">Connect OpenTelemetry</h2>
      <p>
        Initialize the OpenTelemetry SDK in your service, then export to this local OTLP/HTTP
        receiver.
      </p>
      <div
        className="setup-code flex items-start justify-between gap-4 overflow-auto rounded-lg
          bg-control p-4 text-small leading-relaxed"
      >
        <pre>{config}</pre>
        <Button
          variant="icon"
          aria-label="Copy telemetry configuration"
          onClick={async () => {
            await navigator.clipboard.writeText(config);
            setCopied(true);
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
      <p>
        Services started by Devloom receive these endpoint and protocol defaults, with their
        registered name. Your application still needs SDK instrumentation.
      </p>
      <ul>
        <li>
          Traces: append <code>/v1/traces</code> to the base URL above.
        </li>
        <li>
          Metrics: append <code>/v1/metrics</code> to the base URL above.
        </li>
        <li>Protobuf and JSON payloads; gzip supported.</li>
      </ul>
      <p className="muted text-muted">
        HTTP only; gRPC and OTLP log ingestion are not enabled. Process stdout/stderr remains
        available in Logs.
      </p>
      <p className="muted text-muted">
        Set the endpoint above in your terminal, then run <code>npm run demo:telemetry</code>
        from the Devloom repository to send the included example to this project.
      </p>
    </dialog>
  );
}
