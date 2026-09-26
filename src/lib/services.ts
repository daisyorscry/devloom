import type { Service } from '../types';
export const alive = (s: Service) => ['running', 'starting', 'stopping'].includes(s.status);
export function uptime(startedAt?: number) {
  if (!startedAt) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
