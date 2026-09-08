import { Router, Request, Response, NextFunction } from 'express';
import scriptsRouter from './scripts';
import analysisRouter from './analysis';
import projectsRouter from './projects';
import findingsRouter from './findings';
import reportsRouter from './reports';
import { AppError } from '../lib/errors/AppError';
import { isDatabaseConfigured } from '../db/index';

export const apiRouter = Router();

// Health check endpoint (Liveness probe for Cloud Run)
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'cineshield-backend',
    databaseConfigured: isDatabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check endpoint (Readiness probe for Cloud Run)
apiRouter.get('/ready', async (_req: Request, res: Response) => {
  const dbOk = isDatabaseConfigured();
  // Check Gemini config
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  const isReady = process.env.NODE_ENV === 'production' ? dbOk && geminiConfigured : true;

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'cineshield-backend',
    checks: {
      database: dbOk ? 'healthy' : (process.env.NODE_ENV === 'production' ? 'missing' : 'offline_fallback'),
      gemini: geminiConfigured ? 'configured' : 'missing_key',
    },
    timestamp: new Date().toISOString(),
  });
});

// Non-sensitive system status endpoint
apiRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    service: 'cineshield-backend',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// Mount microservice API modules
apiRouter.use('/scripts', scriptsRouter);
apiRouter.use('/analysis', analysisRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/findings', findingsRouter);
apiRouter.use('/reports', reportsRouter);

// Centralized error handling middleware for all /api routes
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Never leak internal stack traces to the user
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle generic error safely
  const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
  console.error('Unhandled server error in API:', message);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred. Please try again later.',
    },
  });
}
