import { useState } from 'react';
import { api, selectWorkspace } from '../api';
import type { Workspace } from '../types';
export function useProjectSettings({
  projects,
  active,
  onSwitch,
  onProjects,
}: {
  projects: Workspace[];
  active: string;
  onSwitch: (id: string) => void;
  onProjects: (projects: Workspace[]) => void;
}) {
  const [mode, setMode] = useState<'new' | 'edit' | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const current = projects.find((p) => p.id === active);
  function open(next: 'new' | 'edit') {
    setMode(next);
    setName(next === 'edit' ? (current?.name ?? '') : '');
    setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const project = await api<Workspace>(
        mode === 'new' ? '/workspaces' : `/workspaces/${active}`,
        mode === 'new' ? 'POST' : 'PUT',
        {
          name,
        },
      );
      onProjects(await api<Workspace[]>('/workspaces'));
      setMode(null);
      onSwitch(project.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setSaving(true);
    setError('');
    try {
      await api(`/workspaces/${active}`, 'DELETE');
      selectWorkspace('default');
      onProjects(await api<Workspace[]>('/workspaces'));
      setMode(null);
      onSwitch('default');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return {
    mode,
    setMode,
    name,
    setName,
    error,
    saving,
    open,
    save,
    remove,
  };
}
