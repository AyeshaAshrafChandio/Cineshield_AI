import { Router, Request, Response, NextFunction } from 'express';
import { uuidSchema } from '../lib/validation/schemas';
import { repository } from '../db/repository';
import { tempStore } from '../lib/storage/tempStore';
import { NotFoundError, ValidationError } from '../lib/errors/AppError';
import { authorizeProject } from '../lib/security/auth';
import { dataLifecycleManager } from '../lib/storage/cleanupService';
import { ProjectInfoResponse, ScreenplayDataResponse } from '../types/api';

const router = Router();

/**
 * GET /api/projects/:id
 * Retrieve real project details, script information, and analysis status
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid project ID format.');
    }
    const projectId = parseResult.data;

    await authorizeProject(req, projectId);

    const project = await repository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    const script = await repository.getScriptByProject(projectId);
    const latestAnalysis = await repository.getLatestAnalysisForProject(projectId);

    let findingsSummary = null;
    if (latestAnalysis && latestAnalysis.status === 'complete') {
      const findings = await repository.getFindings(latestAnalysis.id);
      const high = findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length;
      const medium = findings.filter((f) => f.severity === 'medium').length;
      const low = findings.filter((f) => f.severity === 'low').length;
      findingsSummary = {
        high,
        medium,
        low,
        total: findings.length,
      };
    }

    const response: ProjectInfoResponse = {
      success: true,
      project: {
        id: project.id,
        title: project.title,
        script: {
          id: script?.id || '',
          fileName: script?.fileName || '',
          fileType: script?.fileType || '',
          title: script?.title || project.title,
          uploadedAt: script?.uploadedAt || project.createdAt,
        },
        uploadTimestamp: project.createdAt,
        analysisStatus: latestAnalysis?.status || null,
        latestAnalysisId: latestAnalysis?.id || null,
        overallRiskScore: latestAnalysis?.overallRiskScore ?? null,
        findingsSummary,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id/screenplay
 * Retrieve normalized screenplay data associated with this project
 */
router.get('/:id/screenplay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid project ID format.');
    }
    const projectId = parseResult.data;

    await authorizeProject(req, projectId);

    const project = await repository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    const script = await repository.getScriptByProject(projectId);
    if (!script) {
      throw new NotFoundError('Script for project', projectId);
    }

    const screenplay = tempStore.getScreenplay(script.id);
    if (!screenplay) {
      throw new NotFoundError('Screenplay data for script', script.id);
    }

    const response: ScreenplayDataResponse = {
      success: true,
      scriptId: script.id,
      title: screenplay.title,
      scenes: screenplay.scenes,
      metadata: screenplay.metadata,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id/reports
 * Retrieve compliance reports generated for this project
 */
router.get('/:id/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid project ID format.');
    }
    const projectId = parseResult.data;

    await authorizeProject(req, projectId);

    const project = await repository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    const reportsList = await repository.getReportsByProject(projectId);

    res.json({
      success: true,
      projectId,
      reports: reportsList,
      total: reportsList.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:id
 * Purge project and all associated scripts, analyses, findings, and reports (data retention compliance)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid project ID format.');
    }
    const projectId = parseResult.data;

    await authorizeProject(req, projectId);

    const project = await repository.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    await dataLifecycleManager.purgeProject(projectId);

    res.json({
      success: true,
      message: `Project ${projectId} and all associated data have been permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
