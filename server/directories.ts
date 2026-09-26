import { existsSync } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { InputError } from './manager.js';
import type { DirectoryListing } from '../src/types.js';

/** Browse the filesystem of the Devloom process, including Docker bind mounts. */
export async function listDirectories(
  input: unknown,
  projectRoot: string,
): Promise<DirectoryListing> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new InputError('Folder options must be an object.');
  const { path, query = '', hidden = false, offset = 0 } = input as Record<string, unknown>;
  if (path !== undefined && (typeof path !== 'string' || path.length > 4096 || path.includes('\0')))
    throw new InputError('Enter a valid folder path.');
  if (
    typeof query !== 'string' ||
    query.length > 200 ||
    typeof hidden !== 'boolean' ||
    !Number.isSafeInteger(offset) ||
    Number(offset) < 0
  )
    throw new InputError('Invalid folder filter or page.');
  const container = existsSync('/.dockerenv');
  const home = homedir();
  const hasProjects = existsSync('/workspace');
  const initial = container && hasProjects ? '/workspace' : home;
  const requested = typeof path === 'string' && path.trim() ? path.trim() : initial;
  const expanded =
    requested === '~'
      ? home
      : requested.startsWith('~/')
        ? join(home, requested.slice(2))
        : requested;
  if (!isAbsolute(expanded)) throw new InputError('Use an absolute folder path or start with ~/.');
  try {
    const current = await realpath(resolve(expanded));
    const items = await readdir(current, { withFileTypes: true });
    const candidates = items.filter(
      (item) =>
        (hidden || !item.name.startsWith('.')) &&
        item.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    const folders: DirectoryListing['entries'] = [];
    // Limit simultaneous stat calls when a directory contains many symlinks.
    for (let start = 0; start < candidates.length; start += 32) {
      const batch = await Promise.all(
        candidates.slice(start, start + 32).map(async (item) => {
          const entryPath = join(current, item.name);
          const directory =
            item.isDirectory() ||
            (item.isSymbolicLink() &&
              (await stat(entryPath)
                .then((s) => s.isDirectory())
                .catch(() => false)));
          return directory
            ? { name: item.name, path: entryPath, symlink: item.isSymbolicLink() }
            : null;
        }),
      );
      for (const entry of batch) if (entry) folders.push(entry);
    }
    folders.sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) ||
        a.name.localeCompare(b.name),
    );
    const start = Number(offset);
    const parent = dirname(current);
    return {
      path: current,
      parent: parent === current ? null : parent,
      entries: folders.slice(start, start + 100),
      total: folders.length,
      offset: start,
      hasMore: start + 100 < folders.length,
      container,
      shortcuts: [
        ...(container && hasProjects ? [{ name: 'Projects', path: '/workspace' }] : []),
        { name: 'Home', path: home },
        { name: 'Devloom', path: projectRoot },
        { name: 'Filesystem', path: '/' },
      ],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM')
      throw new InputError(
        'Devloom does not have permission to open this folder. Choose another location.',
      );
    if (code === 'ENOENT')
      throw new InputError(
        'This folder does not exist. Check the path or choose another location.',
      );
    if (code === 'ENOTDIR') throw new InputError('This path is a file. Choose a folder instead.');
    if (code === 'ELOOP')
      throw new InputError('This folder link cannot be resolved. Choose another location.');
    throw error;
  }
}
