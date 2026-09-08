import { z } from 'zod';
import { Type } from '@google/genai';
import { DetectedEntity, PartnerEvidenceResult, RiskAnalysisResult, RiskLevel } from './types';
import { GEMINI_MODEL, callGeminiWithRetry } from './geminiClient';
import { scoringRubric } from './scoringRubric';
import { ValidationError } from '../errors/AppError';

export const rawRiskResponseSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  category: z.string().default('IP_TRADEMARK'),
  reason: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  recommendedAction: z.string().min(1),
  requiresHumanReview: z.boolean().default(true),
  confidence: z.number().min(0).max(1).default(0.85),
});

/**
 * Gemini Risk Analysis Agent
 * Analyzes detected IP entities within their specific screenplay narrative context.
 * Evaluates trademark, copyright, character distinctiveness, consumer confusion,
 * and publicity rights concerns.
 */
export class RiskAnalysisAgent {
  /**
   * Analyzes an individual entity with its screenplay context and external partner evidence
   */
  async analyzeEntity(
    entity: DetectedEntity,
    sceneContext: string,
    partnerEvidence?: PartnerEvidenceResult
  ): Promise<RiskAnalysisResult> {
    let evidenceSummary = '';
    if (partnerEvidence?.isAvailable) {
      if (partnerEvidence.matches.length > 0) {
        evidenceSummary = `External Partner Evidence (${partnerEvidence.provider || 'IBM watsonx'}): ${JSON.stringify(partnerEvidence.matches)}. Notes: ${partnerEvidence.notes}`;
      } else {
        evidenceSummary = `External Partner Evidence (${partnerEvidence.provider || 'IBM watsonx'}): Queried, but no conflicting trademark records returned. IMPORTANT: Absence of an external registry record does NOT mean the entity is legally safe or cleared. Evaluate the screenplay narrative context independently.`;
      }
    } else {
      evidenceSummary = `External Partner Evidence: Unavailable (${partnerEvidence?.notes || 'External partner registry not configured'}). IMPORTANT: Absence of partner evidence does NOT imply absence of risk. You must evaluate clearance risk based on narrative screenplay context.`;
    }

    return await callGeminiWithRetry(
      async (ai) => {
        const prompt = `Analyze the intellectual property and clearance risk for the following entity detected in the screenplay:

Entity: "${entity.entity}"
Classified Type: ${entity.type}
Screenplay Excerpt / Occurrence: "${entity.sourceText}"
Scene Context:
"""
${sceneContext}
"""

${evidenceSummary}

Evaluate potential:
1. Trademark concern (commercial brands, slogans, consumer confusion)
2. Copyright concern (distinctive fictional characters, fictional universes, protected literary/audiovisual elements)
3. Right of publicity (living celebrities, public figures)
4. Contextual usage (incidental background reference, transformative use, parody, vs prominently featured subject)
5. Public domain status (if applicable)

Return strict JSON conforming to the schema.`;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ text: prompt }],
          config: {
            systemInstruction: `You are CineShield AI's specialized IP Risk Analysis Agent.

LEGAL SAFETY GUARDRAILS (STRICT COMPLIANCE REQUIRED):
- CineShield AI is an automated IP-risk pre-screening and legal advisory assistant for entertainment productions.
- CineShield AI is NOT a law firm, attorney, or definitive copyright/trademark registration authority.
- NEVER state "this is definitely infringement", "this is legally cleared", or "this is guaranteed non-infringing".
- ALWAYS use careful, legally sound advisory phrasing: "potential risk", "possible clearance concern", "advisory recommendation", "requires human legal review", "preliminary screening heuristic".
- Keep external evidence strictly factual. If no external partner database is configured, explicitly state that external registry verification was not performed.
- NO EVIDENCE ≠ NO RISK: Absence of external partner evidence or empty registry matches does NOT mean an entity is free of risk. You must evaluate inherent IP risks based on narrative screenplay context.

Scoring Guidelines:
- HIGH (65-100): Clear trademark or distinctive fictional character usage without apparent fair use, prominent commercial branding, potential consumer confusion.
- MEDIUM (35-64): Recognizable brand, product, or organization mentioned casually in dialogue; potential clearance inquiry needed.
- LOW (0-34): Common name, historical figure, descriptive language, or incidental generic terminology.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                riskScore: {
                  type: Type.INTEGER,
                  description: 'Quantitative IP risk score from 0 to 100.',
                },
                riskLevel: {
                  type: Type.STRING,
                  enum: ['LOW', 'MEDIUM', 'HIGH'],
                  description: 'Categorical risk level.',
                },
                category: {
                  type: Type.STRING,
                  description: 'Primary risk category (e.g. IP_TRADEMARK, COPYRIGHT, RIGHT_OF_PUBLICITY).',
                },
                reason: {
                  type: Type.STRING,
                  description: 'Detailed analysis explaining the identified clearance or IP consideration.',
                },
                evidence: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Factual observations from the script and external sources.',
                },
                concerns: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of specific potential legal or clearance vulnerabilities.',
                },
                recommendedAction: {
                  type: Type.STRING,
                  description: 'Actionable next steps (e.g. obtain clearance, consult production legal, rewrite dialogue).',
                },
                requiresHumanReview: {
                  type: Type.BOOLEAN,
                  description: 'Whether human entertainment counsel review is advised.',
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Model evaluation confidence between 0.0 and 1.0.',
                },
              },
              required: [
                'riskScore',
                'riskLevel',
                'category',
                'reason',
                'evidence',
                'concerns',
                'recommendedAction',
                'requiresHumanReview',
                'confidence',
              ],
            },
            temperature: 0.15,
          },
        });

        const rawJson = response.text?.trim() || '{}';
        let parsed: unknown;
        try {
          const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
          parsed = JSON.parse(cleanJson);
        } catch (err) {
          throw new ValidationError(`Malformed JSON received from Gemini Risk Analysis: ${rawJson.substring(0, 100)}`);
        }

        const validated = rawRiskResponseSchema.safeParse(parsed);
        if (!validated.success) {
          throw new ValidationError(`Risk analysis schema validation failed: ${validated.error.issues.map((i) => i.message).join(', ')}`);
        }

        const data = validated.data;
        // Centralized deterministic rubric normalization
        const normalizedScore = scoringRubric.normalizeScore(data.riskScore, entity.type, entity.confidence);
        const normalizedLevel: RiskLevel = scoringRubric.getRiskLevel(normalizedScore);

        return {
          entityId: entity.id,
          entityName: entity.entity,
          riskScore: normalizedScore,
          riskLevel: normalizedLevel,
          category: data.category,
          reason: data.reason,
          evidence: data.evidence.length > 0
            ? data.evidence
            : [`Observed occurrence in screenplay: "${entity.sourceText}"`],
          concerns: data.concerns,
          recommendedAction: data.recommendedAction,
          requiresHumanReview: data.requiresHumanReview,
          confidence: data.confidence,
          observedContext: entity.sourceText,
          sceneId: entity.sceneId,
          elementId: entity.elementId,
          startOffset: entity.startOffset,
          endOffset: entity.endOffset,
          location: entity.location,
        };
      },
      { operationName: `Risk analysis for ${entity.entity}`, maxRetries: 2, timeoutMs: 40000 }
    );
  }

  /**
   * Evaluates a collection of entities in parallel batches
   */
  async analyzeEntitiesBatch(
    entities: DetectedEntity[],
    sceneContextMap: Map<string, string>,
    evidenceMap: Map<string, PartnerEvidenceResult>
  ): Promise<RiskAnalysisResult[]> {
    const results: RiskAnalysisResult[] = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      const promises = batch.map((entity) => {
        const sceneContext = sceneContextMap.get(entity.sceneId) || entity.sourceText;
        const evidence = evidenceMap.get(entity.id);
        return this.analyzeEntity(entity, sceneContext, evidence);
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }
}

export const riskAnalysisAgent = new RiskAnalysisAgent();
