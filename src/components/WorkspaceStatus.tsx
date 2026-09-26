import type { WorkspaceController } from '../hooks/useWorkspaceController';
export function WorkspaceStatus({
  connected,
  services,
  running,
}: Pick<WorkspaceController, 'connected' | 'services' | 'running'>) {
  return (
    <footer
      className="statusbar flex shrink-0 items-center justify-between gap-4 border-t border-line
        px-8 py-2 text-small text-secondary max-compact:px-4"
    >
      <span className="flex items-center gap-2">
        <span
          className={
            `dot inline-block size-1.5 shrink-0 rounded-full bg-current
            ${connected ? 'online-dot text-healthy' : ''}` + ' flex items-center gap-2'
          }
        />
        {connected ? 'Local process manager' : 'Reconnecting…'}
      </span>
      <span className="statusbar-middle flex items-center gap-2 max-compact:hidden">
        {services.length} services · {running} running
      </span>
      <span className="flex items-center gap-2">Devloom 0.1.0</span>
    </footer>
  );
}
