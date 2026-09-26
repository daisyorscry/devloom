import { useCallback, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
type DropdownProps = {
  label: string;
  options: readonly DropdownOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  tone?: 'default' | 'console';
  className?: string;
};

/** Radix handles keyboard navigation; the portal stays inside any open modal. */
export function Dropdown({
  label,
  options,
  value,
  defaultValue = '',
  onValueChange,
  name,
  disabled,
  tone = 'default',
  className = '',
}: DropdownProps) {
  const [internal, setInternal] = useState(defaultValue);
  const [container, setContainer] = useState<HTMLElement>();
  const selected = value ?? internal;
  const attach = useCallback((node: HTMLButtonElement | null) => {
    if (node) setContainer(node.closest('dialog') ?? document.body);
  }, []);
  return (
    <>
      {name && <input type="hidden" name={name} value={selected} disabled={disabled} />}
      <Select.Root
        value={`option:${selected}`}
        disabled={disabled}
        onValueChange={(encoded) => {
          const next = encoded.slice(7);
          setInternal(next);
          onValueChange?.(next);
        }}
      >
        <Select.Trigger
          ref={attach}
          aria-label={label}
          title={options.find((o) => o.value === selected)?.label}
          data-tone={tone}
          className={`dropdown-trigger group inline-flex h-10 max-w-full min-w-0 items-center
            justify-between gap-3 rounded-lg border px-3 text-small data-[state=open]:outline-2
            data-[state=open]:outline-focus [&>span:first-child]:truncate ${
              tone === 'console'
                ? 'border-console-line bg-console-control text-console-text'
                : 'border-line bg-control text-ink hover:bg-hover'
            } ${className}`}
        >
          <Select.Value placeholder="Choose an option" />
          <Select.Icon asChild>
            <ChevronDown
              size={16}
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal container={container}>
          <Select.Content
            position="popper"
            sideOffset={7}
            collisionPadding={12}
            align="start"
            data-devloom-dropdown=""
            data-tone={tone}
            className={`dropdown-menu z-50
              max-h-[min(320px,var(--radix-select-content-available-height))]
              max-w-[calc(100vw-24px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden
              rounded-xl border shadow-lg ${
                tone === 'console'
                  ? 'border-console-line bg-console-control text-console-text'
                  : 'border-line bg-panel text-ink'
              }`}
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            <Select.ScrollUpButton className="flex h-6 items-center justify-center">
              <ChevronUp size={15} />
            </Select.ScrollUpButton>
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={`option:${option.value}`}
                  disabled={option.disabled}
                  textValue={option.label}
                  className={`relative flex min-h-10 cursor-pointer items-center rounded-md py-2
                  pr-9 pl-3 text-small outline-none select-none data-disabled:pointer-events-none
                  data-disabled:opacity-40 data-[state=checked]:font-semibold
                  ${tone === 'console' ? 'data-highlighted:bg-console-hover' : 'data-highlighted:bg-hover'}`}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3 flex">
                    <Check size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex h-6 items-center justify-center">
              <ChevronDown size={15} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}
