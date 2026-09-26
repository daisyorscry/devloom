import { FormField, Input } from './components/FormField';
import { Button } from './components/Button';
import { useProjectSettings } from './hooks/useProjectSettings';
import { useWorkspaces } from './hooks/useWorkspaces';
import { FolderPlus, Settings2 } from 'lucide-react';
import type { Workspace } from './types';
import App from './App';
import { Modal } from './components/Modal';
import { Dropdown } from './components/Dropdown';
export default function WorkspaceRoot() {
  const { ready, loadError, retry, projects, setProjects, active, switchProject } = useWorkspaces();
  if (!ready)
    return (
      <div className="workspace-loading flex h-dvh items-center justify-center">
        Opening your workspace…
      </div>
    );
  if (loadError)
    return (
      <div
        className="workspace-loading workspace-load-error flex h-dvh flex-col items-center
          justify-center gap-4 px-6 text-center"
        role="alert"
      >
        <h1>Couldn’t open your projects</h1>
        <p>{loadError}</p>
        <Button variant="primary" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    );
  return (
    <App
      key={active}
      workspaceControl={(disabled) => (
        <WorkspaceControl
          projects={projects}
          active={active}
          disabled={disabled}
          onSwitch={switchProject}
          onProjects={setProjects}
        />
      )}
    />
  );
}
function WorkspaceControl({
  projects,
  active,
  disabled,
  onSwitch,
  onProjects,
}: {
  projects: Workspace[];
  active: string;
  disabled: boolean;
  onSwitch: (id: string) => void;
  onProjects: (projects: Workspace[]) => void;
}) {
  const { mode, setMode, name, setName, error, saving, open, save, remove } = useProjectSettings({
    projects,
    active,
    onSwitch,
    onProjects,
  });
  return (
    <>
      <div
        className="project-switcher flex min-w-0 items-center gap-1 max-desktop:col-start-2
          max-desktop:row-start-1 max-compact:col-span-2 max-compact:col-start-1
          max-compact:row-start-2"
      >
        <Dropdown
          label="Switch project"
          value={active}
          disabled={disabled}
          options={projects.map((p) => ({
            value: p.id,
            label: p.name,
          }))}
          onValueChange={onSwitch}
          className="w-55 border-transparent! bg-transparent! max-desktop:flex-1 max-compact:w-full"
        />
        <Button
          variant="icon"
          aria-label="New project"
          title="New project"
          disabled={disabled}
          onClick={() => open('new')}
        >
          <FolderPlus size={17} />
        </Button>
        <Button
          variant="icon"
          aria-label="Project settings"
          title="Project settings"
          disabled={disabled}
          onClick={() => open('edit')}
        >
          <Settings2 size={16} />
        </Button>
      </div>
      {mode && (
        <Modal
          title={mode === 'new' ? 'Create a project' : 'Project settings'}
          onClose={() => {
            if (!saving) setMode(null);
          }}
        >
          <form onSubmit={save} className="project-form flex flex-col gap-6 pt-2">
            <p>
              {mode === 'new'
                ? 'Give this workspace a name. Its services, logs, and telemetry stay together.'
                : 'Switching projects keeps running services alive. Stop them from their own project.'}
            </p>
            <FormField>
              Project name
              <Input
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Commerce platform"
              />
            </FormField>
            {error && (
              <p
                className="form-error mt-4 border-l-2 border-danger bg-danger-surface px-3 py-2
                  text-small text-danger"
                role="alert"
              >
                {error}
              </p>
            )}
            {mode === 'edit' && active !== 'default' && (
              <p className="project-delete-note">
                Only empty projects can be deleted. Remove their services first.
              </p>
            )}
            <div
              className="project-form-actions flex flex-wrap justify-end gap-2 border-t border-line
                pt-5"
            >
              {mode === 'edit' && active !== 'default' && (
                <Button
                  variant="danger"
                  type="button"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  Delete empty project
                </Button>
              )}
              <Button
                variant="secondary"
                type="button"
                disabled={saving}
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : mode === 'new' ? 'Create project' : 'Save name'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
