import test from 'node:test';
import assert from 'node:assert/strict';
import { formatArgs, parseArgs } from '../src/lib/commands.js';

test('arguments preserve quoted paths, empty strings and literal shell operators', () => {
  assert.deepEqual(parseArgs('run "project with spaces/main.py" --flag \'literal $HOME\' ""'), [
    'run',
    'project with spaces/main.py',
    '--flag',
    'literal $HOME',
    '',
  ]);
  assert.deepEqual(parseArgs('echo hi && echo bye'), ['echo', 'hi', '&&', 'echo', 'bye']);
  assert.throws(() => parseArgs('run "unclosed'), /quotes/);
  const args = ['hello world', 'plain', '', '$literal', 'path\\name', 'has"quote'];
  assert.deepEqual(parseArgs(formatArgs(args)), args);
});
