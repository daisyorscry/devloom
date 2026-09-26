import { useRef } from 'react';
import { Search, X } from 'lucide-react';
type SearchInputProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  tone?: 'default' | 'console';
};
export function SearchInput({
  label,
  value,
  onValueChange,
  placeholder = 'Search…',
  className = '',
  tone = 'default',
}: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      data-tone={tone}
      className={`search-input flex h-10 min-w-0 items-center gap-2 rounded-lg border pr-1 pl-3
        focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${
          tone === 'console'
            ? 'border-console-line bg-console-control text-console-text'
            : 'border-line bg-control text-ink'
        } ${className}`}
    >
      <Search size={17} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-small outline-none
          placeholder:text-current placeholder:opacity-65 [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => onValueChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            event.stopPropagation();
            onValueChange('');
          }
        }}
      />
      <span className="size-7 shrink-0">
        {value && (
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded hover:bg-current/10"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              onValueChange('');
              input.current?.focus();
            }}
          >
            <X size={15} />
          </button>
        )}
      </span>
    </div>
  );
}
