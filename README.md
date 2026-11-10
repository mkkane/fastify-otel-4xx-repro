# Fastify OTel 4xx reproduction

Minimal reproduction of `@fastify/otel` marking a Fastify-generated 4xx response as a request-span error.

## Requirements

- Node.js `>=22.15.0`
- npm

The dependency versions are pinned to `@fastify/otel` 1.0.1, Fastify 5.12.8 and the OpenTelemetry versions used when reproducing the behavior.

## Run

```sh
npm ci
npm run repro
```

The script sends a `POST /upload` request with `Content-Type: application/octet-stream`. Fastify rejects the unsupported media type with 415 before the route handler runs. The script captures the request span with an in-memory exporter.

## Current output

```json
{
  "responseStatus": 415,
  "spanStatus": 2,
  "spanStatusIsError": true,
  "exceptionEvents": 1
}
```

`SpanStatusCode.ERROR` is `2`. For an HTTP server span with a 4xx response, the OpenTelemetry HTTP semantic conventions say the span status should remain unset: <https://opentelemetry.io/docs/specs/semconv/http/http-spans/#status>.
