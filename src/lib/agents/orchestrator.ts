import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { repository, StoredEvidence, StoredReport } from '../../db/repository';
import { tempStore } from '../storage/tempStore';
import { scriptParserAgent } from './scriptParserAgent';
import { entityDetectionAgent } from './entityDetectionAgent';
import { partnerEvidenceService } from './evidenceService';
import { riskAnalysisAgent } from './riskAnalysisAgent';
import { scoringRubric } from './scoringRubric';
import { isGeminiConfigured } from './geminiClient';
import { RiskFinding, AnalysisStatus } from '../../types/api';
import { AgentExecutionStats } from './types';
import { ScreenplayScene } from '../../types/screenplay';
import { logger } from '../observability/logger';
import { releaseAnalysisSlot } from '../security/rateLimiter';

/**
 * Deterministic Multi-Agent Analysis Orchestrator
 *
 * Coordinates execution of specialized agents in a strict, predictable pipeline:
 * Screenplay Ingestion
 *   ↓
 * 1. Script Parser Agent (Deterministic Structural Extraction)
 *   ↓
 * 2. IP Entity Detection Agent (Gemini Contextual Entity Extraction)
 *   ↓
 * 3. Partner Evidence Service (Watsonx / Bob Evidence Gathering)
 *   ↓
 * 4. Gemini Risk Analysis Agent (Legal Pre-Screening & Deterministic Rubric)
 *   ↓
 * 5. Structured Findings Mapping, Evidence Persistence & Report Generation
 *   ↓
 * Database Persistence & Status Completion
 */
export class AgentOrchestrator extends EventEmitter {
  /**
   * Executes the full multi-agent analysis lifecycle for an analysis run
   */
  async runAnalysis(analysisId: string, userId?: string): Promise<AgentExecutionStats> {
    const startTime = Date.now();
    const stagesCompleted: string[] = [];
    let modelCallsCount = 0;

    const run = await repository.getAnalysisRun(analysisId);
    if (!run) {
      throw new Error(`Analysis run ${analysisId} not found.`);
    }

    logger.info('Starting multi-agent analysis run', {
      analysisId,
      meta: { scriptId: run.scriptId, projectId: run.projectId },
    });

    try {
      // 0. Verify Gemini configuration before proceeding
      if (!isGeminiConfigured()) {
        throw new Error(
          'Gemini integration not configured. Please provide GEMINI_API_KEY in the environment or Settings > Secrets panel.'
        );
      }

      // Stage 1: Parsing Verification
      await this.updateStage(analysisId, 'parsing', 20, 'Verifying screenplay structure and scene metadata');
      const screenplay = tempStore.getScreenplay(run.scriptId);
      if (!screenplay) {
        throw new Error(`Screenplay data for script ${run.scriptId} was not found in storage.`);
      }

      const parsedContext = await scriptParserAgent.process(screenplay);
      stagesCompleted.push('parsing');

      // Stage 2: Entity Detection
      await this.updateStage(
        analysisId,
        'extracting_entities',
        40,
        `Extracting IP entities, brands, and protected creative references across ${parsedContext.scenes.length} scenes`
      );

      const detectedEntities = await entityDetectionAgent.detectEntities(parsedContext.scenes);
      modelCallsCount += Math.max(1, Math.ceil(parsedContext.scenes.length / 4));

      // Persist detected entities to database
      const entityRecords = detectedEntities.map((e) => ({
        id: e.id,
        name: e.entity,
        type: e.type,
        count: e.occurrencesCount,
        metadata: {
          location: e.location,
          sceneId: e.sceneId,
          elementId: e.elementId,
          startOffset: e.startOffset,
          endOffset: e.endOffset,
          confidence: e.confidence,
        },
      }));
      await repository.saveEntities(analysisId, entityRecords);
      stagesCompleted.push('extracting_entities');

      // Stage 3: Partner Evidence Verification
      const providerDesc = partnerEvidenceService.isConfigured()
        ? 'Querying IBM watsonx partner clearance evidence'
        : 'Checking external partner evidence layer (IBM watsonx - not configured)';
      await this.updateStage(analysisId, 'partner_analysis', 60, providerDesc);

      const evidenceMap = await partnerEvidenceService.gatherEvidence(detectedEntities);
      stagesCompleted.push('partner_analysis');

      // Persist gathered evidence records
      const evidenceRecords: StoredEvidence[] = [];
      const evidenceCreatedAt = new Date().toISOString();
      for (const [entityId, item] of evidenceMap.entries()) {
        if (item.matches && item.matches.length > 0) {
          for (const match of item.matches) {
            evidenceRecords.push({
              id: randomUUID(),
              analysisId,
              entityId,
              provider: item.provider || item.source || 'IBM watsonx',
              evidenceType: 'trademark_clearance',
              source: item.source,
              content: `${match.title}${match.owner ? ` (Owner: ${match.owner})` : ''}: ${match.details || item.notes}`,
              confidence: Math.round((match.similarityScore ?? 0.85) * 100),
              metadata: {
                registrationNumber: match.registrationNumber,
                owner: match.owner,
                retrievedAt: item.retrievedAt,
              },
              createdAt: evidenceCreatedAt,
            });
          }
        } else if (item.notes) {
          evidenceRecords.push({
            id: randomUUID(),
            analysisId,
            entityId,
            provider: item.provider || item.source || 'IBM watsonx',
            evidenceType: 'clearance_record',
            source: item.source,
            content: item.notes,
            confidence: 80,
            metadata: {
              retrievedAt: item.retrievedAt,
            },
            createdAt: evidenceCreatedAt,
          });
        }
      }
      if (evidenceRecords.length > 0) {
        await repository.saveEvidence(analysisId, evidenceRecords);
      }

      // Stage 4: Gemini Risk Analysis
      await this.updateStage(
        analysisId,
        'risk_analysis',
        80,
        `Conducting IP clearance risk analysis across ${detectedEntities.length} detected entities`
      );

      const sceneContextMap = this.buildSceneContextMap(parsedContext.scenes);
      const riskResults = await riskAnalysisAgent.analyzeEntitiesBatch(
        detectedEntities,
        sceneContextMap,
        evidenceMap
      );
      modelCallsCount += detectedEntities.length;
      stagesCompleted.push('risk_analysis');

      // Stage 5: Generating Recommendations & Persistence
      await this.updateStage(
        analysisId,
        'generating_recommendations',
        95,
        'Compiling clearance recommendations and calculating deterministic project risk score'
      );

      const now = new Date().toISOString();
      const findingsList: RiskFinding[] = riskResults.map((r) => {
        let mappedSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (r.riskLevel === 'HIGH') mappedSeverity = r.riskScore >= 85 ? 'critical' : 'high';
        else if (r.riskLevel === 'MEDIUM') mappedSeverity = 'medium';

        return {
          id: randomUUID(),
          analysisId,
          category: r.category || 'IP_TRADEMARK',
          severity: mappedSeverity,
          title: `${r.entityName} - Potential ${r.category} Concern`,
          description: r.reason,
          sceneId: r.sceneId,
          elementId: r.elementId,
          startOffset: r.startOffset,
          endOffset: r.endOffset,
          suggestedAction: r.recommendedAction,
          createdAt: now,
        };
      });

      // Persist real risk findings to database
      await repository.saveFindings(analysisId, findingsList);

      // Compute deterministic overall project risk summary
      const projectSummary = scoringRubric.calculateProjectSummary(riskResults, detectedEntities.length);

      // Save initial comprehensive compliance report
      const initialReport: StoredReport = {
        id: randomUUID(),
        analysisId,
        projectId: run.projectId,
        title: `Clearance Assessment Report - ${screenplay.title || 'Screenplay'}`,
        overallRiskScore: projectSummary.overallRiskScore,
        summary: `Analysis identified ${findingsList.length} potential risk findings across ${detectedEntities.length} detected creative assets.`,
        status: 'generated',
        reportData: {
          projectSummary,
          findingsCount: findingsList.length,
          severityBreakdown: {
            critical: findingsList.filter((f) => f.severity === 'critical').length,
            high: findingsList.filter((f) => f.severity === 'high').length,
            medium: findingsList.filter((f) => f.severity === 'medium').length,
            low: findingsList.filter((f) => f.severity === 'low').length,
          },
          evidenceCount: evidenceRecords.length,
          generatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };
      await repository.saveReport(initialReport);

      // Finalize analysis run record
      await repository.saveAnalysisRun({
        id: analysisId,
        scriptId: run.scriptId,
        projectId: run.projectId,
        status: 'complete',
        progress: 100,
        stageMessage: 'Analysis complete. Clearance assessment ready.',
        overallRiskScore: projectSummary.overallRiskScore,
        createdAt: run.createdAt,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      stagesCompleted.push('complete');
      this.emit(`progress:${analysisId}`, {
        status: 'complete',
        progress: 100,
        stageMessage: 'Analysis complete. Clearance assessment ready.',
      });

      const totalDuration = Date.now() - startTime;
      logger.info('Analysis run completed successfully', {
        analysisId,
        durationMs: totalDuration,
        modelCalls: modelCallsCount,
        meta: {
          findingsCount: findingsList.length,
          overallRiskScore: projectSummary.overallRiskScore,
        },
      });

      return {
        analysisId,
        totalModelCalls: modelCallsCount,
        totalEntitiesDetected: detectedEntities.length,
        totalFindingsGenerated: findingsList.length,
        durationMs: totalDuration,
        stagesCompleted,
      };
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Orchestrator failed for analysis ${analysisId}`, err, {
        analysisId,
        meta: { scriptId: run.scriptId },
      });

      // Persist real failure status - never fake success
      await repository.saveAnalysisRun({
        id: analysisId,
        scriptId: run.scriptId,
        projectId: run.projectId,
        status: 'failed',
        progress: run.progress,
        stageMessage: 'Analysis processing encountered an error',
        errorMessage,
        createdAt: run.createdAt,
        updatedAt: new Date().toISOString(),
      });

      this.emit(`progress:${analysisId}`, {
        status: 'failed',
        progress: run.progress,
        stageMessage: 'Analysis processing encountered an error',
        errorMessage,
      });

      throw err;
    } finally {
      if (userId) {
        releaseAnalysisSlot(userId);
      }
    }
  }

  /**
   * Helper to update live progress in repository and broadcast events
   */
  private async updateStage(
    analysisId: string,
    status: AnalysisStatus,
    progress: number,
    stageMessage: string
  ): Promise<void> {
    const run = await repository.getAnalysisRun(analysisId);
    if (!run) return;

    await repository.saveAnalysisRun({
      ...run,
      status,
      progress,
      stageMessage,
      updatedAt: new Date().toISOString(),
    });

    this.emit(`progress:${analysisId}`, {
      status,
      progress,
      stageMessage,
    });
  }

  /**
   * Builds bounded narrative text snippets for each scene
   */
  private buildSceneContextMap(scenes: ScreenplayScene[]): Map<string, string> {
    const map = new Map<string, string>();

    for (const scene of scenes) {
      const parts: string[] = [`Heading: ${scene.heading}`];
      for (const el of scene.elements.slice(0, 25)) {
        if (el.type === 'character') parts.push(`\n${el.text}:`);
        else if (el.type === 'dialogue') parts.push(`"${el.text}"`);
        else if (el.type === 'action') parts.push(el.text);
      }
      map.set(scene.id, parts.join(' '));
    }

    return map;
  }
}

export const agentOrchestrator = new AgentOrchestrator();
