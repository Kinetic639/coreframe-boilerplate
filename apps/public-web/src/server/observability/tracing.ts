import "server-only";

import { randomUUID } from "crypto";
import { serverLogger } from "./logger";

type SpanAttributes = Record<string, string | number | boolean | null | undefined>;

interface SpanResult {
  traceId: string;
  spanId: string;
  durationMs: number;
}

async function forwardSpan(
  name: string,
  result: SpanResult,
  attributes: SpanAttributes,
  status: "ok" | "error"
) {
  const endpoint = process.env.OTEL_HTTP_ENDPOINT ?? process.env.APM_HTTP_ENDPOINT;
  if (!endpoint) return;

  const body = {
    resource: {
      serviceName: process.env.OTEL_SERVICE_NAME ?? "ambra-web",
      environment: process.env.NODE_ENV ?? "development",
    },
    spans: [
      {
        name,
        traceId: result.traceId,
        spanId: result.spanId,
        durationMs: result.durationMs,
        status,
        attributes,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.APM_HTTP_API_KEY
          ? { authorization: `Bearer ${process.env.APM_HTTP_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch (error) {
    serverLogger.warn("observability.span_forward.failed", {
      spanName: name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function withServerSpan<T>(
  name: string,
  attributes: SpanAttributes,
  operation: (span: { traceId: string; spanId: string }) => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  const span = {
    traceId: randomUUID(),
    spanId: randomUUID(),
  };

  try {
    const value = await operation(span);
    const result = { ...span, durationMs: Date.now() - startedAt };
    serverLogger.info("observability.span", {
      spanName: name,
      traceId: result.traceId,
      spanId: result.spanId,
      durationMs: result.durationMs,
      status: "ok",
      ...attributes,
    });
    await forwardSpan(name, result, attributes, "ok");
    return value;
  } catch (error) {
    const result = { ...span, durationMs: Date.now() - startedAt };
    serverLogger.error("observability.span", error, {
      spanName: name,
      traceId: result.traceId,
      spanId: result.spanId,
      durationMs: result.durationMs,
      status: "error",
      ...attributes,
    });
    await forwardSpan(name, result, attributes, "error");
    throw error;
  }
}
