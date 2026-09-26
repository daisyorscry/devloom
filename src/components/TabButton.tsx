import type { ComponentProps } from 'react';
type TabButtonProps = ComponentProps<'button'> & {
  active: boolean;
};
export function TabButton({ active, className = '', ...props }: TabButtonProps) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-small whitespace-nowrap
        ${active ? 'active bg-control text-ink' : 'bg-transparent text-secondary hover:bg-hover'}
        ${className}`}
    />
  );
}
