import type { Service } from '../types';
export function StatusBadge({ service }: { service: Service }) {
  const color =
    service.status === 'running'
      ? 'text-healthy'
      : service.status === 'failed'
        ? 'text-danger'
        : ['starting', 'stopping'].includes(service.status)
          ? 'text-warning'
          : 'text-secondary';
  return (
    <span
      className={`status-badge inline-flex items-center gap-2 text-small whitespace-nowrap
        capitalize ${service.status} ${color}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {service.status}
    </span>
  );
}
