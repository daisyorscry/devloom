import type { WorkspaceController } from '../hooks/useWorkspaceController';
import { Button } from './Button';
import type { Service } from '../types';
import { alive } from '../lib/services';
import { Loader2, Play, RotateCw, Square } from 'lucide-react';
export function ServiceControls({
  service,
  full = false,
  connected,
  pending,
  action,
}: {
  service: Service;
  full?: boolean;
} & Pick<WorkspaceController, 'connected' | 'pending' | 'action'>) {
  return (
    <div
      className={`service-controls flex justify-end gap-1
        ${full ? 'full w-full justify-start' : ''}`}
    >
      <Button
        variant={full ? 'primary' : 'icon'}
        aria-label={`${alive(service) ? 'Stop' : 'Start'} ${service.name}`}
        title={alive(service) ? 'Stop service' : 'Start service'}
        disabled={
          !connected ||
          pending.has(service.id) ||
          pending.has('all') ||
          ['stopping', 'starting'].includes(service.status)
        }
        onClick={(e) => {
          e.stopPropagation();
          action(service, alive(service) ? 'stop' : 'start');
        }}
      >
        {pending.has(service.id) ? (
          <Loader2 className="spin animate-spin" size={15} />
        ) : alive(service) ? (
          <Square size={13} />
        ) : (
          <Play size={15} />
        )}
        {full && (alive(service) ? 'Stop' : 'Start')}
      </Button>
      <Button
        variant={full ? 'secondary' : 'icon'}
        aria-label={`Restart ${service.name}`}
        title="Restart service"
        disabled={
          !connected ||
          pending.has(service.id) ||
          pending.has('all') ||
          ['stopping', 'starting'].includes(service.status)
        }
        onClick={(e) => {
          e.stopPropagation();
          action(service, 'restart');
        }}
      >
        <RotateCw size={15} />
        {full && 'Restart'}
      </Button>
    </div>
  );
}
