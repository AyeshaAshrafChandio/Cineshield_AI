import { Router, Request, Response, NextFunction } from 'express';
import { uuidSchema } from '../lib/validation/schemas';
import { repository } from '../db/repository';
import { NotFoundError, ValidationError } from '../lib/errors/AppError';
import { authorizeProject } from '../lib/security/auth';
import { ReportDataResponse } from '../types/api';

const router = Router();

/**
 * GET /api/reports/:id
 * Generate/retrieve compliance and risk assessment report for an analysis run or project
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid report/analysis ID format.');
    }
    const reportOrAnalysisId = parseResult.data;

    // Check if ID matches an analysis run
    let analysisRun = await repository.getAnalysisRun(reportOrAnalysisId);

    // If not found directly, check if it's a project ID with an analysis run
    let project = null;
    if (!analysisRun) {
      project = await repository.getProject(reportOrAnalysisId);
      if (project) {
        analysisRun = await repository.getLatestAnalysisForProject(project.id);
      }
    } else {
      project = await repository.getProject(analysisRun.projectId);
    }

    if (!analysisRun && !project) {
      throw new NotFoundError('Report or Analysis run', reportOrAnalysisId);
    }

    const projectId = project?.id || analysisRun?.projectId || reportOrAnalysisId;
    const analysisId = analysisRun?.id || reportOrAnalysisId;

    // Enforce server-side authorization on project
    await authorizeProject(req, projectId);

    const analysisTimestamp = analysisRun?.completedAt || analysisRun?.createdAt || new Date().toISOString();

    // Retrieve real findings, entities, and evidence from repository
    const findingsList = analysisRun ? await repository.getFindings(analysisRun.id) : [];
    const entitiesList = analysisRun ? await repository.getEntities(analysisRun.id) : [];
    const evidenceRecords = analysisRun ? await repository.getEvidence(analysisRun.id) : [];

    // Map evidence items
    const evidenceList = evidenceRecords.map((ev) => ({
      id: ev.id,
      findingId: ev.findingId || ev.id,
      snippet: ev.content,
      sceneHeading: ev.source || 'External Partner Evidence',
      provider: ev.provider,
      confidence: ev.confidence,
    }));

    // If no external evidence records, map from findings
    if (evidenceList.length === 0) {
      for (const f of findingsList) {
        if (f.description) {
          evidenceList.push({
            id: f.id,
            findingId: f.id,
            snippet: f.description,
            sceneHeading: f.sceneId || 'Script Analysis',
            provider: 'Gemini Risk Agent',
            confidence: 90,
          });
        }
      }
    }

    // Collect creative rewrites associated with any of the findings
    const creativeAlternatives: Array<{ findingId: string; suggestedText: string; rationale: string }> = [];
    for (const f of findingsList) {
      const rewrites = await repository.getRewrites(f.id);
      for (const rw of rewrites) {
        creativeAlternatives.push({
          findingId: rw.findingId,
          suggestedText: rw.suggestedText,
          rationale: rw.rationale,
        });
      }
    }

    const recommendedActionsList = Array.from(
      new Set(findingsList.map((f) => f.suggestedAction).filter((a): a is string => Boolean(a)))
    );

    const response: ReportDataResponse = {
      success: true,
      report: {
        reportId: analysisId,
        projectId,
        analysisId,
        analysisTimestamp,
        overallRiskScore: analysisRun?.overallRiskScore ?? null,
        entities: entitiesList.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          count: e.count,
        })),
        findings: findingsList,
        evidence: evidenceList,
        recommendedActions: recommendedActionsList,
        creativeAlternatives: creativeAlternatives.map((a) => a.suggestedText),
        disclaimer:
          'CineShield AI compliance screening is generated for production and legal advisory assistance only and does not constitute formal legal counsel.',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
