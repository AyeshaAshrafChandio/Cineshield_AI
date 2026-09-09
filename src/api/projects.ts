import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { uuidSchema } from '../lib/validation/schemas';
import { repository } from '../db/repository';
import { tempStore } from '../lib/storage/tempStore';
import { parseScreenplay } from '../lib/parsing';
import { NotFoundError, ValidationError } from '../lib/errors/AppError';
import { authorizeProject } from '../lib/security/auth';
import { dataLifecycleManager } from '../lib/storage/cleanupService';
import { ProjectInfoResponse, ScreenplayDataResponse } from '../types/api';

const router = Router();

/**
 * POST /api/projects
 * Create a new project directly (supports JSON payload with raw screenplay text or metadata)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, studio, rawText, fileName, fileType } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('Project title is required.');
    }

    const projectId = randomUUID();
    const now = new Date().toISOString();
    const cleanTitle = title.trim();

    await repository.saveProject({
      id: projectId,
      title: cleanTitle,
      userId: (req as any).user?.id || 'default-user',
      createdAt: now,
      updatedAt: now,
    });

    let scriptRecord = null;
    if (rawText && typeof rawText === 'string') {
      const scriptId = randomUUID();
      const safeName = fileName || `${cleanTitle.toLowerCase().replace(/\s+/g, '_')}.${fileType || 'fountain'}`;
      const format = (fileType || 'fountain').toLowerCase() === 'pdf' ? 'pdf' : (fileType || 'fountain').toLowerCase() === 'txt' ? 'txt' : 'fountain';
      const textBuffer = Buffer.from(rawText, 'utf-8');

      const parsed = await parseScreenplay(textBuffer, format as any, safeName);
      await repository.saveScreenplay(scriptId, parsed);

      await repository.saveScript(
        {
          id: scriptId,
          projectId,
          fileName: safeName,
          fileType: format,
          fileSize: textBuffer.length,
          title: parsed.title || cleanTitle,
          status: 'uploaded',
          uploadedAt: now,
        },
        {
          totalScenes: parsed.metadata.totalScenes,
          totalElements: parsed.metadata.totalElements,
          estimatedDurationMinutes: parsed.metadata.estimatedDurationMinutes,
          characters: parsed.metadata.characters,
          locations: parsed.metadata.locations,
        }
      );

      scriptRecord = {
        id: scriptId,
        fileName: safeName,
        fileType: format,
        title: parsed.title || cleanTitle,
        uploadedAt: now,
      };
    }

    res.status(201).json({
      success: true,
      project: {
        id: projectId,
        title: cleanTitle,
        studio: studio || 'Studio Alpha',
        script: scriptRecord,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/projects
 * List all projects with script info and latest analysis status
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawProjects = await repository.listProjects();
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.id;

    // Filter by tenant/user if authenticated and non-admin
    const filtered = rawProjects.filter((p) => {
      if (!userId || userRole === 'admin') return true;
      return !p.userId || p.userId === userId;
    });

    const enriched = await Promise.all(
      filtered.map(async (project) => {
        const script = await repository.getScriptByProject(project.id);
        const latestAnalysis = await repository.getLatestAnalysisForProject(project.id);
        let findingsCount = 0;
        if (latestAnalysis) {
          const findings = await repository.getFindings(latestAnalysis.id);
          findingsCount = findings.length;
        }

        return {
          id: project.id,
          title: project.title,
          script: script ? {
            id: script.id,
            fileName: script.fileName,
            fileType: script.fileType,
            title: script.title,
            uploadedAt: script.uploadedAt,
          } : null,
          analysisStatus: latestAnalysis?.status || null,
          latestAnalysisId: latestAnalysis?.id || null,
          overallRiskScore: latestAnalysis?.overallRiskScore ?? null,
          findingsCount,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      })
    );

    res.json({
      success: true,
      projects: enriched,
      total: enriched.length,
    });
  } catch (error) {
    next(error);
  }
});

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
