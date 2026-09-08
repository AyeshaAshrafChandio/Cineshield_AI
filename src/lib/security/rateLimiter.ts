import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const requestCounts = new Map<string, RateLimitRecord>();

// Periodically clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function createRateLimiter(options: { maxRequests: number; windowMs: number }) {
  const { maxRequests, windowMs } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, bypass rate limiting
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const userId = (req as any).user?.id;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = userId ? `usr:${userId}` : `ip:${ip}`;
    const now = Date.now();

    let record = requestCounts.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      requestCounts.set(key, record);

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please wait ${retryAfterSec} seconds before retrying.`,
        },
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000).toString());

    next();
  };
}

/**
 * Concurrency limiter to cap simultaneous active analyses per tenant/user
 */
const activeAnalyses = new Map<string, number>();

export function acquireAnalysisSlot(userId: string, maxConcurrent = 2): boolean {
  const current = activeAnalyses.get(userId) || 0;
  if (current >= maxConcurrent) {
    return false;
  }
  activeAnalyses.set(userId, current + 1);
  return true;
}

export function releaseAnalysisSlot(userId: string): void {
  const current = activeAnalyses.get(userId) || 0;
  if (current <= 1) {
    activeAnalyses.delete(userId);
  } else {
    activeAnalyses.set(userId, current - 1);
  }
}

