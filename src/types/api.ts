import { NormalizedScreenplay } from './screenplay';

export type AnalysisStatus =
  | 'queued'
  | 'uploading'
  | 'parsing'
  | 'extracting_entities'
  | 'partner_analysis'
  | 'risk_analysis'
  | 'generating_recommendations'
  | 'complete'
  | 'failed';

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  [key: string]: unknown;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export interface ScriptUploadResponse {
  success: true;
  scriptId: string;
  projectId: string;
  fileName: string;
  fileType: 'pdf' | 'txt' | 'fountain';
  status: 'uploaded';
}

export interface StartAnalysisResponse {
  success: true;
  analysisId: string;
  status: AnalysisStatus;
}

export interface AnalysisStatusResponse {
  success: true;
  analysisId: string;
  scriptId: string;
  projectId: string;
  status: AnalysisStatus;
  progress: number;
  stageMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export interface ProjectInfoResponse {
  success: true;
  project: {
    id: string;
    title: string;
    script: {
      id: string;
      fileName: string;
      fileType: string;
      title: string;
      uploadedAt: string;
    };
    uploadTimestamp: string;
    analysisStatus: AnalysisStatus | null;
    latestAnalysisId: string | null;
    overallRiskScore: number | null;
    findingsSummary: {
      high: number;
      medium: number;
      low: number;
      total: number;
    } | null;
  };
}

export interface ScreenplayDataResponse {
  success: true;
  scriptId: string;
  title: string;
  scenes: NormalizedScreenplay['scenes'];
  metadata: NormalizedScreenplay['metadata'];
}

export interface RiskFinding {
  id: string;
  analysisId: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sceneId?: string;
  elementId?: string;
  startOffset?: number;
  endOffset?: number;
  suggestedAction?: string;
  createdAt: string;
}

export interface FindingsResponse {
  success: true;
  analysisId: string;
  findings: RiskFinding[];
  total: number;
}

export interface ReportDataResponse {
  success: true;
  report: {
    reportId: string;
    projectId: string;
    analysisId: string;
    analysisTimestamp: string;
    overallRiskScore: number | null;
    entities: Array<{
      id: string;
      name: string;
      type: string;
      count: number;
    }>;
    findings: RiskFinding[];
    evidence: Array<{
      id: string;
      findingId: string;
      snippet: string;
      sceneHeading?: string;
    }>;
    recommendedActions: string[];
    creativeAlternatives: string[];
    disclaimer: string;
  };
}
