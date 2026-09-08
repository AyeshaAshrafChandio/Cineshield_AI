import { z } from 'zod';
import {
  PartnerEvidenceProvider,
  NormalizedPartnerEvidence,
  EntityLookupPayload,
  IbmEvidenceMatch,
} from './types';
import { isIbmConfigured } from './config';
import { ibmClient, IbmClient } from './client';

const watsonxEntityVerificationSchema = z.object({
  hasKnownTrademark: z.boolean().default(false),
  registeredOwner: z.string().nullable().optional(),
  trademarkClass: z.string().nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  isFictionalOrCelebrity: z.boolean().default(false),
  notes: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.5),
});

/**
 * IBM Partner Evidence Adapter
 *
 * Implements the generic PartnerEvidenceProvider interface.
 * When IBM credentials are provided, queries IBM watsonx foundation models
 * for trademark and corporate ownership verification.
 *
 * When credentials are not configured, accurately reports unconfigured status
 * without fabricating external registry records.
 */
export class IbmPartnerEvidenceAdapter implements PartnerEvidenceProvider {
  readonly providerName = 'IBM watsonx Foundation Models (Partner Evidence)';

  constructor(private readonly client: IbmClient = ibmClient) {}

  isConfigured(): boolean {
    return isIbmConfigured();
  }

  async lookupEntity(entity: EntityLookupPayload): Promise<NormalizedPartnerEvidence> {
    if (!this.isConfigured()) {
      return {
        provider: 'IBM watsonx',
        entity: entity.entity,
        entityId: entity.id,
        isAvailable: false,
        source: 'IBM watsonx (Unconfigured)',
        matches: [],
        evidence: [],
        notes:
          'IBM watsonx partner credentials are not configured. External registry verification was not performed. No external trademark or copyright registry records were queried or fabricated.',
        retrievedAt: new Date().toISOString(),
      };
    }

    try {
      // Construct targeted verification prompt with minimal contextual data (never transmitting full screenplay)
      const prompt = `[PROMPT]
Verify factual trademark or corporate brand existence for the following entity:
Entity Name: "${entity.entity}"
Entity Type: ${entity.type}
Script Excerpt: "${entity.sourceText.substring(0, 150)}"

Respond ONLY with valid JSON in this format:
{
  "hasKnownTrademark": true or false,
  "registeredOwner": "Company name or null",
  "trademarkClass": "e.g. Class 32: Beverages or null",
  "jurisdiction": "e.g. USPTO / Global or null",
  "isFictionalOrCelebrity": true or false,
  "notes": "Brief factual summary of brand or status",
  "confidence": 0.0 to 1.0
}
[/PROMPT]
[JSON]`;

      const response = await this.client.generateText(prompt);
      const generatedText = response.results?.[0]?.generated_text?.trim() || '';

      // Clean markdown code blocks if present
      let rawJson = generatedText;
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawJson = jsonMatch[0];
      }

      let parsed: unknown = {};
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        // If watsonx returned non-JSON text, treat as notes without fabricating false matches
        return {
          provider: 'IBM watsonx',
          entity: entity.entity,
          entityId: entity.id,
          isAvailable: true,
          source: 'IBM watsonx.ai',
          matches: [],
          evidence: generatedText ? [generatedText.substring(0, 300)] : [],
          notes: 'IBM watsonx returned unstructured text analysis.',
          retrievedAt: new Date().toISOString(),
        };
      }

      const validated = watsonxEntityVerificationSchema.safeParse(parsed);
      if (!validated.success) {
        return {
          provider: 'IBM watsonx',
          entity: entity.entity,
          entityId: entity.id,
          isAvailable: true,
          source: 'IBM watsonx.ai',
          matches: [],
          evidence: [],
          notes: 'IBM watsonx response did not match structured clearance format.',
          retrievedAt: new Date().toISOString(),
        };
      }

      const data = validated.data;
      const matches: IbmEvidenceMatch[] = [];
      const evidenceLines: string[] = [];

      if (data.hasKnownTrademark && data.registeredOwner) {
        matches.push({
          title: `${entity.entity} (Verified Brand/Entity)`,
          owner: data.registeredOwner,
          details: data.notes || `Owner: ${data.registeredOwner}. Jurisdiction: ${data.jurisdiction || 'Global'}`,
          similarityScore: data.confidence,
        });
        evidenceLines.push(
          `IBM watsonx verification: Corporate owner identified as "${data.registeredOwner}". ${data.notes || ''}`
        );
      } else if (data.notes) {
        evidenceLines.push(`IBM watsonx note: ${data.notes}`);
      }

      return {
        provider: 'IBM watsonx',
        entity: entity.entity,
        entityId: entity.id,
        isAvailable: true,
        source: 'IBM watsonx.ai',
        matches,
        evidence: evidenceLines,
        notes: matches.length > 0
          ? `Verified trademark entity via IBM watsonx (${matches.length} record(s) found).`
          : 'IBM watsonx queried; no registered trademark conflict or corporate IP flag identified for this entity.',
        retrievedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        provider: 'IBM watsonx',
        entity: entity.entity,
        entityId: entity.id,
        isAvailable: false,
        source: 'IBM watsonx (Error)',
        matches: [],
        evidence: [],
        notes: `IBM watsonx partner query failed: ${errorMessage}. Analysis proceeding without external partner evidence.`,
        retrievedAt: new Date().toISOString(),
      };
    }
  }
}

export const ibmPartnerEvidenceAdapter = new IbmPartnerEvidenceAdapter();
