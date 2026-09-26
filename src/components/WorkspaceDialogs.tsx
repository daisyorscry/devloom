import { Button } from './Button';
import type { Service } from '../types';
import { Modal } from './Modal';
import { ShieldCheck } from 'lucide-react';
export function ConfirmRemove({
  service,
  pending,
  onClose,
  onConfirm,
}: {
  service: Service;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onClose} title={`Remove ${service.name}?`}>
      <p>
        This removes the service configuration from Devloom. Your project files stay where they are.
      </p>
      <div className="modal-actions mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button className="destructive bg-danger text-white" disabled={pending} onClick={onConfirm}>
          {pending ? 'Removing…' : 'Remove service'}
        </Button>
      </div>
    </Modal>
  );
}
export function Guide({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="Using Devloom" size="wide">
      <p className="px-7 pb-6 text-secondary">
        Devloom manages commands on your machine. Use the same tools and projects you already work
        with.
      </p>
      <div className="guide-body grid grid-cols-[1.4fr_1fr] gap-8 px-7 pb-7 max-compact:grid-cols-1">
        <ol className="guide-steps space-y-5">
          <li className="pl-1 text-small leading-relaxed">
            <strong className="mb-1 block text-body">Add a service</strong>
            <span>
              Give it a name, project directory, command, and arguments. For{' '}
              <code>go run ./cmd/api</code>, the command is <code>go</code> and arguments are{' '}
              <code>run ./cmd/api</code>.
            </span>
          </li>
          <li className="pl-1 text-small leading-relaxed">
            <strong className="mb-1 block text-body">Bring it to life</strong>
            <span>
              Start, stop, or restart a service. Select it to inspect its PID, uptime, configured
              port, and health.
            </span>
          </li>
          <li className="pl-1 text-small leading-relaxed">
            <strong className="mb-1 block text-body">Follow the thread</strong>
            <span>
              Watch stdout and stderr live. Filter, pause, or download output from one service or
              the entire workspace.
            </span>
          </li>
        </ol>
        <aside
          className="guide-sidebar space-y-6 border-l border-line pl-7 max-compact:border-l-0
            max-compact:pl-0"
        >
          <section>
            <h3 className="mb-2">
              <ShieldCheck size={18} /> Local by design
            </h3>
            <p className="guide-note mt-6 text-secondary">
              Configurations persist locally. Logs stay in memory. Closing the browser keeps
              processes running; exiting the Devloom server stops them.
            </p>
          </section>
          <section>
            <h3 className="mb-2">Traces & metrics</h3>
            <p className="text-secondary">
              Open Traces or Metrics, then Setup to connect your services to the local OpenTelemetry
              receiver.
            </p>
            <p className="guide-memory-note mt-4 text-small text-secondary">
              RAM usage is collected directly from your processes. No SDK required.
            </p>
          </section>
        </aside>
      </div>
      <footer
        className="guide-footer flex items-center justify-between gap-4 border-t border-line px-7
          py-5 text-small text-secondary"
      >
        <span>Weave your services into one workspace.</span>
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      </footer>
    </Modal>
  );
}
