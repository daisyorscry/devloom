import type { ComponentProps } from 'react';
type ButtonVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'icon' | 'text';
type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  tone?: 'default' | 'console';
};

// Small, mutually exclusive variants keep callers and the markup readable.
const colors: Record<ButtonVariant, string> = {
  default: '',
  primary: 'primary bg-primary text-on-primary hover:opacity-85',
  secondary: 'secondary bg-control text-ink hover:bg-hover',
  danger: 'danger text-danger hover:bg-danger-surface',
  icon: 'text-secondary hover:bg-hover hover:text-ink',
  text: 'text-ink hover:underline',
};
const shapes = {
  icon: 'icon-button size-8 bg-transparent p-0',
  text: 'text-button bg-transparent p-0',
  default: 'button min-h-9 px-3 py-2',
};
export function Button({
  variant = 'default',
  tone = 'default',
  className = '',
  ...props
}: ButtonProps) {
  const shape = variant === 'icon' || variant === 'text' ? variant : 'default';
  const color =
    tone === 'console'
      ? 'text-console-muted hover:bg-console-hover hover:text-console-text'
      : colors[variant];
  return (
    <button
      {...props}
      data-variant={variant}
      data-tone={tone}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-small
        font-medium disabled:pointer-events-none ${shapes[shape]} ${color} ${className}`}
    />
  );
}
