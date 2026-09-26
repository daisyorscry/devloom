import { TabButton } from './TabButton';
import { TableHead, TableRow, TableCell } from './Table';
import { kindIcon } from './ServiceKind';
import { ServiceControls } from './ServiceControls';
import { Button } from './Button';
import { StatusBadge } from './ServiceIdentity';
import { uptime } from '../lib/services';
import { SearchInput } from './SearchInput';
import { formatMemory } from '../format';
import { ArrowUpRight, Box, Loader2, Plus } from 'lucide-react';
import { formatArgs } from '../lib/commands';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
export function ServicesTable({
  inspectorOpen,
  query,
  setQuery,
  filter,
  setFilter,
  visible,
  selectedId,
  setSelectedId,
  connected,
  pending,
  action,
  loaded,
  services,
  setDialog,
  loadExamples,
}: Pick<
  WorkspaceController,
  | 'query'
  | 'setQuery'
  | 'filter'
  | 'setFilter'
  | 'visible'
  | 'selectedId'
  | 'setSelectedId'
  | 'connected'
  | 'pending'
  | 'action'
  | 'loaded'
  | 'services'
  | 'setDialog'
  | 'loadExamples'
> & {
  inspectorOpen: boolean;
}) {
  return (
    <section
      className={`processes mx-8 mb-4 flex min-h-0 flex-1 flex-col max-compact:mx-4
        ${inspectorOpen ? 'mb-inspector-offset! max-compact:mb-[calc(61dvh+10px)]!' : ''}`}
      aria-label="Registered services"
    >
      <div
        className="table-toolbar flex shrink-0 items-center justify-between gap-4 py-2
          max-compact:flex-wrap max-compact:gap-2"
      >
        <SearchInput
          className="service-search w-75 max-compact:w-full"
          label="Search services"
          placeholder="Search services…"
          value={query}
          onValueChange={setQuery}
        />
        <div
          className={`filter-tabs flex items-center gap-1
            ${inspectorOpen ? 'max-compact:hidden' : ''}`}
          aria-label="Filter services"
        >
          {[
            ['all', 'All'],
            ['running', 'Running'],
            ['attention', 'Needs attention'],
          ].map(([key, label]) => (
            <TabButton active={filter === key} key={key} onClick={() => setFilter(key)}>
              {label}
            </TabButton>
          ))}
        </div>
      </div>
      <div className="process-table-scroll min-h-0 flex-1 overflow-auto">
        <table
          className="process-table w-full table-fixed border-separate border-spacing-y-0.5
            text-left"
        >
          <thead>
            <tr>
              <TableHead className="name-column w-1/5 max-desktop:w-auto max-compact:w-[38%]">
                Service
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="command-column w-[16%] max-[850px]:hidden">Command</TableHead>
              <TableHead className="pid-column w-[8%] max-desktop:hidden">PID</TableHead>
              <TableHead>Port</TableHead>
              <TableHead className="uptime-column w-[10%] max-compact:hidden">Uptime</TableHead>
              <TableHead className="health-column w-[11%] max-compact:hidden">Health</TableHead>
              <TableHead className="memory-column w-[9%] max-desktop:w-[12%] max-compact:hidden">
                RAM
              </TableHead>
              <TableHead className="actions-column w-21 max-compact:w-17">
                <span className="sr-only">Actions</span>
              </TableHead>
            </tr>
          </thead>
          <tbody>
            {visible.map((service) => {
              const Icon = kindIcon[service.kind] ?? Box;
              return (
                <TableRow
                  key={service.id}
                  className={selectedId === service.id ? 'is-selected bg-selected!' : ''}
                  onClick={() => setSelectedId(service.id)}
                >
                  <TableCell>
                    <button
                      className="service-select flex w-full min-w-0 items-center gap-3
                        bg-transparent py-3 text-left text-body font-medium text-ink
                        max-compact:text-small"
                      onClick={() => setSelectedId(service.id)}
                      aria-pressed={selectedId === service.id}
                    >
                      <Icon size={16} />
                      <span className="truncate">{service.name}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <StatusBadge service={service} />
                  </TableCell>
                  <TableCell className="command-column w-[16%] max-[850px]:hidden">
                    <code
                      className="block truncate"
                      title={`${service.command} ${formatArgs(service.args)}`}
                    >
                      {service.command.split('/').pop()} {formatArgs(service.args)}
                    </code>
                  </TableCell>
                  <TableCell className="pid-column mono w-[8%] tabular-nums max-desktop:hidden">
                    {service.pid ?? '—'}
                  </TableCell>
                  <TableCell className="mono tabular-nums">
                    {service.port ? `:${service.port}` : '—'}
                  </TableCell>
                  <TableCell className="uptime-column mono w-[10%] tabular-nums max-compact:hidden">
                    {uptime(service.startedAt)}
                  </TableCell>
                  <TableCell
                    className={`health-column w-[11%] max-compact:hidden
                    ${service.health === 'healthy' ? 'text-healthy!' : service.health === 'unhealthy' ? 'text-danger!' : ''}`}
                  >
                    {service.health === 'healthy'
                      ? 'Healthy'
                      : service.health === 'unhealthy'
                        ? 'Unhealthy'
                        : service.healthUrl
                          ? service.status === 'running'
                            ? 'Checking…'
                            : '—'
                          : '—'}
                  </TableCell>
                  <TableCell className="memory-column w-[9%] max-desktop:w-[12%] max-compact:hidden">
                    {formatMemory(service.memoryBytes)}
                  </TableCell>
                  <TableCell className="actions-column w-21 max-compact:w-17">
                    <ServiceControls
                      service={service}
                      full={false}
                      connected={connected}
                      pending={pending}
                      action={action}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loaded ? (
        <div className="empty-state flex min-h-0 flex-1 items-center justify-center gap-4 p-8">
          <Loader2 className="spin animate-spin" size={20} />
          <p className="text-secondary">Connecting to your workspace…</p>
        </div>
      ) : !services.length ? (
        <div className="empty-state flex min-h-0 flex-1 items-center justify-center gap-4 p-8">
          <div>
            <h2 className="mb-2 text-body">No services registered</h2>
            <p className="text-secondary">
              Add a project directory and its run command to get started.
            </p>
            <div className="empty-actions mt-4 flex flex-wrap items-center gap-4">
              <Button variant="secondary" disabled={!connected} onClick={() => setDialog('new')}>
                <Plus size={15} />
                Add service
              </Button>
              <Button
                variant="text"
                disabled={!connected || pending.has('examples')}
                onClick={() => void loadExamples()}
              >
                {pending.has('examples') ? 'Loading…' : 'Load example workspace'}
                <ArrowUpRight size={14} />
              </Button>
            </div>
            <small>Examples use local Node processes. Nothing starts automatically.</small>
          </div>
        </div>
      ) : !visible.length ? (
        <div className="empty-state flex min-h-0 flex-1 items-center justify-center gap-4 p-8">
          <p className="text-secondary">No matching services.</p>
          <Button
            variant="text"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
      <div
        className={`table-footer mt-auto flex shrink-0 justify-between gap-4 pt-3 text-small
          text-secondary ${inspectorOpen ? 'max-compact:hidden' : ''}`}
      >
        <span className="last:max-compact:hidden">
          {visible.length} of {services.length} services
        </span>
        <span className="last:max-compact:hidden">
          Select a service to inspect its configuration and output
        </span>
      </div>
    </section>
  );
}
