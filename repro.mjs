import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';

const exporter = new InMemorySpanExporter();
const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });

assert.equal(context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable()), true);
assert.equal(trace.setGlobalTracerProvider(provider), true);

const app = Fastify();

try {
  await app.register(new FastifyOtelInstrumentation().plugin());

  // No route-level error is thrown. Fastify itself rejects this request because
  // it has no parser for application/octet-stream.
  app.post('/upload', async () => ({ ok: true }));

  const response = await app.inject({
    method: 'POST',
    url: '/upload',
    headers: { 'content-type': 'application/octet-stream' },
    payload: 'payload',
  });

  await provider.forceFlush();

  const requestSpan = exporter.getFinishedSpans().find(
    (span) => span.kind === SpanKind.SERVER && span.attributes['http.route'] === '/upload',
  );
  assert.ok(requestSpan, 'Fastify request span was exported');

  const exceptionEvents = requestSpan.events.filter((event) => event.name === 'exception');

  console.log(
    JSON.stringify(
      {
        responseStatus: response.statusCode,
        spanStatus: requestSpan.status.code,
        spanStatusIsError: requestSpan.status.code === SpanStatusCode.ERROR,
        exceptionEvents: exceptionEvents.length,
      },
      null,
      2,
    ),
  );

  // Current behavior under reproduction: the 415 is recorded as an error.
  assert.equal(response.statusCode, 415);
  assert.equal(requestSpan.status.code, SpanStatusCode.ERROR);
  assert.equal(exceptionEvents.length, 1);
} finally {
  await app.close();
  await provider.shutdown();
  context.disable();
  trace.disable();
}
