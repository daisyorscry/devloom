import { TabButton } from './TabButton';
import { Button } from './Button';
import { Loom } from './ServiceIdentity';
import { CircleHelp, Moon, Sun } from 'lucide-react';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
export function WorkspaceHeader({
  workspaceControl,
  pending,
  page,
  setPage,
  services,
  setSelectedId,
  connected,
  theme,
  toggleTheme,
  setHelp,
}: Pick<
  WorkspaceController,
  | 'pending'
  | 'page'
  | 'setPage'
  | 'services'
  | 'setSelectedId'
  | 'connected'
  | 'theme'
  | 'toggleTheme'
  | 'setHelp'
> & {
  workspaceControl?: (disabled: boolean) => React.ReactNode;
}) {
  return (
    <header
      className="app-header flex shrink-0 items-center gap-6 border-b border-line px-8 py-4
        max-desktop:grid max-desktop:grid-cols-[auto_1fr_auto] max-desktop:gap-3
        max-compact:grid-cols-[1fr_auto] max-compact:px-4"
    >
      <a className="brand flex items-center gap-2" href="/" aria-label="Devloom home">
        <Loom />
        <strong className="text-heading font-bold tracking-tight">devloom</strong>
      </a>
      <span className="header-divider h-6 w-px bg-line max-desktop:hidden" />
      {workspaceControl ? (
        workspaceControl(pending.size > 0)
      ) : (
        <span className="workspace-name text-small text-secondary max-desktop:hidden">
          Local workspace
        </span>
      )}
      <nav
        aria-label="Workspace"
        className="flex items-center gap-1 max-desktop:col-span-3 max-desktop:row-start-2
          max-compact:col-span-2 max-compact:row-start-3"
      >
        <TabButton active={page === 'services'} onClick={() => setPage('services')}>
          Services <span>{services.length}</span>
        </TabButton>
        <TabButton
          active={page === 'logs'}
          onClick={() => {
            setPage('logs');
            setSelectedId(undefined);
          }}
        >
          Logs
        </TabButton>
        <TabButton active={page === 'traces'} onClick={() => setPage('traces')}>
          Traces
        </TabButton>
        <TabButton active={page === 'metrics'} onClick={() => setPage('metrics')}>
          Metrics
        </TabButton>
      </nav>
      <div
        className="header-end ml-auto flex items-center gap-4 max-desktop:col-start-3
          max-desktop:row-start-1 max-compact:col-start-2"
      >
        <span
          className={`connection-state flex items-center gap-2 text-small text-secondary
            max-desktop:hidden ${connected ? 'connected' : ''}`}
        >
          <span className="dot inline-block size-1.5 shrink-0 rounded-full bg-current" />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <Button
          className="theme-toggle"
          variant="icon"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        <Button
          variant="icon"
          aria-label="Workspace guide"
          title="Workspace guide"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={17} />
        </Button>
      </div>
    </header>
  );
}
