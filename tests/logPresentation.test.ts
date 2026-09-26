import test from 'node:test';
import assert from 'node:assert/strict';
import { logTone, logTokens } from '../src/logPresentation.js';

test('log display distinguishes explicit severity from stream and incidental words', () => {
  assert.equal(logTone({ stream: 'stderr', message: '[WARN] retrying' }), 'warn');
  assert.equal(logTone({ stream: 'stdout', message: '{"level":"error","msg":"failed"}' }), 'error');
  assert.equal(
    logTone({ stream: 'stdout', message: '2026-09-27T10:00:00Z INFO listening' }),
    'info',
  );
  assert.equal(logTone({ stream: 'stdout', message: 'error count: 0' }), 'error');
  assert.equal(logTone({ stream: 'stdout', message: 'GET /error-report 200' }), 'output');
  assert.equal(logTone({ stream: 'stdout', message: '{"level":' }), 'output');
  assert.equal(logTone({ stream: 'system', message: 'Process stopped' }), 'system');
});

test('log tokens preserve whitespace and markup as plain text while highlighting HTTP status', () => {
  const messages = [
    'INFO  GET /health 200  12.5ms',
    'POST /checkout HTTP/1.1 503 81ms',
    'WARN GET /users 404',
    'redirect GET /login 302',
    'https://localhost:8080/health <script>alert("ERROR")</script>',
    '{"level":"debug", "message":"connected", "count":200}',
    '',
    'some unstructured output\nwith  two spaces',
  ];
  for (const message of messages)
    assert.equal(
      logTokens(message)
        .map((t) => t.text)
        .join(''),
      message,
    );
  assert.equal(logTokens(messages[0]).find((t) => t.text === '200')?.tone, 'success');
  assert.equal(logTokens(messages[1]).find((t) => t.text === '503')?.tone, 'error');
  assert.equal(logTokens(messages[2]).find((t) => t.text === '404')?.tone, 'warn');
  assert.ok(!logTokens(messages[5]).some((t) => t.text === '200' && t.tone));
});
