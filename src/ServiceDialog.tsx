import { FormField, Input } from './components/FormField';
import { Button } from './components/Button';
import type { Service } from './types';
import { useServiceForm } from './hooks/useServiceForm';
import { formatArgs } from './lib/commands';
import { FolderPicker } from './components/FolderPicker';
import { Dropdown } from './components/Dropdown';
import { ArrowRight, Folder, Terminal, X } from 'lucide-react';
// Parse command arguments without invoking a shell; quoted paths remain one argument.

export default function ServiceDialog({
  service,
  onClose,
  onSaved,
}: {
  service?: Service;
  onClose: () => void;
  onSaved: (service: Service) => void;
}) {
  const { dialog, error, saving, directory, setDirectory, browsing, setBrowsing, submit } =
    useServiceForm({
      service,
      onClose,
      onSaved,
    });
  return (
    <dialog
      ref={dialog}
      className="service-dialog service-form max-h-[90dvh] w-152 max-w-[calc(100vw-32px)]
        overflow-auto rounded-2xl bg-panel p-0 p-7 text-ink shadow-dialog backdrop:bg-black/50"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div
          className="form-header flex items-start justify-between gap-4 px-7 py-6 max-compact:px-5"
        >
          <div>
            <h2 className="mb-2 text-heading">{service ? 'Edit service' : 'Add a service'}</h2>
            <p className="text-secondary">A project, a command, and you're ready.</p>
          </div>
          <Button variant="icon" type="button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
        <div className="form-content px-7 pb-7 max-compact:px-5">
          <div className="identity-fields mb-5 grid grid-cols-[1.6fr_1fr] gap-4">
            <FormField>
              Service name
              <Input
                name="name"
                placeholder="e.g. Auth Service"
                defaultValue={service?.name}
                maxLength={80}
                required
                autoFocus
              />
            </FormField>
            <FormField>
              Type
              <Dropdown
                label="Service type"
                name="kind"
                defaultValue={service?.kind ?? 'api'}
                options={[
                  {
                    value: 'api',
                    label: 'API / Backend',
                  },
                  {
                    value: 'worker',
                    label: 'Worker',
                  },
                  {
                    value: 'scheduler',
                    label: 'Scheduler',
                  },
                  {
                    value: 'frontend',
                    label: 'Frontend',
                  },
                  {
                    value: 'service',
                    label: 'Other',
                  },
                ]}
                className="h-11! w-full"
              />
            </FormField>
          </div>
          <div className="directory-field mb-5 flex flex-col gap-2">
            <FormField htmlFor="service-directory">Project directory</FormField>
            <div className="directory-control flex items-center gap-2">
              <div
                className="input-with-icon flex min-w-0 flex-1 items-center gap-2 rounded-lg border
                  border-line bg-control pl-3 text-secondary focus-within:outline-2
                  focus-within:outline-focus"
              >
                <Folder size={17} />
                <Input
                  id="service-directory"
                  name="directory"
                  placeholder="~/projects/auth"
                  value={directory}
                  onChange={(event) => setDirectory(event.target.value)}
                  required
                  className="border-0 bg-transparent! pl-0! focus:outline-none"
                />
              </div>
              <Button
                variant="secondary"
                type="button"
                aria-label="Browse project directory"
                onClick={() => setBrowsing(true)}
              >
                <Folder size={17} />
                Browse
              </Button>
            </div>
            <small>Choose a folder or enter its path. Supports ~/.</small>
          </div>
          <div className="run-fields grid grid-cols-[1fr_2.5fr] gap-4">
            <FormField>
              Command
              <Input name="command" placeholder="go" defaultValue={service?.command} required />
            </FormField>
            <FormField>
              Arguments
              <Input
                name="args"
                placeholder="run ./cmd/api"
                defaultValue={service ? formatArgs(service.args) : ''}
              />
            </FormField>
          </div>
          <p className="field-note mt-3 flex items-start gap-2 text-small text-muted">
            <Terminal size={14} />
            Use your normal run command. Quote arguments that contain spaces.
          </p>
          <div
            className="optional-heading mt-6 mb-4 flex justify-between border-t border-line pt-5
              text-small text-secondary"
          >
            <span>Health & networking</span>
            <span>Optional</span>
          </div>
          <div className="network-fields grid grid-cols-[1fr_2.5fr] gap-4">
            <FormField>
              Port
              <Input
                name="port"
                type="number"
                min="1"
                max="65535"
                placeholder="8080"
                defaultValue={service?.port}
              />
            </FormField>
            <FormField>
              Health endpoint
              <Input
                name="healthUrl"
                type="url"
                placeholder="http://localhost:8080/health"
                defaultValue={service?.healthUrl}
              />
            </FormField>
          </div>
          {error && (
            <div
              className="form-error mt-4 border-l-2 border-danger bg-danger-surface px-3 py-2
                text-small text-danger"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
        <div
          className="form-bottom flex items-center justify-between gap-4 bg-control px-7 py-5
            max-compact:px-5"
        >
          <span className="text-small text-muted max-compact:hidden">Stored on this machine</span>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={saving} type="submit">
              {saving ? 'Saving…' : service ? 'Save changes' : 'Add service'}
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      </form>
      {browsing && (
        <FolderPicker
          initialPath={directory}
          onClose={() => setBrowsing(false)}
          onSelect={(path) => {
            setDirectory(path);
            setBrowsing(false);
          }}
        />
      )}
    </dialog>
  );
}
