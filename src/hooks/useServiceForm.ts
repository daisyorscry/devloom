import { parseArgs } from '../lib/commands';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Service, ServiceConfig } from '../types';

// Parse command arguments without invoking a shell; quoted paths remain one argument.
export function useServiceForm({
  service,
  onClose,
  onSaved,
}: {
  service?: Service;
  onClose: () => void;
  onSaved: (service: Service) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [directory, setDirectory] = useState(service?.directory ?? '');
  const [browsing, setBrowsing] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const config: Omit<ServiceConfig, 'id'> = {
        name: String(form.get('name')),
        directory: String(form.get('directory')),
        command: String(form.get('command')),
        args: parseArgs(String(form.get('args'))),
        kind: form.get('kind') as ServiceConfig['kind'],
        port: form.get('port') ? Number(form.get('port')) : undefined,
        healthUrl: String(form.get('healthUrl')) || undefined,
      };
      const saved = await api<Service>(
        service ? `/services/${service.id}` : '/services',
        service ? 'PUT' : 'POST',
        config,
      );
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return {
    dialog,
    error,
    saving,
    directory,
    setDirectory,
    browsing,
    setBrowsing,
    submit,
  };
}
