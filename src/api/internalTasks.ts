import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { agentOrchestrator } from '../lib/agents/orchestrator';
import { logger } from '../lib/observability/logger';

const router = Router();

const internalTaskSchema = z.object({
  analysisId: z.string().uuid(),
  tenantUserId: z.string().min(1),
});

/**
 * POST /api/internal/tasks/analysis
 * Invoked by Google Cloud Tasks to execute asynchronous analysis worker tasks.
 */
router.post('/analysis', async (req: Request, res: Response) => {
  const expectedSecret = process.env.INTERNAL_TASK_SECRET;
  if (expectedSecret) {
    const receivedSecret = req.headers['x-internal-task-secret'];
    if (receivedSecret !== expectedSecret) {
      logger.warn('Unauthorized Cloud Tasks worker request rejected');
      return res.status(403).json({ error: 'Unauthorized internal worker request' });
    }
  }

  const parseResult = internalTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    logger.warn('Invalid Cloud Tasks payload', {
      meta: { issues: parseResult.error.issues },
    });
    return res.status(400).json({ error: 'Invalid task payload' });
  }

  const { analysisId, tenantUserId } = parseResult.data;

  logger.info('Starting Cloud Tasks worker execution for analysis', {
    analysisId,
    userId: tenantUserId,
  });

  try {
    await agentOrchestrator.runAnalysis(analysisId, tenantUserId);
    logger.info('Completed Cloud Tasks worker execution for analysis', {
      analysisId,
      userId: tenantUserId,
    });
    return res.status(200).json({ success: true, analysisId });
  } catch (err) {
    logger.error('Cloud Tasks worker failed to execute analysis', err, {
      analysisId,
      userId: tenantUserId,
    });
    // Returning 500 signals Cloud Tasks to retry according to queue configuration
    return res.status(500).json({ error: 'Task processing failed' });
  }
});

export default router;
