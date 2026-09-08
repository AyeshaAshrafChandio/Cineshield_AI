import { NormalizedScreenplay } from '../../types/screenplay';
import { AnalysisStatus, RiskFinding } from '../../types/api';

export interface StoredProject {
  id: string;
  title: string;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredScript {
  id: string;
  projectId: string;
  fileName: string;
  fileType: 'pdf' | 'txt' | 'fountain';
  fileSize: number;
  title: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'failed';
  uploadedAt: string;
}

export interface StoredAnalysisRun {
  id: string;
  scriptId: string;
  projectId: string;
  status: AnalysisStatus;
  progress: number;
  stageMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  overallRiskScore?: number | null;
}

class IngestionStore {
  private projects = new Map<string, StoredProject>();
  private scripts = new Map<string, StoredScript>();
  private screenplays = new Map<string, NormalizedScreenplay>();
  private analysisRuns = new Map<string, StoredAnalysisRun>();
  private findings = new Map<string, RiskFinding[]>();
  private entities = new Map<string, Array<{ id: string; name: string; type: string; count: number; metadata?: any }>>();
  private rewrites = new Map<string, Array<{ id: string; findingId: string; originalText: string; suggestedText: string; rationale: string; status: string; createdAt: string }>>();

  // Project operations
  saveProject(project: StoredProject): void {
    this.projects.set(project.id, project);
  }

  getProject(id: string): StoredProject | undefined {
    return this.projects.get(id);
  }

  listProjects(): StoredProject[] {
    return Array.from(this.projects.values());
  }

  // Script operations
  saveScript(script: StoredScript): void {
    this.scripts.set(script.id, script);
  }

  getScript(id: string): StoredScript | undefined {
    return this.scripts.get(id);
  }

  getScriptByProject(projectId: string): StoredScript | undefined {
    for (const script of this.scripts.values()) {
      if (script.projectId === projectId) {
        return script;
      }
    }
    return undefined;
  }

  // Screenplay operations
  saveScreenplay(scriptId: string, screenplay: NormalizedScreenplay): void {
    this.screenplays.set(scriptId, screenplay);
  }

  getScreenplay(scriptId: string): NormalizedScreenplay | undefined {
    return this.screenplays.get(scriptId);
  }

  // Analysis operations
  saveAnalysisRun(run: StoredAnalysisRun): void {
    this.analysisRuns.set(run.id, run);
  }

  getAnalysisRun(id: string): StoredAnalysisRun | undefined {
    return this.analysisRuns.get(id);
  }

  getLatestAnalysisForProject(projectId: string): StoredAnalysisRun | undefined {
    const matching: StoredAnalysisRun[] = [];
    for (const run of this.analysisRuns.values()) {
      if (run.projectId === projectId) {
        matching.push(run);
      }
    }
    matching.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return matching[0];
  }

  updateAnalysisStatus(
    id: string,
    status: AnalysisStatus,
    progress: number = 0,
    stageMessage?: string,
    errorMessage?: string
  ): StoredAnalysisRun | undefined {
    const run = this.analysisRuns.get(id);
    if (!run) return undefined;

    run.status = status;
    run.progress = progress;
    run.updatedAt = new Date().toISOString();
    if (stageMessage !== undefined) run.stageMessage = stageMessage;
    if (errorMessage !== undefined) run.errorMessage = errorMessage;
    if (status === 'complete') run.completedAt = new Date().toISOString();

    return run;
  }

  // Entities operations
  saveEntities(analysisId: string, list: Array<{ id: string; name: string; type: string; count: number; metadata?: any }>): void {
    this.entities.set(analysisId, list);
  }

  getEntities(analysisId: string): Array<{ id: string; name: string; type: string; count: number; metadata?: any }> {
    return this.entities.get(analysisId) || [];
  }

  // Findings operations
  getFindings(analysisId: string): RiskFinding[] {
    return this.findings.get(analysisId) || [];
  }

  getFinding(id: string): RiskFinding | undefined {
    for (const list of this.findings.values()) {
      const found = list.find((f) => f.id === id);
      if (found) return found;
    }
    return undefined;
  }

  saveFindings(analysisId: string, list: RiskFinding[]): void {
    this.findings.set(analysisId, list);
  }

  // Rewrites operations
  saveRewrite(rewrite: { id: string; findingId: string; originalText: string; suggestedText: string; rationale: string; status: string; createdAt: string }): void {
    const list = this.rewrites.get(rewrite.findingId) || [];
    list.push(rewrite);
    this.rewrites.set(rewrite.findingId, list);
  }

  getRewrites(findingId: string): Array<{ id: string; findingId: string; originalText: string; suggestedText: string; rationale: string; status: string; createdAt: string }> {
    return this.rewrites.get(findingId) || [];
  }

  // Evidence operations
  private evidence = new Map<string, Array<{ id: string; analysisId: string; findingId?: string | null; entityId?: string | null; provider: string; evidenceType: string; source?: string | null; content: string; confidence?: number | null; metadata?: any; createdAt: string }>>();

  saveEvidence(analysisId: string, records: Array<{ id: string; analysisId: string; findingId?: string | null; entityId?: string | null; provider: string; evidenceType: string; source?: string | null; content: string; confidence?: number | null; metadata?: any; createdAt: string }>): void {
    this.evidence.set(analysisId, records);
  }

  getEvidence(analysisId: string): Array<{ id: string; analysisId: string; findingId?: string | null; entityId?: string | null; provider: string; evidenceType: string; source?: string | null; content: string; confidence?: number | null; metadata?: any; createdAt: string }> {
    return this.evidence.get(analysisId) || [];
  }

  // Reports operations
  private reports = new Map<string, { id: string; analysisId: string; projectId: string; title: string; overallRiskScore?: number | null; summary?: string | null; status: string; reportData: any; createdAt: string; updatedAt: string }>();

  saveReport(report: { id: string; analysisId: string; projectId: string; title: string; overallRiskScore?: number | null; summary?: string | null; status: string; reportData: any; createdAt: string; updatedAt: string }): void {
    this.reports.set(report.id, report);
  }

  getReport(id: string): { id: string; analysisId: string; projectId: string; title: string; overallRiskScore?: number | null; summary?: string | null; status: string; reportData: any; createdAt: string; updatedAt: string } | undefined {
    return this.reports.get(id);
  }

  getReportsByProject(projectId: string): Array<{ id: string; analysisId: string; projectId: string; title: string; overallRiskScore?: number | null; summary?: string | null; status: string; reportData: any; createdAt: string; updatedAt: string }> {
    const list: any[] = [];
    for (const r of this.reports.values()) {
      if (r.projectId === projectId) list.push(r);
    }
    return list;
  }

  // Cascade deletions for privacy and data cleanup
  deleteProject(projectId: string): void {
    this.projects.delete(projectId);
    for (const [scriptId, script] of this.scripts.entries()) {
      if (script.projectId === projectId) {
        this.deleteScript(scriptId);
      }
    }
    for (const [reportId, rep] of this.reports.entries()) {
      if (rep.projectId === projectId) {
        this.reports.delete(reportId);
      }
    }
  }

  deleteScript(scriptId: string): void {
    this.scripts.delete(scriptId);
    this.screenplays.delete(scriptId);
    for (const [analysisId, run] of this.analysisRuns.entries()) {
      if (run.scriptId === scriptId) {
        this.deleteAnalysis(analysisId);
      }
    }
  }

  deleteAnalysis(analysisId: string): void {
    this.analysisRuns.delete(analysisId);
    this.entities.delete(analysisId);
    this.evidence.delete(analysisId);
    const findings = this.findings.get(analysisId) || [];
    for (const f of findings) {
      this.rewrites.delete(f.id);
    }
    this.findings.delete(analysisId);
    for (const [reportId, rep] of this.reports.entries()) {
      if (rep.analysisId === analysisId) {
        this.reports.delete(reportId);
      }
    }
  }

  // Cleanup for sensitive data lifecycle
  cleanupScreenplay(scriptId: string): void {
    this.screenplays.delete(scriptId);
  }

  clearAll(): void {
    this.projects.clear();
    this.scripts.clear();
    this.screenplays.clear();
    this.analysisRuns.clear();
    this.findings.clear();
    this.entities.clear();
    this.rewrites.clear();
    this.evidence.clear();
    this.reports.clear();
  }
}

export const tempStore = new IngestionStore();
