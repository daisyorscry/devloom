import { instrument } from './instrumentation.mjs';
const { tracer, meter, shutdown } = instrument(process.env.OTEL_SERVICE_NAME || 'Checkout example');
const requests = meter.createCounter('checkout.requests', {
  description: 'Checkout example executions',
  unit: '{request}',
});
const duration = meter.createHistogram('checkout.duration', {
  description: 'Elapsed time in the example checkout operation',
  unit: 'ms',
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await tracer.startActiveSpan('POST /checkout', async (root) => {
  const start = performance.now();
  root.setAttributes({
    'http.request.method': 'POST',
    'url.path': '/checkout',
    example: true,
  });
  for (const [name, milliseconds] of [
    ['validate cart', 12],
    ['reserve inventory', 25],
    ['payment sandbox', 45],
  ]) {
    await tracer.startActiveSpan(name, async (span) => {
      await delay(milliseconds);
      span.setAttribute('example.workload', true);
      span.end();
    });
  }
  requests.add(1, { route: '/checkout' });
  duration.record(performance.now() - start, { route: '/checkout' });
  root.end();
});
await shutdown();
console.log('Exported one example checkout trace and two metrics to Devloom.');
