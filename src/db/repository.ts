import { eq, desc } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from './index';
import {
  projects,
  scripts,
  analysisRuns,
  riskFindings,
  entities,
  rewrites,
  evidence,
  reports,
  users,
} from './schema';
import { tempStore, StoredProject, StoredScript, StoredAnalysisRun } from '../lib/storage/tempStore';
import { gcsStorage } from '../lib/storage/gcsStorage';
import { NormalizedScreenplay } from '../types/screenplay';
import { RiskFinding } from '../types/api';
import { DatabaseError, DatabaseNotConfiguredError } from '../lib/errors/AppError';

export interface StoredEvidence {
  id: string;
  analysisId: string;
  findingId?: string | null;
  entityId?: string | null;
  provider: string;
  evidenceType: string;
  source?: string | null;
  content: string;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StoredReport {
  id: string;
  analysisId: string;
  projectId: string;
  title: string;
  overallRiskScore?: number | null;
  summary?: string | null;
  status: string;
  reportData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export class ScreenplayRepository {
  private ensureDatabase(): void {
    if (!isDatabaseConfigured()) {
      if (process.env.NODE_ENV !== 'test') {
        throw new DatabaseNotConfiguredError(
          'PostgreSQL database persistence is not configured. DATABASE_URL environment variable is required to persist and retrieve projects, screenplays, and analysis findings. Please configure DATABASE_URL in your environment or Cloud SQL configuration.'
        );
      }
    }
  }

  async saveProject(project: StoredProject & { userId?: string }): Promise<void> {
    this.ensureDatabase();
    tempStore.saveProject(project);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        if (project.userId) {
          await db
            .insert(users)
            .values({
              id: project.userId,
              email: `${project.userId}@cineshield.internal`,
              name: project.userId,
            })
            .onConflictDoNothing();
        }
        await db
          .insert(projects)
          .values({
            id: project.id,
            title: project.title,
            userId: project.userId || null,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
          })
          .onConflictDoUpdate({
            target: projects.id,
            set: {
              title: project.title,
              userId: project.userId || null,
              updatedAt: new Date(project.updatedAt),
            },
          });
      } catch (err) {
        console.error('Database write error (saveProject):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist project in PostgreSQL.');
      }
    }
  }

  async getProject(id: string): Promise<StoredProject | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            title: row.title,
            userId: row.userId ?? undefined,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getProject):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch project from PostgreSQL.');
      }
    }

    return tempStore.getProject(id);
  }

  async listProjects(): Promise<StoredProject[]> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
        return rows.map((row) => ({
          id: row.id,
          title: row.title,
          userId: row.userId ?? undefined,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
      } catch (err) {
        console.error('Database read error (listProjects):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch projects from PostgreSQL database.');
      }
    }
    return tempStore.listProjects();
  }

  async saveScript(script: StoredScript, metadataObj?: Record<string, unknown>): Promise<void> {
    tempStore.saveScript(script);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db
          .insert(scripts)
          .values({
            id: script.id,
            projectId: script.projectId,
            fileName: script.fileName,
            fileType: script.fileType,
            fileSize: script.fileSize,
            title: script.title,
            status: script.status,
            metadata: metadataObj || null,
            createdAt: new Date(script.uploadedAt),
            updatedAt: new Date(script.uploadedAt),
          })
          .onConflictDoUpdate({
            target: scripts.id,
            set: {
              status: script.status,
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        console.error('Database write error (saveScript):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist script record in PostgreSQL.');
      }
    }
  }

  async getScript(id: string): Promise<StoredScript | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(scripts).where(eq(scripts.id, id)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            projectId: row.projectId,
            fileName: row.fileName,
            fileType: row.fileType as StoredScript['fileType'],
            fileSize: row.fileSize,
            title: row.title,
            status: row.status as StoredScript['status'],
            uploadedAt: row.createdAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getScript):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch script record from PostgreSQL.');
      }
    }

    return tempStore.getScript(id);
  }

  async getScriptByProject(projectId: string): Promise<StoredScript | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db
          .select()
          .from(scripts)
          .where(eq(scripts.projectId, projectId))
          .orderBy(desc(scripts.createdAt))
          .limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            projectId: row.projectId,
            fileName: row.fileName,
            fileType: row.fileType as StoredScript['fileType'],
            fileSize: row.fileSize,
            title: row.title,
            status: row.status as StoredScript['status'],
            uploadedAt: row.createdAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getScriptByProject):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch script for project from PostgreSQL.');
      }
    }

    return tempStore.getScriptByProject(projectId);
  }

  async saveScreenplay(scriptId: string, screenplay: NormalizedScreenplay): Promise<void> {
    this.ensureDatabase();
    tempStore.saveScreenplay(scriptId, screenplay);

    if (gcsStorage.isConfigured()) {
      await gcsStorage.uploadScreenplay(scriptId, screenplay).catch((err) => {
        console.error('Failed to upload screenplay to GCS in repository:', err);
      });
    }

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const existing = await db.select({ metadata: scripts.metadata }).from(scripts).where(eq(scripts.id, scriptId)).limit(1);
        const existingMeta = (existing[0]?.metadata || {}) as Record<string, unknown>;
        await db
          .update(scripts)
          .set({
            metadata: {
              ...existingMeta,
              screenplay,
            },
            updatedAt: new Date(),
          })
          .where(eq(scripts.id, scriptId));
      } catch (err) {
        console.error('Database write error (saveScreenplay):', err instanceof Error ? err.message : String(err));
      }
    }
  }

  async getScreenplay(scriptId: string): Promise<NormalizedScreenplay | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select({ metadata: scripts.metadata }).from(scripts).where(eq(scripts.id, scriptId)).limit(1);
        if (rows.length > 0 && rows[0].metadata) {
          const meta = rows[0].metadata as Record<string, unknown>;
          if (meta.screenplay) {
            return meta.screenplay as NormalizedScreenplay;
          }
        }
      } catch (err) {
        console.error('Database read error (getScreenplay):', err instanceof Error ? err.message : String(err));
      }
    }

    if (gcsStorage.isConfigured()) {
      const fromGcs = await gcsStorage.downloadScreenplay(scriptId);
      if (fromGcs) {
        return fromGcs;
      }
    }

    const fromMemory = tempStore.getScreenplay(scriptId);
    if (fromMemory) return fromMemory;

    return undefined;
  }

  async saveAnalysisRun(run: StoredAnalysisRun): Promise<void> {
    this.ensureDatabase();
    tempStore.saveAnalysisRun(run);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db
          .insert(analysisRuns)
          .values({
            id: run.id,
            scriptId: run.scriptId,
            projectId: run.projectId,
            status: run.status,
            progress: run.progress,
            stageMessage: run.stageMessage || null,
            errorMessage: run.errorMessage || null,
            overallRiskScore: run.overallRiskScore || null,
            createdAt: new Date(run.createdAt),
            updatedAt: new Date(run.updatedAt),
            completedAt: run.completedAt ? new Date(run.completedAt) : null,
          })
          .onConflictDoUpdate({
            target: analysisRuns.id,
            set: {
              status: run.status,
              progress: run.progress,
              stageMessage: run.stageMessage || null,
              errorMessage: run.errorMessage || null,
              overallRiskScore: run.overallRiskScore || null,
              updatedAt: new Date(run.updatedAt),
              completedAt: run.completedAt ? new Date(run.completedAt) : null,
            },
          });
      } catch (err) {
        console.error('Database write error (saveAnalysisRun):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist analysis run in PostgreSQL.');
      }
    }
  }

  async getAnalysisRun(id: string): Promise<StoredAnalysisRun | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(analysisRuns).where(eq(analysisRuns.id, id)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            scriptId: row.scriptId,
            projectId: row.projectId,
            status: row.status as StoredAnalysisRun['status'],
            progress: row.progress,
            stageMessage: row.stageMessage || undefined,
            errorMessage: row.errorMessage || undefined,
            overallRiskScore: row.overallRiskScore || undefined,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            completedAt: row.completedAt ? row.completedAt.toISOString() : null,
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getAnalysisRun):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch analysis run from PostgreSQL.');
      }
    }

    return tempStore.getAnalysisRun(id);
  }

  async getLatestAnalysisForProject(projectId: string): Promise<StoredAnalysisRun | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db
          .select()
          .from(analysisRuns)
          .where(eq(analysisRuns.projectId, projectId))
          .orderBy(desc(analysisRuns.createdAt))
          .limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          return {
            id: row.id,
            scriptId: row.scriptId,
            projectId: row.projectId,
            status: row.status as StoredAnalysisRun['status'],
            progress: row.progress,
            stageMessage: row.stageMessage || undefined,
            errorMessage: row.errorMessage || undefined,
            overallRiskScore: row.overallRiskScore || undefined,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            completedAt: row.completedAt ? row.completedAt.toISOString() : null,
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getLatestAnalysisForProject):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch latest analysis from PostgreSQL.');
      }
    }

    return tempStore.getLatestAnalysisForProject(projectId);
  }

  async getFindings(analysisId: string): Promise<RiskFinding[]> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(riskFindings).where(eq(riskFindings.analysisId, analysisId));
        return rows.map((r) => ({
          id: r.id,
          analysisId: r.analysisId,
          category: r.category,
          severity: r.severity as RiskFinding['severity'],
          title: r.title,
          description: r.description,
          sceneId: r.sceneId || undefined,
          elementId: r.elementId || undefined,
          startOffset: r.startOffset || undefined,
          endOffset: r.endOffset || undefined,
          suggestedAction: r.suggestedAction || undefined,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        console.error('Database read error (getFindings):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch findings from PostgreSQL.');
      }
    }

    return tempStore.getFindings(analysisId);
  }

  async getFinding(id: string): Promise<RiskFinding | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(riskFindings).where(eq(riskFindings.id, id)).limit(1);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            analysisId: r.analysisId,
            category: r.category,
            severity: r.severity as RiskFinding['severity'],
            title: r.title,
            description: r.description,
            sceneId: r.sceneId || undefined,
            elementId: r.elementId || undefined,
            startOffset: r.startOffset || undefined,
            endOffset: r.endOffset || undefined,
            suggestedAction: r.suggestedAction || undefined,
            createdAt: r.createdAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getFinding):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch finding from PostgreSQL.');
      }
    }

    return tempStore.getFinding(id);
  }

  async saveFindings(analysisId: string, list: RiskFinding[]): Promise<void> {
    this.ensureDatabase();
    tempStore.saveFindings(analysisId, list);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db.transaction(async (tx) => {
          for (const finding of list) {
            await tx
              .insert(riskFindings)
              .values({
                id: finding.id,
                analysisId: finding.analysisId,
                category: finding.category,
                severity: finding.severity,
                title: finding.title,
                description: finding.description,
                sceneId: finding.sceneId || null,
                elementId: finding.elementId || null,
                startOffset: finding.startOffset ?? null,
                endOffset: finding.endOffset ?? null,
                suggestedAction: finding.suggestedAction || null,
                createdAt: new Date(finding.createdAt),
              })
              .onConflictDoNothing();
          }
        });
      } catch (err) {
        console.error('Database write error (saveFindings):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist risk findings in PostgreSQL.');
      }
    }
  }

  async saveEntities(
    analysisId: string,
    list: Array<{ id: string; name: string; type: string; count: number; metadata?: any }>
  ): Promise<void> {
    this.ensureDatabase();
    tempStore.saveEntities(analysisId, list);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db.transaction(async (tx) => {
          for (const entity of list) {
            await tx
              .insert(entities)
              .values({
                id: entity.id,
                analysisId,
                name: entity.name,
                type: entity.type,
                count: entity.count,
                metadata: entity.metadata || null,
              })
              .onConflictDoNothing();
          }
        });
      } catch (err) {
        console.error('Database write error (saveEntities):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist entities in PostgreSQL.');
      }
    }
  }

  async getEntities(
    analysisId: string
  ): Promise<Array<{ id: string; name: string; type: string; count: number; metadata?: any }>> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(entities).where(eq(entities.analysisId, analysisId));
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          count: r.count,
          metadata: r.metadata,
        }));
      } catch (err) {
        console.error('Database read error (getEntities):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch entities from PostgreSQL.');
      }
    }

    return tempStore.getEntities(analysisId);
  }

  async saveRewrite(rewrite: {
    id: string;
    findingId: string;
    originalText: string;
    suggestedText: string;
    rationale: string;
    status: string;
    createdAt?: string;
  }): Promise<void> {
    this.ensureDatabase();
    const createdAtStr = rewrite.createdAt || new Date().toISOString();
    tempStore.saveRewrite({ ...rewrite, createdAt: createdAtStr });

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db.insert(rewrites).values({
          id: rewrite.id,
          findingId: rewrite.findingId,
          originalText: rewrite.originalText,
          suggestedText: rewrite.suggestedText,
          rationale: rewrite.rationale,
          status: rewrite.status,
          createdAt: new Date(createdAtStr),
        });
      } catch (err) {
        console.error('Database write error (saveRewrite):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist rewrite in PostgreSQL.');
      }
    }
  }

  async getRewrites(findingId: string): Promise<
    Array<{
      id: string;
      findingId: string;
      originalText: string;
      suggestedText: string;
      rationale: string;
      status: string;
      createdAt: string;
    }>
  > {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(rewrites).where(eq(rewrites.findingId, findingId));
        return rows.map((r) => ({
          id: r.id,
          findingId: r.findingId,
          originalText: r.originalText,
          suggestedText: r.suggestedText,
          rationale: r.rationale,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        console.error('Database read error (getRewrites):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch rewrites from PostgreSQL.');
      }
    }

    return tempStore.getRewrites(findingId);
  }

  // Evidence methods
  async saveEvidence(analysisId: string, records: StoredEvidence[]): Promise<void> {
    this.ensureDatabase();
    tempStore.saveEvidence(analysisId, records);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        // In PostgreSQL, execute batch insert within a transaction
        await db.transaction(async (tx) => {
          for (const rec of records) {
            await tx
              .insert(evidence)
              .values({
                id: rec.id,
                analysisId: rec.analysisId,
                findingId: rec.findingId || null,
                entityId: rec.entityId || null,
                provider: rec.provider,
                evidenceType: rec.evidenceType,
                source: rec.source || null,
                content: rec.content,
                confidence: rec.confidence ?? null,
                metadata: rec.metadata || null,
                createdAt: new Date(rec.createdAt),
              })
              .onConflictDoNothing();
          }
        });
      } catch (err) {
        console.error('Database write error (saveEvidence):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist partner evidence in PostgreSQL.');
      }
    }
  }

  async getEvidence(analysisId: string): Promise<StoredEvidence[]> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(evidence).where(eq(evidence.analysisId, analysisId));
        return rows.map((r) => ({
          id: r.id,
          analysisId: r.analysisId,
          findingId: r.findingId,
          entityId: r.entityId,
          provider: r.provider,
          evidenceType: r.evidenceType,
          source: r.source,
          content: r.content,
          confidence: r.confidence,
          metadata: r.metadata as Record<string, unknown> | null,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        console.error('Database read error (getEvidence):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch evidence from PostgreSQL.');
      }
    }

    return tempStore.getEvidence(analysisId);
  }

  // Reports methods
  async saveReport(report: StoredReport): Promise<void> {
    this.ensureDatabase();
    tempStore.saveReport(report);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db
          .insert(reports)
          .values({
            id: report.id,
            analysisId: report.analysisId,
            projectId: report.projectId,
            title: report.title,
            overallRiskScore: report.overallRiskScore ?? null,
            summary: report.summary ?? null,
            status: report.status,
            reportData: report.reportData,
            createdAt: new Date(report.createdAt),
            updatedAt: new Date(report.updatedAt),
          })
          .onConflictDoUpdate({
            target: reports.id,
            set: {
              title: report.title,
              overallRiskScore: report.overallRiskScore ?? null,
              summary: report.summary ?? null,
              status: report.status,
              reportData: report.reportData,
              updatedAt: new Date(report.updatedAt),
            },
          });
      } catch (err) {
        console.error('Database write error (saveReport):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to persist report in PostgreSQL.');
      }
    }
  }

  async getReport(id: string): Promise<StoredReport | undefined> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            analysisId: r.analysisId,
            projectId: r.projectId,
            title: r.title,
            overallRiskScore: r.overallRiskScore,
            summary: r.summary,
            status: r.status,
            reportData: r.reportData as Record<string, unknown>,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        console.error('Database read error (getReport):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch report from PostgreSQL.');
      }
    }

    return tempStore.getReport(id);
  }

  async getReportsByProject(projectId: string): Promise<StoredReport[]> {
    this.ensureDatabase();
    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        const rows = await db.select().from(reports).where(eq(reports.projectId, projectId));
        return rows.map((r) => ({
          id: r.id,
          analysisId: r.analysisId,
          projectId: r.projectId,
          title: r.title,
          overallRiskScore: r.overallRiskScore,
          summary: r.summary,
          status: r.status,
          reportData: r.reportData as Record<string, unknown>,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
      } catch (err) {
        console.error('Database read error (getReportsByProject):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to fetch project reports from PostgreSQL.');
      }
    }

    return tempStore.getReportsByProject(projectId);
  }

  // Deletion methods for data retention & privacy compliance
  async deleteProject(id: string): Promise<void> {
    this.ensureDatabase();
    tempStore.deleteProject(id);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        // Foreign keys will cascade delete associated scripts, analysis_runs, findings, etc.
        await db.delete(projects).where(eq(projects.id, id));
      } catch (err) {
        console.error('Database delete error (deleteProject):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to delete project from PostgreSQL.');
      }
    }
  }

  async deleteScript(id: string): Promise<void> {
    this.ensureDatabase();
    tempStore.deleteScript(id);

    if (gcsStorage.isConfigured()) {
      await gcsStorage.deleteScreenplay(id).catch((err) => {
        console.error('Failed to delete screenplay from GCS:', err);
      });
    }

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db.delete(scripts).where(eq(scripts.id, id));
      } catch (err) {
        console.error('Database delete error (deleteScript):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to delete script from PostgreSQL.');
      }
    }
  }

  async deleteAnalysis(id: string): Promise<void> {
    this.ensureDatabase();
    tempStore.deleteAnalysis(id);

    if (isDatabaseConfigured()) {
      try {
        const db = getDb();
        await db.delete(analysisRuns).where(eq(analysisRuns.id, id));
      } catch (err) {
        console.error('Database delete error (deleteAnalysis):', err instanceof Error ? err.message : String(err));
        throw new DatabaseError('Failed to delete analysis from PostgreSQL.');
      }
    }
  }
}

export const repository = new ScreenplayRepository();
