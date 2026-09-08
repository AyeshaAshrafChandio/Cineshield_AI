import { EntityType, RiskLevel, OverallRiskSummary, RiskAnalysisResult } from './types';

export interface RubricConfig {
  baseWeights: Record<EntityType, number>;
  thresholds: {
    high: number;
    medium: number;
  };
}

export const DEFAULT_RUBRIC_CONFIG: RubricConfig = {
  baseWeights: {
    FICTIONAL_UNIVERSE: 30,
    BRAND: 25,
    PRODUCT: 20,
    CHARACTER: 20,
    ORGANIZATION: 15,
    PERSON: 15,
    LOCATION: 10,
    OTHER: 10,
  },
  thresholds: {
    high: 65,
    medium: 35,
  },
};

/**
 * Deterministic scoring rubric for CineShield AI
 * Provides transparent, reproducible calculations for individual finding severity
 * and project-level aggregate clearance risk.
 */
export class ScoringRubric {
  constructor(private config: RubricConfig = DEFAULT_RUBRIC_CONFIG) {}

  /**
   * Evaluates categorical risk level based on quantitative score (0 - 100)
   */
  getRiskLevel(score: number): RiskLevel {
    if (score >= this.config.thresholds.high) return 'HIGH';
    if (score >= this.config.thresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Applies deterministic validation and clamping to model risk score
   */
  normalizeScore(rawScore: number, entityType: EntityType, confidence: number): number {
    const base = this.config.baseWeights[entityType] || 10;
    // Ensure raw score is within 0..100
    let score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Scale slightly by detection confidence
    const confFactor = Math.max(0.6, Math.min(1.0, confidence));
    score = Math.round(score * confFactor + base * (1 - confFactor));

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Deterministic project-level risk aggregation
   *
   * Formula:
   * 1. If 0 findings: score = 0
   * 2. Highest finding severity: 60% weight
   * 3. Average finding severity: 35% weight
   * 4. Multi-finding frequency boost: +2 points per additional high-risk finding (capped at +10)
   * 5. Clamped strictly between 0 and 100
   */
  calculateProjectSummary(findings: RiskAnalysisResult[], totalEntities: number): OverallRiskSummary {
    if (!findings || findings.length === 0) {
      return {
        overallRiskScore: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalEntities,
        scoringRationale: 'Screening heuristic found no flagged IP or clearance concerns across analyzed entities.',
      };
    }

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let maxScore = 0;
    let totalScore = 0;

    for (const f of findings) {
      if (f.riskLevel === 'HIGH') highCount++;
      else if (f.riskLevel === 'MEDIUM') mediumCount++;
      else lowCount++;

      if (f.riskScore > maxScore) maxScore = f.riskScore;
      totalScore += f.riskScore;
    }

    const avgScore = totalScore / findings.length;
    const frequencyBoost = Math.min(10, Math.max(0, (highCount - 1) * 2));

    const aggregateScore = Math.min(
      100,
      Math.max(0, Math.round(maxScore * 0.6 + avgScore * 0.35 + frequencyBoost))
    );

    const rationale =
      `Deterministic screening aggregation: Top finding (${maxScore}/100, 60% weight) combined with average severity ` +
      `(${avgScore.toFixed(1)}/100, 35% weight) across ${findings.length} findings (${highCount} high, ${mediumCount} medium, ${lowCount} low). ` +
      `AI screening indicator only; human legal counsel review is recommended.`;

    return {
      overallRiskScore: aggregateScore,
      highRiskCount: highCount,
      mediumRiskCount: mediumCount,
      lowRiskCount: lowCount,
      totalEntities,
      scoringRationale: rationale,
    };
  }
}

export const scoringRubric = new ScoringRubric();
