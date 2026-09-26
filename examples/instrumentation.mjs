import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { trace, metrics } from '@opentelemetry/api';

export function instrument(serviceName) {
  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://127.0.0.1:4318').replace(
    /\/$/,
    '',
  );
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.version': '0.1.0',
      'deployment.environment.name': 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 3000,
    }),
  });
  sdk.start();
  return {
    tracer: trace.getTracer('devloom-example'),
    meter: metrics.getMeter('devloom-example'),
    shutdown: () => sdk.shutdown(),
  };
}
