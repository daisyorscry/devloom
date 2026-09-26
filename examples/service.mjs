import { createServer } from 'node:http';
import { instrument } from './instrumentation.mjs';

const [name = 'Example service', port] = process.argv.slice(2);
const { tracer, meter, shutdown } = instrument(name);
const requests = meter.createCounter('devloom.example.requests', {
  description: 'Requests handled by this example service',
  unit: '{request}',
});
const jobs = meter.createCounter('devloom.example.jobs', {
  description: 'Example heartbeat / job cycles completed',
  unit: '{job}',
});
const duration = meter.createHistogram('devloom.example.request.duration', {
  description: 'Time spent handling HTTP requests',
  unit: 'ms',
});
meter
  .createObservableGauge('process.memory.heap.used', {
    description: 'Actual Node.js heap memory usage',
    unit: 'By',
  })
  .addCallback((result) => result.observe(process.memoryUsage().heapUsed));
let count = 0;
console.log(`${name} initialized · example workspace · OpenTelemetry enabled`);
const server = port
  ? createServer((req, res) => {
      tracer.startActiveSpan(`${req.method} ${req.url}`, (span) => {
        const started = performance.now();
        span.setAttributes({
          'http.request.method': req.method,
          'url.path': req.url,
          'http.response.status_code': 200,
        });
        requests.add(1, { route: req.url, method: req.method });
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            service: name,
            status: 'ok',
            uptime: process.uptime(),
          }),
        );
        res.on('finish', () => {
          duration.record(performance.now() - started, { route: req.url });
          span.end();
        });
        console.log(`${req.method} ${req.url} 200`);
      });
    }).listen(Number(port), '127.0.0.1', () => console.log(`Listening on http://127.0.0.1:${port}`))
  : undefined;
const timer = setInterval(() => {
  tracer.startActiveSpan(port ? 'heartbeat' : 'process job', (span) => {
    count++;
    jobs.add(1);
    span.setAttribute('example.cycle', count);
    console.log(
      port ? `Heartbeat ${count} · accepting requests` : `Job ${count} completed · queue is clear`,
    );
    if (count % 12 === 0) console.error('Example warning · retry succeeded, no action needed');
    span.end();
  });
}, 6000);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  console.log('Shutting down gracefully');
  if (server) await new Promise((resolve) => server.close(resolve));
  await shutdown();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
