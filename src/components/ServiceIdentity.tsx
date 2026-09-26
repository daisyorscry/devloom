import type { Service } from '../types';
export function Loom({ small = false }: { small?: boolean }) {
  return (
    <svg
      className="shrink-0 text-accent"
      width={small ? 20 : 24}
      height={small ? 22 : 27}
      viewBox="0 0 24 27"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M4 3v21M11 3v21M18 3v21M1 14l22-8M1 23l22-8" />
    </svg>
  );
}
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
