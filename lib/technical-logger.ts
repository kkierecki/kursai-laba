import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type TechnicalLogLevel = "INFO" | "WARN" | "ERROR";

const logDirectory = path.join(process.cwd(), "logs");
const logFilePath = path.join(logDirectory, "technical.log");
const maxValueLength = 4000;

let writeQueue: Promise<void> = Promise.resolve();

function redactSecrets(text: string) {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(
      /(authorization|api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^,\s"']+/gi,
      "$1=[REDACTED]",
    )
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
}

function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const redacted = redactSecrets(value);
    return redacted.length > maxValueLength
      ? `${redacted.slice(0, maxValueLength)}…[TRUNCATED]`
      : redacted;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return `[${typeof value}]`;
  }

  if (depth >= 4) {
    return "[MAX_DEPTH]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogValue(value.message, seen, depth + 1),
      stack: sanitizeLogValue(value.stack, seen, depth + 1),
      cause: sanitizeLogValue(value.cause, seen, depth + 1),
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value
        .slice(0, 40)
        .map((entry) => sanitizeLogValue(entry, seen, depth + 1));
    }

    const record: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value).slice(0, 40)) {
      if (
        /^(api[_-]?key|authorization|cookie|password|secret|token|accessToken|refreshToken)$/i.test(
          key,
        )
      ) {
        record[key] = "[REDACTED]";
      } else {
        record[key] = sanitizeLogValue(entry, seen, depth + 1);
      }
    }

    return record;
  }

  return String(value);
}

export function createRequestId() {
  return randomUUID();
}

export function summarizeMessages(messages: unknown) {
  if (!Array.isArray(messages)) {
    return { type: typeof messages, count: 0 };
  }

  const roles: string[] = [];
  const partTypes: string[] = [];
  let lastUserTextLength = 0;
  let hasAttachment = false;

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const entry = message as Record<string, unknown>;
    if (typeof entry.role === "string") {
      roles.push(entry.role);
    }

    if (!Array.isArray(entry.parts)) {
      continue;
    }

    let userTextLength = 0;
    for (const part of entry.parts) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const partEntry = part as Record<string, unknown>;
      if (typeof partEntry.type === "string") {
        partTypes.push(partEntry.type);
        hasAttachment ||= partEntry.type === "file";
      }

      if (partEntry.type === "text" && typeof partEntry.text === "string") {
        userTextLength += partEntry.text.length;
      }
    }

    if (entry.role === "user") {
      lastUserTextLength = userTextLength;
    }
  }

  return {
    count: messages.length,
    roles,
    partTypes: [...new Set(partTypes)],
    lastUserTextLength,
    hasAttachment,
  };
}

export function logTechnical(
  level: TechnicalLogLevel,
  event: string,
  details: Record<string, unknown> = {},
) {
  const sanitizedDetails = sanitizeLogValue(details);
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    pid: process.pid,
    ...(sanitizedDetails as Record<string, unknown>),
  } as Record<string, unknown>;

  const line = `${JSON.stringify(record)}\n`;

  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(logDirectory, { recursive: true });
      await appendFile(logFilePath, line, "utf8");
    });

  void writeQueue.catch((error: unknown) => {
    console.error(
      "Technical logger failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  });

  return writeQueue;
}

export function beginTechnicalRequest(
  request: Request,
  route: string,
  details: Record<string, unknown> = {},
) {
  const requestId = request.headers.get("x-request-id") || createRequestId();
  const startedAt = Date.now();
  const baseDetails = {
    requestId,
    route,
    method: request.method,
    ...details,
  };

  void logTechnical("INFO", "api.request.start", baseDetails);

  return {
    requestId,
    finish(status: number, responseDetails: Record<string, unknown> = {}) {
      return logTechnical("INFO", "api.response.created", {
        ...baseDetails,
        status,
        durationMs: Date.now() - startedAt,
        ...responseDetails,
      });
    },
    fail(error: unknown, errorDetails: Record<string, unknown> = {}) {
      return logTechnical("ERROR", "api.request.error", {
        ...baseDetails,
        durationMs: Date.now() - startedAt,
        error,
        ...errorDetails,
      });
    },
  };
}

export function getTechnicalLogPath() {
  return logFilePath;
}
