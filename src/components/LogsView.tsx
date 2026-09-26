import { Dropdown } from './Dropdown';
import LogConsole from '../LogConsole';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
export function LogsView({
  selectedId,
  setSelectedId,
  services,
  selected,
  logs,
  connected,
}: Pick<
  WorkspaceController,
  'selectedId' | 'setSelectedId' | 'services' | 'selected' | 'logs' | 'connected'
>) {
  return (
    <section
      className="full-logs flex min-h-0 flex-1 flex-col gap-4 px-8 pb-5 max-compact:px-4"
      aria-label="Full log viewer"
    >
      <div className="logs-filter-bar flex shrink-0 items-center justify-between gap-4">
        <label className="flex min-w-0 items-center gap-3 text-small text-secondary">
          Service
          <Dropdown
            label="Filter logs by service"
            value={selectedId ?? ''}
            onValueChange={(value) => setSelectedId(value || undefined)}
            options={[
              {
                value: '',
                label: 'All services',
              },
              ...services.map((service) => ({
                value: service.id,
                label: service.name,
              })),
            ]}
            className="w-60 max-compact:flex-1"
          />
        </label>
        <span className="text-small text-secondary max-compact:hidden">
          {selected ? selected.name : `${services.length} services`} · stdout + stderr
        </span>
      </div>
      <div
        className="output-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl
          bg-console text-console-text"
      >
        <LogConsole
          logs={logs}
          services={services}
          serviceId={selectedId}
          connected={connected}
          expanded
        />
      </div>
    </section>
  );
}
