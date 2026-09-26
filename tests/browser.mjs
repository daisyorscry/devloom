import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
const port = await freePort(),
  otlpPort = await freePort(),
  servicePort = await freePort();
const dataDir = mkdtempSync(join(tmpdir(), 'devloom-browser-'));
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/server/server/index.js'], {
  env: {
    ...process.env,
    DEVLOOM_PORT: String(port),
    DEVLOOM_OTLP_PORT: String(otlpPort),
    DEVLOOM_DATA_DIR: dataDir,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (x) => (output += x));
server.stderr.on('data', (x) => (output += x));
let browser;
const pendingRoutes = [];
const releaseRoutes = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/session`)).ok) break;
    } catch {}
    if (i === 99) throw new Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    colorScheme: 'light',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(base) && !request.url().startsWith('data:'))
      external.push(request.url());
  });
  await page.route('**/api/workspaces?workspace=default', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Endpoint not found.' }),
    }),
  );
  await page.goto(base);
  await expect(page.getByRole('alert')).toContainText('server is out of date');
  await page.unroute('**/api/workspaces?workspace=default');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('combobox', { name: 'Switch project' })).toHaveText(
    'Local workspace',
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  mkdirSync('.devloom/artifacts', { recursive: true });
  await expect(page.getByText('No services registered')).toBeVisible();
  await page.getByRole('button', { name: 'Add service', exact: true }).first().click();
  const form = page.locator('dialog');
  const type = form.getByRole('combobox', { name: 'Service type' });
  await type.click();
  await expect(form.getByRole('listbox')).toBeVisible();
  await page.screenshot({ path: '.devloom/artifacts/dark-form-dropdown.png' });
  await page.getByRole('option', { name: 'Worker', exact: true }).click();
  await expect(type).toHaveText('Worker');
  await expect(form.locator('input[name="kind"]')).toHaveValue('worker');
  await type.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Worker', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: 'API / Backend', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(type).toHaveText('API / Backend');
  await type.click();
  await page.keyboard.press('Escape');
  await expect(form).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await form.getByLabel('Service name', { exact: true }).fill('Browser API');
  await form.getByLabel('Project directory', { exact: true }).fill(process.cwd());
  // Browse real folders inside the service form without submitting or losing it.
  await form.getByRole('button', { name: 'Browse project directory' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose project folder' });
  await expect(picker.getByLabel('Folder path', { exact: true })).toHaveValue(process.cwd());
  await picker.getByRole('button', { name: 'Open folder examples', exact: true }).click();
  await expect(picker.getByLabel('Folder path', { exact: true })).toHaveValue(
    join(process.cwd(), 'examples'),
  );
  await picker.getByRole('button', { name: 'Parent folder' }).click();
  await picker.getByLabel('Search folders').fill('server');
  await expect(
    picker.getByRole('button', { name: 'Open folder server', exact: true }),
  ).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Open folder src', exact: true })).toHaveCount(0);
  // A slow search refresh must not replace a path the user is typing.
  await page.route('**/api/directories?workspace=default', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.continue();
  });
  await page.keyboard.press('Escape');
  await expect(picker).toBeVisible();
  await expect(picker.getByLabel('Search folders')).toHaveValue('');
  await picker.getByLabel('Folder path', { exact: true }).fill(join(dataDir, 'missing'));
  await expect(picker.getByRole('button', { name: 'Go', exact: true })).toBeEnabled();
  await expect(picker.getByLabel('Folder path', { exact: true })).toHaveValue(
    join(dataDir, 'missing'),
  );
  await picker.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(picker.getByRole('alert')).toContainText('does not exist');
  await expect(picker.getByRole('button', { name: 'Choose folder', exact: true })).toBeDisabled();
  await page.unroute('**/api/directories?workspace=default');
  await picker.getByRole('button', { name: 'Back to last folder' }).click();
  await expect(picker.getByRole('button', { name: 'Choose folder', exact: true })).toBeEnabled();
  await page.screenshot({ path: '.devloom/artifacts/folder-picker-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(picker).toBeVisible();
  const pickerBox = await picker.boundingBox();
  assert.ok(
    pickerBox.x >= 0 &&
      pickerBox.x + pickerBox.width <= 390 &&
      pickerBox.y >= 0 &&
      pickerBox.y + pickerBox.height <= 844,
  );
  await page.screenshot({ path: '.devloom/artifacts/folder-picker-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 950 });
  await picker.getByRole('button', { name: 'Choose folder', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(form.getByLabel('Service name', { exact: true })).toHaveValue('Browser API');
  await expect(form.getByLabel('Project directory', { exact: true })).toHaveValue(process.cwd());
  await form.getByRole('button', { name: 'Browse project directory' }).click();
  await expect(picker.getByRole('button', { name: 'Choose folder', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(form).toBeVisible();
  await expect(form.getByRole('button', { name: 'Browse project directory' })).toBeFocused();
  await form.getByLabel('Command', { exact: true }).fill(process.execPath);
  await form
    .getByLabel('Arguments', { exact: true })
    .fill(`examples/service.mjs "Browser API" ${servicePort}`);
  await form.getByLabel('Port', { exact: true }).fill(String(servicePort));
  await form
    .getByLabel('Health endpoint', { exact: true })
    .fill(`http://127.0.0.1:${servicePort}/health`);
  await form.getByRole('button', { name: 'Add service', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('.service-drawer')).toBeVisible();
  await page
    .locator('.service-drawer')
    .getByRole('button', { name: 'Start Browser API', exact: true })
    .click();
  await expect(page.locator('.drawer-header .status-badge')).toHaveText('running');
  await expect(page.locator('.process-table tbody tr .health-column')).toHaveText('Healthy', {
    timeout: 12000,
  });
  await expect(page.locator('.console-body')).toContainText('Listening on');
  const { token } = await (await fetch(`${base}/api/session`)).json();
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-devloom-token': token },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
    assert.ok(response.ok, await response.clone().text());
    return response.status === 204 ? null : response.json();
  };
  const apiService = (await request('/services')).services[0];
  for (let i = 0; i < 14; i++)
    await request('/services', 'POST', {
      name: `Additional ${i + 1}`,
      directory: process.cwd(),
      command: process.execPath,
      args: ['-e', 'console.log("example")'],
    });
  const layout = () =>
    page.evaluate(() => ({
      pageHeight: document.documentElement.scrollHeight,
      pageWidth: document.documentElement.scrollWidth,
      height: innerHeight,
      width: innerWidth,
      drawer: document.querySelector('.service-drawer')?.getBoundingClientRect().toJSON(),
      table: document.querySelector('.process-table-scroll')?.getBoundingClientRect().toJSON(),
      inspectorFits:
        !document.querySelector('.inspector') ||
        document.querySelector('.inspector').scrollHeight <=
          document.querySelector('.inspector').clientHeight + 1,
      fontSizes: [
        ...new Set(
          [...document.querySelectorAll('body *')]
            .filter((x) => x.textContent.trim() && x.getClientRects().length)
            .map((x) => getComputedStyle(x).fontSize),
        ),
      ],
    }));
  let info = await layout();
  assert.equal(info.pageHeight, info.height);
  assert.equal(info.drawer.width, info.width);
  assert.ok(info.inspectorFits);
  assert.ok(info.table.height > 90);
  assert.deepEqual(info.fontSizes.sort(), ['14px', '16px', '24px']);
  await page.locator('.process-table-scroll').evaluate((element) => {
    element.scrollTop = 200;
  });
  assert.ok((await page.locator('.process-table-scroll').evaluate((e) => e.scrollTop)) > 0);
  await expect(page.locator('.service-drawer')).toBeVisible();
  await page.getByRole('button', { name: 'View full', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Logs', exact: true })).toBeVisible();
  const logService = page.getByRole('combobox', { name: 'Filter logs by service' });
  await expect(logService).toHaveText('Browser API');
  await logService.click();
  await page.getByRole('option', { name: 'All services', exact: true }).click();
  await expect(logService).toHaveText('All services');
  await logService.click();
  await page.getByRole('option', { name: 'Browser API', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter log stream' }).click();
  await page.getByRole('option', { name: 'stdout', exact: true }).click();
  await page.getByLabel('Search logs').fill('Listening');
  await expect(page.locator('.log-message')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search logs' }).click();
  await expect(page.getByLabel('Search logs')).toBeFocused();
  await expect(page.getByLabel('Search logs')).toHaveValue('');
  await page.getByLabel('Search logs').fill('nothing matches this');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Search logs')).toHaveValue('');
  await page.getByRole('button', { name: 'Pause logs', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume logs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume logs', exact: true }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Services/ })
    .click();
  await page.getByRole('heading', { name: 'Services', exact: true }).click();
  await expect(page.locator('.service-drawer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Browser API', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.service-drawer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Browser API', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  info = await layout();
  assert.equal(info.pageHeight, info.height);
  assert.ok(info.pageWidth <= info.width);
  assert.ok(info.table.height > 55);
  assert.ok(info.inspectorFits);
  mkdirSync('.devloom/artifacts', { recursive: true });
  await page.locator('.service-drawer').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  assert.ok((await page.locator('.service-drawer').boundingBox()).y >= 0);
  await page.screenshot({ path: '.devloom/artifacts/verified-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.screenshot({ path: '.devloom/artifacts/verified-desktop.png' });
  await page.getByRole('combobox', { name: 'Filter log stream' }).click();
  await page.getByRole('option', { name: 'stderr', exact: true }).click();
  await expect(page.locator('.service-drawer')).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter log stream' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.service-drawer')).toBeVisible();
  await promisify(execFile)(process.execPath, ['examples/telemetry.mjs'], {
    env: {
      ...process.env,
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${otlpPort}`,
      OTEL_SERVICE_NAME: 'Checkout example',
    },
  });
  // Keep the initial data request pending and leave the tab before it resolves.
  let releaseTelemetry;
  const telemetryGate = new Promise((resolve) => {
    releaseTelemetry = resolve;
  });
  releaseRoutes.push(releaseTelemetry);
  await page.route('**/api/telemetry?workspace=default', (route) => {
    const pending = telemetryGate.then(() => route.continue());
    pendingRoutes.push(pending);
    return pending;
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Traces', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Loading traces' })).toBeVisible();
  await expect(page.getByText('Waiting for traces', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Logs', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Full log viewer' })).toBeVisible();
  releaseTelemetry();
  await Promise.all(pendingRoutes);
  await page.unroute('**/api/telemetry?workspace=default');
  await expect(page.getByRole('status', { name: 'Loading traces' })).toHaveCount(0);
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Logs', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  // A failed initial fetch exits the loading state instead of leaving a spinner stuck.
  await page.route('**/api/telemetry?workspace=default', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Telemetry temporarily unavailable.' }),
    }),
  );
  await page.getByRole('navigation').getByRole('button', { name: 'Traces', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Telemetry temporarily unavailable.');
  await expect(page.getByRole('status', { name: 'Loading traces' })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Logs', exact: true }).click();
  await page.unroute('**/api/telemetry?workspace=default');
  await page.getByRole('navigation').getByRole('button', { name: 'Traces', exact: true }).click();
  await expect(page.getByRole('button', { name: 'POST /checkout', exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'POST /checkout', exact: true }).click();
  await expect(page.locator('.waterfall-row')).toHaveCount(4);
  await page.locator('.waterfall-row').first().click();
  await expect(page.locator('.span-inspector')).toContainText('POST');
  await page.screenshot({ path: '.devloom/artifacts/verified-traces.png' });
  // Both the lazy chart bundle and its initial data have an explicit pending state.
  let releaseMetrics;
  const metricsGate = new Promise((resolve) => {
    releaseMetrics = resolve;
  });
  releaseRoutes.push(releaseMetrics);
  await page.route('**/assets/MetricsView-*.js', (route) => {
    const pending = metricsGate.then(() => route.continue());
    pendingRoutes.push(pending);
    return pending;
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Metrics', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Loading metrics' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Logs', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Full log viewer' })).toBeVisible();
  releaseMetrics();
  await Promise.all(pendingRoutes);
  await page.unroute('**/assets/MetricsView-*.js');
  let releaseMemory;
  const memoryGate = new Promise((resolve) => {
    releaseMemory = resolve;
  });
  releaseRoutes.push(releaseMemory);
  await page.route('**/api/runtime/memory?workspace=default', (route) => {
    const pending = memoryGate.then(() => route.continue());
    pendingRoutes.push(pending);
    return pending;
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Metrics', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Loading metrics' })).toBeVisible();
  releaseMemory();
  await Promise.all(pendingRoutes);
  await page.unroute('**/api/runtime/memory?workspace=default');
  await expect(page.getByRole('heading', { name: 'Memory usage', exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await request('/runtime/memory')).services.find((s) => s.name === 'Browser API')
          ?.memoryBytes ?? 0,
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole('img', { name: /All managed services over time/ })).toBeVisible({
    timeout: 10000,
  });
  await page.screenshot({ path: '.devloom/artifacts/verified-memory.png' });
  await page.getByRole('button', { name: 'Application metrics', exact: true }).click();
  await expect(page.getByRole('button', { name: /checkout.duration/ })).toBeVisible();
  await page.getByRole('button', { name: /checkout.duration/ }).click();
  await expect(page.locator('.app-metric-panel')).toContainText('Checkout example');
  await page.screenshot({ path: '.devloom/artifacts/verified-metrics.png' });
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Services/ })
    .click();
  await page.getByRole('button', { name: 'Browser API', exact: true }).click();
  await page
    .locator('.service-drawer')
    .getByRole('button', { name: 'Stop Browser API', exact: true })
    .click();
  await expect(page.locator('.drawer-header .status-badge')).toHaveText('stopped');
  await page.getByRole('button', { name: 'Edit configuration', exact: true }).click();
  await expect(page.locator('dialog').getByLabel('Service name', { exact: true })).toHaveValue(
    'Browser API',
  );
  await page.locator('dialog').getByLabel('Service name', { exact: true }).fill('Renamed API');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.drawer-header')).toContainText('Renamed API');
  await page.getByRole('button', { name: 'Remove Renamed API', exact: true }).click();
  await page.locator('dialog').getByRole('button', { name: 'Remove service', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Renamed API', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Search services').fill('Additional 1');
  await expect(page.locator('.process-table tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: 'Clear search services' }).click();
  await expect(page.locator('.process-table tbody tr')).toHaveCount(14);
  await page.screenshot({ path: '.devloom/artifacts/light-neutral-text.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    'PASS: pending tab/data/chunk loading, navigation during delayed requests, loading error recovery, folder browse/search/navigation/error recovery/nested Escape/selection, project create/rename/switch/delete, persisted selection and browser isolation, service CRUD, real lifecycle + health + logs, filters, drawer click-away/Escape/full-width, independently scrolling table, desktop/mobile viewport, 3-size typography, live trace waterfall, metrics, persisted light/dark mode, custom dropdown keyboard/form behavior, reusable search clear/Escape, zero browser errors and zero external requests.',
  );
} finally {
  for (const release of releaseRoutes) release();
  await Promise.allSettled(pendingRoutes);
  await browser?.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 6000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  rmSync(dataDir, { recursive: true, force: true });
}
