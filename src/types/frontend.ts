export type PageId =
  | 'projects'
  | 'dashboard'
  | 'forensics'
  | 'archive'
  | 'system-status'
  | 'admin'
  | 'profile'
  | 'team';

export interface ProjectSummary {
  id: string;
  title: string;
  studio?: string;
  stage?: string;
  status: 'SCANNING' | 'VIOLATION' | 'COMPLIANT' | 'UNDER REVIEW';
  riskScore: number | null;
  assetsAnalyzed?: string;
  estCompletion?: string;
  description?: string;
  flaggedAssets?: string;
  lastScan?: string;
  criticalMatch?: string;
  scriptId?: string;
  latestAnalysisId?: string;
}
