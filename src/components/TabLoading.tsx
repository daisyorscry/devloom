import { Loader2 } from 'lucide-react';

export function TabLoading({ label, overlay = false }: { label: string; overlay?: boolean }) {
  return (
    <div
      role="status"
      aria-label={`Loading ${label}`}
      className={`flex min-h-0 flex-1 items-center justify-center gap-3 bg-surface text-small
        text-secondary ${overlay ? 'absolute inset-0 z-10' : ''}`}
    >
      <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>Loading {label}…</span>
    </div>
  );
}
