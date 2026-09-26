import { TabButton } from './TabButton';
import { Input } from './FormField';
import { Button } from './Button';
import { useFolderBrowser } from '../hooks/useFolderBrowser';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { SearchInput } from './SearchInput';
export function FolderPicker({
  initialPath,
  onSelect,
  onClose,
}: {
  initialPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const {
    dialog,
    address,
    listing,
    query,
    hidden,
    busy,
    error,
    navigate,
    breadcrumbs,
    shortcuts,
    editAddress,
    searchFolders,
    showHidden,
    refreshFolders,
    previousPage,
    nextPage,
  } = useFolderBrowser(initialPath);
  return (
    <dialog
      ref={dialog}
      className="service-dialog folder-picker flex h-[660px] max-h-[calc(100dvh-32px)] w-200
        max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl bg-panel p-0 text-ink
        shadow-dialog backdrop:bg-black/50"
      aria-label="Choose project folder"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="folder-picker-header flex shrink-0 items-start justify-between gap-4 px-6 pt-6
          pb-5 max-compact:px-4"
      >
        <div>
          <h2 className="text-heading">Choose project folder</h2>
          <p className="mt-2 text-secondary">
            {listing?.container
              ? 'Container folders · mounted projects are available in /workspace.'
              : "Open a folder, then choose it as your service's working directory."}
          </p>
        </div>
        <Button variant="icon" type="button" aria-label="Close folder picker" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      <form
        className="folder-address flex shrink-0 items-center gap-2 px-6 max-compact:px-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          navigate(address);
        }}
      >
        <Button
          variant="icon"
          type="button"
          aria-label="Parent folder"
          disabled={busy || !listing?.parent}
          onClick={() => navigate(listing!.parent!)}
        >
          <ArrowUp size={18} />
        </Button>
        <Input
          aria-label="Folder path"
          value={address}
          onChange={(event) => editAddress(event.target.value)}
          placeholder="Enter an absolute path or ~/"
          spellCheck={false}
          autoComplete="off"
        />
        <Button variant="secondary" type="submit" disabled={busy}>
          Go
          <ArrowRight size={15} />
        </Button>
        <Button
          variant="icon"
          type="button"
          aria-label="Refresh folders"
          disabled={busy}
          onClick={refreshFolders}
        >
          <RefreshCw size={17} />
        </Button>
      </form>
      <nav
        className="folder-shortcuts flex shrink-0 flex-wrap gap-2 px-6 py-3 max-compact:px-4"
        aria-label="Folder locations"
      >
        {shortcuts.map((item) => (
          <TabButton
            active={listing?.path === item.path}
            type="button"
            key={item.name}
            onClick={() => navigate(item.path)}
          >
            <FolderOpen size={16} />
            {item.name}
          </TabButton>
        ))}
      </nav>
      <nav
        className="folder-breadcrumbs flex shrink-0 items-center overflow-x-auto px-6 py-2
          text-small max-compact:px-4"
        aria-label="Current folder"
      >
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path} className="flex shrink-0 items-center gap-1">
            {index > 0 && <ChevronRight size={14} />}
            <button
              type="button"
              aria-current={index === breadcrumbs.length - 1 ? 'location' : undefined}
              onClick={() => navigate(crumb.path)}
              className="rounded bg-transparent px-1 py-1 hover:bg-hover"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>
      <div
        className="folder-filters flex shrink-0 items-center gap-4 px-6 py-3 max-compact:flex-wrap
          max-compact:gap-2 max-compact:px-4"
      >
        <SearchInput
          label="Search folders"
          placeholder="Find a folder here…"
          value={query}
          onValueChange={searchFolders}
          className="flex-1 max-compact:basis-full"
        />
        <label className="flex shrink-0 items-center gap-2 text-small">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(event) => showHidden(event.target.checked)}
          />
          Show hidden
        </label>
      </div>
      <div
        className="folder-entries min-h-0 flex-1 overflow-auto border-y border-line px-3 py-2"
        aria-busy={busy}
      >
        {busy ? (
          <div
            className="folder-message flex h-full flex-col items-center justify-center gap-4 p-4
              text-center text-secondary"
            role="status"
          >
            <Loader2 size={22} className="spin animate-spin" />
            Opening folder…
          </div>
        ) : error ? (
          <div
            className="folder-message flex h-full flex-col items-center justify-center gap-4 p-4
              text-center text-secondary"
            role="alert"
          >
            <Folder size={28} />
            <p>{error}</p>
            <Button variant="secondary" type="button" onClick={() => navigate(listing?.path ?? '')}>
              Back to {listing ? 'last folder' : 'start'}
            </Button>
          </div>
        ) : listing?.entries.length ? (
          <ul aria-label="Folders" className="m-0 list-none p-0">
            {listing.entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className="folder-entry flex w-full items-center gap-3 rounded-lg bg-transparent
                    px-3 py-3 text-left hover:bg-hover"
                  aria-label={`Open folder ${entry.name}`}
                  onClick={() => navigate(entry.path)}
                >
                  <Folder size={20} />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {entry.symlink && <small className="text-muted">Link</small>}
                  <ChevronRight size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="folder-message flex h-full flex-col items-center justify-center gap-4 p-4
              text-center text-secondary"
          >
            <FolderOpen size={28} />
            <p>
              {query
                ? 'No folders match your search.'
                : 'No subfolders here. You can choose this folder.'}
            </p>
          </div>
        )}
      </div>
      {listing && !error && (listing.hasMore || listing.offset > 0) && (
        <div
          className="folder-pagination flex shrink-0 items-center justify-end gap-3 px-6 py-2
            text-small"
        >
          <span>
            {listing.offset + 1}–{listing.offset + listing.entries.length} of {listing.total}{' '}
            folders
          </span>
          <Button
            variant="icon"
            type="button"
            aria-label="Previous folders"
            disabled={busy || listing.offset === 0}
            onClick={previousPage}
          >
            <ArrowLeft size={17} />
          </Button>
          <Button
            variant="icon"
            type="button"
            aria-label="Next folders"
            disabled={busy || !listing.hasMore}
            onClick={nextPage}
          >
            <ArrowRight size={17} />
          </Button>
        </div>
      )}
      <div
        className="folder-picker-footer grid shrink-0 grid-cols-[1fr_auto_auto] items-center gap-2
          px-6 py-5 max-compact:grid-cols-2 max-compact:px-4"
      >
        <div className="min-w-0 max-compact:col-span-2">
          <span className="block text-small text-secondary">Selected folder</span>
          <strong title={listing?.path} className="block truncate text-small font-medium">
            {listing?.path ?? 'Choose a location'}
          </strong>
        </div>
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="button"
          disabled={busy || !!error || !listing || address !== listing.path}
          onClick={() => listing && onSelect(listing.path)}
        >
          Choose folder
          <ArrowRight size={15} />
        </Button>
      </div>
    </dialog>
  );
}
