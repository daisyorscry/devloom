import { ServiceControls } from './ServiceControls';
import { Button } from './Button';
import type { Service } from '../types';
import { StatusBadge } from './ServiceIdentity';
import { alive, uptime } from '../lib/services';
import { formatMemory } from '../format';
import { ExternalLink, Maximize2, Settings2, Trash2, X } from 'lucide-react';
import { formatArgs } from '../lib/commands';
import LogConsole from '../LogConsole';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
export function ServiceInspector({
  selected,
  setPage,
  setSelectedId,
  connected,
  pending,
  action,
  setDialog,
  setDeleteTarget,
  logs,
  services,
  selectedId,
}: Pick<
  WorkspaceController,
  | 'setPage'
  | 'setSelectedId'
  | 'connected'
  | 'pending'
  | 'action'
  | 'setDialog'
  | 'setDeleteTarget'
  | 'logs'
  | 'services'
  | 'selectedId'
> & {
  selected: Service;
}) {
  return (
    <section
      className="service-drawer absolute inset-x-0 bottom-0 z-5 flex h-inspector
        max-h-[calc(100%_-_125px)] min-h-0 animate-drawer flex-col overflow-hidden rounded-t-2xl
        border border-line bg-panel shadow-drawer max-compact:h-[61dvh]"
      aria-label={`${selected.name} inspector`}
    >
      <div
        className="drawer-header flex shrink-0 items-center justify-between gap-4 border-b
          border-line px-6 py-3 max-compact:px-4"
      >
        <div className="flex min-w-0 items-center gap-4">
          <h2>{selected.name}</h2>
          <StatusBadge service={selected} />
        </div>
        <div className="drawer-actions flex min-w-0 shrink-0 items-center gap-4">
          <Button variant="text" onClick={() => setPage('logs')}>
            <Maximize2 size={14} />
            View full
          </Button>
          <Button
            variant="icon"
            aria-label="Close service details"
            title="Close (Esc)"
            onClick={() => setSelectedId(undefined)}
          >
            <X size={17} />
          </Button>
        </div>
      </div>
      <div
        className="drawer-body grid min-h-0 flex-1 grid-cols-[minmax(320px,31%)_1fr] gap-6 px-6 py-4
          max-desktop:gap-4 max-compact:flex max-compact:flex-col max-compact:gap-3 max-compact:px-4
          max-compact:py-3"
      >
        <aside className="inspector min-w-0 text-small" aria-label={`${selected.name} details`}>
          <div
            className="inspector-content flex h-full flex-col gap-3 max-compact:grid
              max-compact:grid-cols-2 max-compact:gap-x-4 max-compact:gap-y-2"
          >
            <div
              className="inspector-status flex items-center justify-between gap-3
                max-compact:hidden"
            >
              <StatusBadge service={selected} />
              <span className="service-kind text-secondary">{selected.kind}</span>
            </div>
            <dl
              className="runtime-values grid grid-cols-3 gap-3 max-compact:col-span-2
                max-compact:grid-cols-5 max-compact:gap-2"
            >
              <div>
                <dt className="mb-1 text-secondary">PID</dt>
                <dd className="m-0 font-medium">{selected.pid ?? '—'}</dd>
              </div>
              <div>
                <dt className="mb-1 text-secondary">RAM</dt>
                <dd className="m-0 font-medium">{formatMemory(selected.memoryBytes)}</dd>
              </div>
              <div>
                <dt className="mb-1 text-secondary">Uptime</dt>
                <dd className="m-0 font-medium">{uptime(selected.startedAt)}</dd>
              </div>
              <div>
                <dt className="mb-1 text-secondary">Port</dt>
                <dd className="m-0 font-medium">
                  {selected.port ? (
                    <a href={`http://127.0.0.1:${selected.port}`} target="_blank" rel="noreferrer">
                      :{selected.port}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-secondary">Health</dt>
                <dd
                  className={`health-status font-medium
                    ${selected.health === 'healthy' ? 'text-healthy' : selected.health === 'unhealthy' ? 'text-danger' : ''}`}
                >
                  {selected.health === 'none'
                    ? 'Not configured'
                    : !alive(selected)
                      ? 'Not checked'
                      : selected.health}
                </dd>
              </div>
            </dl>
            <div className="config-field min-w-0">
              <span className="block text-secondary">Directory</span>
              <code className="block truncate">{selected.directory}</code>
            </div>
            <div className="config-field min-w-0">
              <span className="block text-secondary">Command</span>
              <code className="block truncate">
                {selected.command} {formatArgs(selected.args)}
              </code>
            </div>
            {selected.healthUrl && (
              <div className="config-field min-w-0">
                <span className="block text-secondary">Health endpoint</span>
                <code className="block truncate">{selected.healthUrl}</code>
              </div>
            )}
            {selected.error && (
              <p className="detail-error truncate text-danger">{selected.error}</p>
            )}
            {selected.exitCode !== undefined && (
              <p className="exit-code text-secondary">Last exit: {selected.exitCode ?? 'signal'}</p>
            )}
            <ServiceControls
              service={selected}
              full={true}
              connected={connected}
              pending={pending}
              action={action}
            />
            <div className="inspector-edit flex items-center justify-between gap-3">
              <Button
                variant="text"
                disabled={alive(selected) || !connected || pending.has(selected.id)}
                title={
                  alive(selected)
                    ? 'Stop the service to edit its configuration'
                    : 'Edit configuration'
                }
                onClick={() => setDialog(selected)}
              >
                <Settings2 size={14} />
                Edit configuration
              </Button>
              <Button
                className="danger text-danger"
                variant="icon"
                aria-label={`Remove ${selected.name}`}
                disabled={alive(selected) || !connected || pending.has(selected.id)}
                title={alive(selected) ? 'Stop the service to remove it' : 'Remove service'}
                onClick={() => setDeleteTarget(selected)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </aside>
        <div
          className="output-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl
            bg-console text-console-text"
        >
          <LogConsole
            logs={logs}
            services={services}
            serviceId={selectedId}
            connected={connected}
          />
        </div>
      </div>
    </section>
  );
}
