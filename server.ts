import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { apiRouter, errorHandler } from './src/api/routes';
import { createRateLimiter } from './src/lib/security/rateLimiter';
import { authMiddleware } from './src/lib/security/auth';
import { requestLoggerMiddleware, logger } from './src/lib/observability/logger';
import { isDatabaseConfigured, closePool } from './src/db/index';
import { runMigrations } from './src/db/migrate';

dotenv.config();

export async function createApp() {
  const app = express();

  // Basic security and parsing middlewares
  app.disable('x-powered-by');

  // Hardened security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Request correlation and structured logging
  app.use(requestLoggerMiddleware);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Tenant / user resolution middleware
  app.use(authMiddleware);

  // Rate limiter for upload and write endpoints (max 100 requests per 15 mins)
  const apiLimiter = createRateLimiter({
    maxRequests: 100,
    windowMs: 15 * 60 * 1000,
  });
  app.use('/api/scripts/upload', apiLimiter);
  app.use('/api/analysis/start', apiLimiter);

  // Mount microservice API router
  app.use('/api', apiRouter);

  // Mount API error handler immediately after API routes
  app.use('/api', errorHandler);

  // Vite integration (Development middleware or Production static files)
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const PORT = 3000;

  // Run automated database migrations on startup if PostgreSQL is configured
  if (isDatabaseConfigured()) {
    try {
      await runMigrations();
    } catch (migErr) {
      logger.error('Startup migration execution error:', migErr);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }

  const app = await createApp();

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`CineShield AI server running on http://0.0.0.0:${PORT}`, {
      meta: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT,
        databaseConfigured: isDatabaseConfigured(),
      },
    });
  });

  // Graceful shutdown handling for Cloud Run SIGTERM signals
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await closePool();
        logger.info('Database pool drained and closed.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during database pool cleanup:', err);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if connections fail to drain
    setTimeout(() => {
      logger.warn('Forcefully terminating process after 10s shutdown timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start only if run directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start CineShield AI server:', err);
    process.exit(1);
  });
}
