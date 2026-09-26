import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { DirectoryListing } from '../types';
export function useFolderBrowser(initialPath: string) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [location, setLocation] = useState({
    path: initialPath,
    offset: 0,
  });
  const [address, setAddress] = useState(initialPath);
  const [listing, setListing] = useState<DirectoryListing>();
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const sequence = useRef(0);
  const addressEdited = useRef(false);
  useEffect(() => {
    const node = dialog.current;
    const trigger = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    const request = ++sequence.current;
    setBusy(true);
    setError('');
    const timer = setTimeout(
      () => {
        void api<DirectoryListing>('/directories', 'POST', {
          path: location.path,
          offset: location.offset,
          query,
          hidden,
        })
          .then((data) => {
            if (sequence.current !== request) return;
            setListing(data);
            if (!addressEdited.current) setAddress(data.path);
          })
          .catch((err) => {
            if (sequence.current === request) setError(err.message);
          })
          .finally(() => {
            if (sequence.current === request) setBusy(false);
          });
      },
      query ? 150 : 0,
    );
    return () => {
      clearTimeout(timer);
      sequence.current++;
    };
  }, [location, query, hidden, refresh]);
  function navigate(path: string) {
    addressEdited.current = false;
    setBusy(true);
    setError('');
    setQuery('');
    setAddress(path);
    setLocation({
      path,
      offset: 0,
    });
  }
  const breadcrumbs = listing
    ? [
        {
          name: '/',
          path: '/',
        },
        ...listing.path
          .split('/')
          .filter(Boolean)
          .map((name, index, parts) => ({
            name,
            path: '/' + parts.slice(0, index + 1).join('/'),
          })),
      ]
    : [];
  const shortcuts = listing?.shortcuts ?? [
    {
      name: 'Home',
      path: '~',
    },
    {
      name: 'Filesystem',
      path: '/',
    },
  ];
  function editAddress(value: string) {
    addressEdited.current = true;
    setAddress(value);
  }
  function searchFolders(value: string) {
    setQuery(value);
    setLocation((current) => ({
      ...current,
      offset: 0,
    }));
  }
  function showHidden(value: boolean) {
    setHidden(value);
    setLocation((current) => ({
      ...current,
      offset: 0,
    }));
  }
  function refreshFolders() {
    setRefresh((n) => n + 1);
  }
  function previousPage() {
    if (listing)
      setLocation({
        path: listing.path,
        offset: Math.max(0, listing.offset - 100),
      });
  }
  function nextPage() {
    if (listing)
      setLocation({
        path: listing.path,
        offset: listing.offset + 100,
      });
  }
  return {
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
  };
}
