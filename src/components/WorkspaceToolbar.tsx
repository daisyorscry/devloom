import { Button } from './Button';
import { alive } from '../lib/services';
import { Play, Plus, Square } from 'lucide-react';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
export function WorkspaceToolbar({
  inspectorOpen,
  page,
  running,
  attention,
  connected,
  pending,
  services,
  all,
  setDialog,
}: Pick<
  WorkspaceController,
  'page' | 'running' | 'attention' | 'connected' | 'pending' | 'services' | 'all' | 'setDialog'
> & {
  inspectorOpen: boolean;
}) {
  return (
    <div
      className={`workspace-toolbar flex shrink-0 items-center justify-between gap-4 px-8 py-5
        max-compact:flex-wrap max-compact:px-4 max-compact:py-4
        ${inspectorOpen ? 'max-compact:hidden' : ''}`}
    >
      <div className="view-heading flex items-baseline gap-4">
        <h1>{page.charAt(0).toUpperCase() + page.slice(1)}</h1>
        <span className="text-small text-secondary">
          {running} running
          {attention > 0 && (
            <>
              {' '}
              · <b className="error-text text-danger">{attention} need attention</b>
            </>
          )}
        </span>
      </div>
      <div className="workspace-actions flex items-center gap-2">
        {page === 'services' && (
          <>
            <Button
              variant="secondary"
              disabled={!connected || pending.size > 0 || !services.some((s) => !alive(s))}
              onClick={() => void all('start')}
            >
              <Play size={13} />
              Start all
            </Button>
            <Button
              variant="secondary"
              disabled={!connected || pending.size > 0 || !services.some(alive)}
              onClick={() => void all('stop')}
            >
              <Square size={12} />
              Stop all
            </Button>
            <span className="action-divider mx-1 h-5 w-px bg-line" />
          </>
        )}
        <Button variant="primary" onClick={() => setDialog('new')} disabled={!connected}>
          <Plus size={16} />
          Add service
        </Button>
      </div>
    </div>
  );
}
