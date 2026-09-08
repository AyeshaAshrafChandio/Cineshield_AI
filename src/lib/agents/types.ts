import { ScreenplayScene, ScreenplayElement } from '../../types/screenplay';

export type EntityType =
  | 'CHARACTER'
  | 'BRAND'
  | 'PRODUCT'
  | 'ORGANIZATION'
  | 'FICTIONAL_UNIVERSE'
  | 'PERSON'
  | 'LOCATION'
  | 'OTHER';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DetectedEntity {
  id: string;
  entity: string;
  type: EntityType;
  sourceText: string;
  location: string;
  sceneId: string;
  elementId: string;
  startOffset: number;
  endOffset: number;
  confidence: number; // 0.0 - 1.0
  occurrencesCount: number;
}

export interface PartnerEvidenceResult {
  provider?: string;
  entity: string;
  entityId: string;
  isAvailable: boolean;
  source: string;
  matches: Array<{
    title: string;
    registrationNumber?: string;
    owner?: string;
    sourceUrl?: string;
    similarityScore?: number;
    details?: string;
  }>;
  evidence: string[];
  notes: string;
  retrievedAt?: string;
}

export interface RiskAnalysisResult {
  entityId: string;
  entityName: string;
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  category: string;
  reason: string;
  evidence: string[];
  concerns: string[];
  recommendedAction: string;
  requiresHumanReview: boolean;
  confidence: number; // 0.0 - 1.0
  observedContext: string;
  sceneId?: string;
  elementId?: string;
  startOffset?: number;
  endOffset?: number;
  location?: string;
}

export interface CreativeRewriteAlternative {
  text: string;
  explanation: string;
  preservedIntent: string;
  changes: string[];
}

export interface CreativeRewriteResponse {
  findingId: string;
  originalText: string;
  alternatives: CreativeRewriteAlternative[];
  disclaimer: string;
}

export interface ParsedScreenplayContext {
  title: string;
  scenes: ScreenplayScene[];
  characters: string[];
  locations: string[];
  totalElements: number;
  estimatedDurationMinutes: number;
}

export interface OverallRiskSummary {
  overallRiskScore: number; // 0 - 100
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalEntities: number;
  scoringRationale: string;
}

export interface AgentExecutionStats {
  analysisId: string;
  totalModelCalls: number;
  totalEntitiesDetected: number;
  totalFindingsGenerated: number;
  durationMs: number;
  stagesCompleted: string[];
}
