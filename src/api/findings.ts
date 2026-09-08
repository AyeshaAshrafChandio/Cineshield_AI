import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { uuidSchema, rewriteRequestSchema } from '../lib/validation/schemas';
import { repository } from '../db/repository';
import { creativeRewriteAgent } from '../lib/agents/creativeRewriteAgent';
import { ValidationError, NotFoundError } from '../lib/errors/AppError';
import { authorizeFinding } from '../lib/security/auth';

const router = Router();

/**
 * POST /api/findings/:id/rewrite
 * Generate 3 clearance-safe creative script alternatives using Gemini Creative Rewrite Agent
 */
router.post('/:id/rewrite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idResult = uuidSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid finding ID format.');
    }
    const findingId = idResult.data;

    await authorizeFinding(req, findingId);

    const bodyResult = rewriteRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      const errorMsg = bodyResult.error.issues.map((e) => e.message).join(', ');
      throw new ValidationError(`Invalid rewrite request body: ${errorMsg}`);
    }

    const finding = await repository.getFinding(findingId);
    if (!finding) {
      throw new NotFoundError('Risk Finding', findingId);
    }

    // Call real Gemini Creative Rewrite Agent
    const rewriteResult = await creativeRewriteAgent.generateRewrites({
      findingId,
      originalText: finding.description || finding.title,
      entityName: finding.title,
      riskCategory: finding.category,
      sceneHeading: finding.sceneId || 'Current Scene',
      userPrompt: bodyResult.data.userPrompt || bodyResult.data.prompt,
    });

    // Persist alternatives to repository
    for (const alt of rewriteResult.alternatives) {
      await repository.saveRewrite({
        id: randomUUID(),
        findingId,
        originalText: finding.description || finding.title,
        suggestedText: alt.text,
        rationale: alt.explanation,
        status: 'suggested',
      });
    }

    res.json({
      success: true,
      findingId: rewriteResult.findingId,
      originalText: rewriteResult.originalText,
      alternatives: rewriteResult.alternatives,
      disclaimer: rewriteResult.disclaimer,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/findings/:id/rewrites
 * Retrieve persisted rewrites for a specific finding
 */
router.get('/:id/rewrites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idResult = uuidSchema.safeParse(req.params.id);
    if (!idResult.success) {
      throw new ValidationError('Invalid finding ID format.');
    }
    const findingId = idResult.data;

    await authorizeFinding(req, findingId);

    const finding = await repository.getFinding(findingId);
    if (!finding) {
      throw new NotFoundError('Risk Finding', findingId);
    }

    const rewritesList = await repository.getRewrites(findingId);

    res.json({
      success: true,
      findingId,
      rewrites: rewritesList,
      total: rewritesList.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

