import "server-only";

type LogPrimitive = string | number | boolean | null | undefined;
type LogContext = Record<string, LogPrimitive | LogPrimitive[]>;

function errorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return { message: String(error) };
}

function write(level: "info" | "warn" | "error", event: string, context?: LogContext) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const serverLogger = {
  info(event: string, context?: LogContext) {
    write("info", event, context);
  },

  warn(event: string, context?: LogContext) {
    write("warn", event, context);
  },

  error(event: string, error: unknown, context?: LogContext) {
    write("error", event, { ...context, error: JSON.stringify(errorPayload(error)) });
  },

  timing(event: string, startedAt: number, context?: LogContext, slowThresholdMs = 750) {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= slowThresholdMs) {
      write("warn", event, { ...context, durationMs });
    }
  },
};
