import { useEffect, useState } from 'react';
import { api, selectWorkspace } from '../api';
import type { Workspace } from '../types';
export function useWorkspaces() {
  const [projects, setProjects] = useState<Workspace[]>([]);
  const [active, setActive] = useState('default');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError('');
      setReady(false);
      selectWorkspace('default');
      try {
        const list = await api<Workspace[]>('/workspaces');
        if (cancelled) return;
        let saved: string | null = null;
        try {
          saved = localStorage.getItem('devloom.workspace');
        } catch {}
        const id = list.some((p) => p.id === saved) ? saved! : 'default';
        selectWorkspace(id);
        setActive(id);
        setProjects(list);
      } catch (error) {
        if (!cancelled)
          setLoadError(
            (error as Error).message === 'Endpoint not found.'
              ? 'The running Devloom server is out of date. Restart Devloom, then try again.'
              : (error as Error).message,
          );
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  function switchProject(id: string) {
    selectWorkspace(id);
    setActive(id);
    try {
      localStorage.setItem('devloom.workspace', id);
    } catch {}
  }
  return {
    ready,
    loadError,
    retry: () => setAttempt((n) => n + 1),
    projects,
    setProjects,
    active,
    switchProject,
  };
}
