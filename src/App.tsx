import { Suspense } from 'react';
import { TabLoading } from './components/TabLoading';
import { WorkspaceStatus } from './components/WorkspaceStatus';
import { LogsView } from './components/LogsView';
import { ServiceInspector } from './components/ServiceInspector';
import { ServicesTable } from './components/ServicesTable';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { Button } from './components/Button';
import { Guide, ConfirmRemove } from './components/WorkspaceDialogs';
import { useWorkspaceController } from './hooks/useWorkspaceController';
import TelemetryPanel from './TelemetryPanel';
import { Activity, Check, X } from 'lucide-react';
import ServiceDialog from './ServiceDialog';
export default function App({
  workspaceControl,
}: {
  workspaceControl?: (disabled: boolean) => React.ReactNode;
}) {
  const {
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
  } = useWorkspaceController();
  return (
    <div className="workbench flex h-dvh min-h-0 flex-col overflow-hidden bg-surface">
      <WorkspaceHeader
        workspaceControl={workspaceControl}
        pending={pending}
        page={requestedPage}
        setPage={setPage}
        services={services}
        setSelectedId={setSelectedId}
        connected={connected}
        theme={theme}
        toggleTheme={toggleTheme}
        setHelp={setHelp}
      />
      {!connected && loaded && (
        <div
          className="connection-banner shrink-0 bg-warning-surface px-4 py-2 text-small
            text-warning"
          role="status"
        >
          Connection lost. Reconnecting to the local process manager…
        </div>
      )}
      <main
        aria-busy={isSwitching}
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden
          ${page === 'services' ? 'services-view' : 'logs-view'}`}
      >
        <WorkspaceToolbar
          inspectorOpen={page === 'services' && !!selected}
          page={page}
          running={running}
          attention={attention}
          connected={connected}
          pending={pending}
          services={services}
          all={all}
          setDialog={setDialog}
        />
        <Suspense key={page} fallback={<TabLoading label={page} />}>
          {page === 'services' && (
            <ServicesTable
              inspectorOpen={!!selected}
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              visible={visible}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              connected={connected}
              pending={pending}
              action={action}
              loaded={loaded}
              services={services}
              setDialog={setDialog}
              loadExamples={loadExamples}
            />
          )}
          {page === 'services' && selected && (
            <ServiceInspector
              selected={selected}
              setPage={setPage}
              setSelectedId={setSelectedId}
              connected={connected}
              pending={pending}
              action={action}
              setDialog={setDialog}
              setDeleteTarget={setDeleteTarget}
              logs={logs}
              services={services}
              selectedId={selectedId}
            />
          )}
          {page === 'logs' && (
            <LogsView
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              services={services}
              selected={selected}
              logs={logs}
              connected={connected}
            />
          )}
          {(page === 'traces' || page === 'metrics') && (
            <TelemetryPanel mode={page} version={telemetryVersion} />
          )}
        </Suspense>
        {isSwitching && <TabLoading label={requestedPage} overlay />}
      </main>
      <WorkspaceStatus connected={connected} services={services} running={running} />
      {dialog && (
        <ServiceDialog
          service={dialog === 'new' ? undefined : dialog}
          onClose={() => setDialog(null)}
          onSaved={(service) => {
            setSelectedId(service.id);
            setNotice({
              message: `${service.name} ${dialog === 'new' ? 'added' : 'updated'}.`,
            });
          }}
        />
      )}
      {notice && (
        <div
          className={`toast fixed bottom-12 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2
          items-center gap-3 rounded-xl bg-ink px-4 py-3 text-small text-surface shadow-lg
          ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <Activity size={17} /> : <Check size={17} />}
          <span>{notice.message}</span>
          <Button
            variant="icon"
            aria-label="Dismiss notification"
            onClick={() => setNotice(undefined)}
          >
            <X size={15} />
          </Button>
        </div>
      )}
      {deleteTarget && (
        <ConfirmRemove
          service={deleteTarget}
          pending={pending.has('delete')}
          onClose={() => setDeleteTarget(undefined)}
          onConfirm={() => void confirmRemove()}
        />
      )}
      {help && <Guide onClose={() => setHelp(false)} />}
    </div>
  );
}
