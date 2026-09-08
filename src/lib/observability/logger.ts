import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface StructuredLogPayload {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  requestId?: string;
  analysisId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  modelCalls?: number;
  errorCode?: string;
  meta?: Record<string, unknown>;
}

// Redaction patterns for secrets and sensitive tokens
const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /authorization/i,
  /auth/i,
  /cookie/i,
  /database_url/i,
  /credential/i,
];

export function sanitizeLogMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepth]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact bearer tokens or API key patterns in strings
    if (/bearer\s+[a-zA-Z0-9_\-.]+/i.test(obj)) {
      return obj.replace(/bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]');
    }
    if (obj.length > 500) {
      return `${obj.substring(0, 100)}... [TRUNCATED_${obj.length}_CHARS]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogMetadata(val, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

class StructuredLogger {
  private formatLog(payload: StructuredLogPayload): string {
    const sanitizedMeta = payload.meta ? (sanitizeLogMetadata(payload.meta) as Record<string, unknown>) : undefined;
    const cleanPayload: StructuredLogPayload = {
      ...payload,
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
    };

    // Output valid single-line JSON format required by Google Cloud Logging
    return JSON.stringify(cleanPayload);
  }

  info(message: string, context: Partial<StructuredLogPayload> = {}): void {
    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'cineshield-backend',
      message,
      ...context,
    };
    console.log(this.formatLog(payload));
  }

  warn(message: string, context: Partial<StructuredLogPayload> = {}): void {
    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      service: 'cineshield-backend',
      message,
      ...context,
    };
    console.warn(this.formatLog(payload));
  }

  error(message: string, error?: unknown, context: Partial<StructuredLogPayload> = {}): void {
    const errorDetails =
      error instanceof Error
        ? { errorMessage: error.message, errorName: error.name }
        : { rawError: String(error) };

    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'cineshield-backend',
      message,
      meta: {
        ...errorDetails,
        ...(context.meta || {}),
      },
      ...context,
    };
    console.error(this.formatLog(payload));
  }

  debug(message: string, context: Partial<StructuredLogPayload> = {}): void {
    if (process.env.NODE_ENV === 'production' && !process.env.DEBUG) return;

    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      service: 'cineshield-backend',
      message,
      ...context,
    };
    console.log(this.formatLog(payload));
  }
}

export const logger = new StructuredLogger();

/**
 * Express HTTP request logging middleware with Cloud Trace / correlation ID support
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || (req.headers['x-cloud-trace-context'] as string) || randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const isError = res.statusCode >= 400;

    const logMethod = isError ? (res.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger)) : logger.info.bind(logger);

    logMethod(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`, {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: (req as any).user?.id,
      analysisId: req.params?.id || (req.body && req.body.analysisId),
    });
  });

  next();
}
