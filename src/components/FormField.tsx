import type { ComponentProps } from 'react';
export function FormField({ className = '', ...props }: ComponentProps<'label'>) {
  return (
    <label
      {...props}
      className={`flex min-w-0 flex-col gap-2 text-small font-medium ${className}`}
    />
  );
}
export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-lg border border-line bg-control px-3 text-body text-ink
        placeholder:text-muted focus:outline-2 focus:outline-focus ${className}`}
    />
  );
}
