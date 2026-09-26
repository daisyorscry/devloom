import { useState, useTransition } from 'react';

export type WorkspacePage = 'services' | 'logs' | 'traces' | 'metrics';

export function useTabNavigation() {
  const [page, showPage] = useState<WorkspacePage>('services');
  const [requestedPage, setRequestedPage] = useState<WorkspacePage>('services');
  const [isSwitching, startTransition] = useTransition();

  function setPage(next: WorkspacePage) {
    setRequestedPage(next);
    startTransition(() => showPage(next));
  }

  return { page, requestedPage, setPage, isSwitching };
}
