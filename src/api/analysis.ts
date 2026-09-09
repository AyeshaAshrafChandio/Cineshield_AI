import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { startAnalysisSchema, uuidSchema } from '../lib/validation/schemas';
import { repository, StoredReport } from '../db/repository';
import { tempStore } from '../lib/storage/tempStore';
import { agentOrchestrator } from '../lib/agents/orchestrator';
import { cloudTasksService } from '../lib/tasks/cloudTasks';
import {
  NotFoundError,
  ValidationError,
  ConcurrencyLimitError,
} from '../lib/errors/AppError';
import {
  authorizeScript,
  authorizeAnalysis,
} from '../lib/security/auth';
import {
  acquireAnalysisSlot,
  releaseAnalysisSlot,
} from '../lib/security/rateLimiter';
import {
  StartAnalysisResponse,
  AnalysisStatusResponse,
  FindingsResponse,
  ScreenplayDataResponse,
} from '../types/api';

const router = Router();

/**
 * POST /api/analysis/start
 * Initialize an asynchronous screenplay analysis run and trigger multi-agent pipeline
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  let slotAcquired = false;
  let tenantUserId = '';

  try {
    const parseResult = startAnalysisSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((e) => e.message).join(', ');
      throw new ValidationError(`Invalid request body: ${errorMsg}`);
    }

    const { scriptId } = parseResult.data;

    // Server-side multi-tenant authorization check
    await authorizeScript(req, scriptId);

    // Verify that the script exists in the repository
    const script = await repository.getScript(scriptId);
    if (!script) {
      throw new NotFoundError('Script', scriptId);
    }

    tenantUserId = req.user?.id || 'default-user';

    // Check concurrency limit per user
    if (!acquireAnalysisSlot(tenantUserId, 2)) {
      throw new ConcurrencyLimitError(
        'Maximum concurrent analysis limit reached (2 active). Please wait for an existing analysis to finish.'
      );
    }
    slotAcquired = true;

    // Check for an already active in-flight run for this project to ensure idempotency
    const existingRun = await repository.getLatestAnalysisForProject(script.projectId);
    if (existingRun && existingRun.status !== 'complete' && existingRun.status !== 'failed') {
      if (slotAcquired) releaseAnalysisSlot(tenantUserId);
      const response: StartAnalysisResponse = {
        success: true,
        analysisId: existingRun.id,
        status: existingRun.status,
      };
      return res.status(200).json(response);
    }

    // Generate real unique analysis ID
    const analysisId = randomUUID();
    const now = new Date().toISOString();

    // Create real analysis run record in initial "queued" state
    await repository.saveAnalysisRun({
      id: analysisId,
      scriptId: script.id,
      projectId: script.projectId,
      status: 'queued',
      progress: 0,
      stageMessage: 'Analysis queued for processing',
      createdAt: now,
      updatedAt: now,
    });

    // Launch multi-agent pipeline asynchronously via Cloud Tasks or resilient worker queue
    await cloudTasksService.enqueueAnalysisTask({ analysisId, tenantUserId });

    const response: StartAnalysisResponse = {
      success: true,
      analysisId,
      status: 'queued',
    };

    res.status(201).json(response);
  } catch (error) {
    if (slotAcquired && tenantUserId) {
      releaseAnalysisSlot(tenantUserId);
    }
    next(error);
  }
});

/**
 * GET /api/analysis/:id and GET /api/analysis/:id/status
 * Retrieve real-time backend state of an analysis run
 */
const getAnalysisStatusHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    const findings = await repository.getFindings(analysisId);

    const response: AnalysisStatusResponse = {
      success: true,
      analysisId: run.id,
      scriptId: run.scriptId,
      projectId: run.projectId,
      status: run.status,
      progress: run.progress,
      stageMessage: run.stageMessage,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      completedAt: run.completedAt,
      errorMessage: run.errorMessage,
      findingsCount: findings.length,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.get('/:id', getAnalysisStatusHandler);
router.get('/:id/status', getAnalysisStatusHandler);

/**
 * GET /api/analysis/:id/stream
 * Server-Sent Events (SSE) stream for real-time progress updates without client polling
 */
router.get('/:id/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
    res.flushHeaders?.();

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ status: run.status, progress: run.progress, stageMessage: run.stageMessage })}\n\n`);

    if (run.status === 'complete' || run.status === 'failed') {
      return res.end();
    }

    const progressListener = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (data.status === 'complete' || data.status === 'failed') {
        cleanup();
        res.end();
      }
    };

    const cleanup = () => {
      agentOrchestrator.removeListener(`progress:${analysisId}`, progressListener);
    };

    agentOrchestrator.on(`progress:${analysisId}`, progressListener);

    req.on('close', () => {
      cleanup();
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis/:id/findings
 * Retrieve real risk findings stored for an analysis run
 */
router.get('/:id/findings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    const findingsList = await repository.getFindings(analysisId);

    const response: FindingsResponse = {
      success: true,
      analysisId,
      findings: findingsList,
      total: findingsList.length,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis/:id/evidence
 * Retrieve partner clearance evidence stored for an analysis run
 */
router.get('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    const evidenceList = await repository.getEvidence(analysisId);

    res.json({
      success: true,
      analysisId,
      evidence: evidenceList,
      total: evidenceList.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis/:id/entities
 * Retrieve detected entities (characters, locations, brands, props) for an analysis run
 */
router.get('/:id/entities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    const entitiesList = await repository.getEntities(analysisId);

    res.json({
      success: true,
      analysisId,
      entities: entitiesList,
      total: entitiesList.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis/:id/report
 * Retrieve comprehensive clearance assessment report
 */
router.get('/:id/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    const projectReports = await repository.getReportsByProject(run.projectId);
    const matchingReport = projectReports.find((r) => r.analysisId === analysisId) || projectReports[0];

    if (!matchingReport) {
      throw new NotFoundError('Report for analysis', analysisId);
    }

    res.json({
      success: true,
      report: matchingReport,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis/:id/screenplay
 * Retrieve normalized screenplay data associated with this analysis run
 */
router.get('/:id/screenplay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid analysis ID format.');
    }
    const analysisId = parseResult.data;

    await authorizeAnalysis(req, analysisId);

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new NotFoundError('Analysis', analysisId);
    }

    const screenplay = await repository.getScreenplay(run.scriptId);
    if (!screenplay) {
      throw new NotFoundError('Screenplay data for script', run.scriptId);
    }

    const response: ScreenplayDataResponse = {
      success: true,
      scriptId: run.scriptId,
      title: screenplay.title,
      scenes: screenplay.scenes,
      metadata: screenplay.metadata,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
