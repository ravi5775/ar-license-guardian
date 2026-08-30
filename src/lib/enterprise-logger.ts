/**
 * ============================================================================
 * AETHER AR — ENTERPRISE STRUCTURED LOGGER & OBSERVABILITY
 * ============================================================================
 *
 * Provides structured JSON logging with Request ID correlation, automatic
 * sensitive data redaction (passwords, tokens, private keys), and user-safe
 * error normalization.
 * ============================================================================
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "key",
  "service_role",
  "private_key",
  "pin_hash",
  "device_secret",
  "cookie",
]);

/**
 * Recursively masks sensitive fields in metadata before logging.
 */
export function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some((s) => lowerKey.includes(s));

    if (isSensitive && typeof value === "string") {
      sanitized[key] = value.length > 8 ? `${value.slice(0, 3)}***${value.slice(-3)}` : "********";
    } else if (typeof value === "object") {
      sanitized[key] = maskSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class EnterpriseLogger {
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || crypto.randomUUID();
  }

  private emit(level: LogLevel, event: string, metadata?: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      event,
      meta: metadata ? maskSensitiveData(metadata) : undefined,
    };

    if (level === "error") {
      console.error(JSON.stringify(logEntry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  info(event: string, meta?: Record<string, any>) {
    this.emit("info", event, meta);
  }

  warn(event: string, meta?: Record<string, any>) {
    this.emit("warn", event, meta);
  }

  error(event: string, error?: Error | unknown, meta?: Record<string, any>) {
    const errMeta =
      error instanceof Error
        ? { message: error.message, stack: error.stack, ...meta }
        : { rawError: String(error), ...meta };
    this.emit("error", event, errMeta);
  }
  static forRequest(requestId?: string | Request): EnterpriseLogger {
    if (requestId instanceof Request) {
      return new EnterpriseLogger(getRequestId(requestId));
    }
    return new EnterpriseLogger(requestId);
  }
}

/** Extracts or generates a correlation ID from standard headers (Cloudflare Ray, X-Request-ID, Traceparent). */
export function getRequestId(request?: Request): string {
  if (!request) return crypto.randomUUID();
  return (
    request.headers.get("x-request-id") ||
    request.headers.get("cf-ray") ||
    request.headers.get("traceparent") ||
    crypto.randomUUID()
  );
}

/** Global default logger instance */
export const logger = new EnterpriseLogger();

/**
 * Normalizes internal errors into safe, client-facing JSON messages.
 */
export function normalizeUserError(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof Error) {
    // Known user-safe messages
    if (
      error.message.includes("PIN") ||
      error.message.includes("limit") ||
      error.message.includes("Unauthorized")
    ) {
      return { ok: false, error: error.message };
    }
    logger.error("internal_unhandled_error", error);
    return { ok: false, error: "An unexpected error occurred. Please try again later." };
  }
  return { ok: false, error: "Bad request" };
}
