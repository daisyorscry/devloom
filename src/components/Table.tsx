import type { ComponentProps } from 'react';
export function TableHead({ className = '', ...props }: ComponentProps<'th'>) {
  return (
    <th
      {...props}
      className={`sticky top-0 z-1 border-b border-line bg-table-head px-3 py-3 text-small
        font-semibold text-ink first:rounded-tl-lg last:rounded-tr-lg max-compact:px-2 ${className}`}
    />
  );
}
export function TableCell({ className = '', ...props }: ComponentProps<'td'>) {
  return (
    <td
      {...props}
      className={`px-3 py-3 text-small text-secondary max-compact:px-2 ${className}`}
    />
  );
}
export function TableRow({ className = '', onClick, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      {...props}
      onClick={onClick}
      className={`even:bg-stripe ${onClick ? 'cursor-pointer hover:bg-hover' : ''} ${className}`}
    />
  );
}
