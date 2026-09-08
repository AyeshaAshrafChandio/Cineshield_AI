import { z } from 'zod';
import { Type } from '@google/genai';
import { CreativeRewriteAlternative, CreativeRewriteResponse } from './types';
import { GEMINI_MODEL, callGeminiWithRetry } from './geminiClient';
import { ValidationError } from '../errors/AppError';

export const rewriteAlternativeSchema = z.object({
  text: z.string().min(1),
  explanation: z.string().min(1),
  preservedIntent: z.string().min(1),
  changes: z.array(z.string()).min(1),
});

export const rewriteAgentResponseSchema = z.object({
  alternatives: z.array(rewriteAlternativeSchema).length(3),
});

/**
 * Gemini Creative Rewrite Agent
 * Generates clearance-safe creative rewrites for flagged dialogue and action elements
 * while preserving narrative tension, character voice, and dramatic intent.
 */
export class CreativeRewriteAgent {
  /**
   * Generates exactly 3 creative alternatives for a flagged screenplay element
   */
  async generateRewrites(params: {
    findingId: string;
    originalText: string;
    entityName?: string;
    riskCategory?: string;
    sceneHeading?: string;
    characterName?: string;
    userPrompt?: string;
  }): Promise<CreativeRewriteResponse> {
    const {
      findingId,
      originalText,
      entityName = 'Flagged Element',
      riskCategory = 'IP Clearance',
      sceneHeading = 'Current Scene',
      characterName,
      userPrompt,
    } = params;

    const characterContext = characterName ? `Character Speaking: ${characterName}` : 'Narrative Action / Scene Element';
    const guidancePrompt = userPrompt ? `Additional Writer Guidance: "${userPrompt}"` : '';

    return await callGeminiWithRetry(
      async (ai) => {
        const prompt = `You are tasked with providing creative clearance-safe rewrites for a flagged screenplay passage.

Screenplay Context:
Scene: ${sceneHeading}
${characterContext}
Flagged IP Reference: "${entityName}" (${riskCategory})
Original Text:
"""
${originalText}
"""
${guidancePrompt}

TASK:
Generate EXACTLY THREE (3) distinct creative script alternatives that:
1. Replace or remove the flagged intellectual property / brand / protected entity.
2. Maintain the scene's emotional beat, comedic timing, dramatic stakes, and narrative velocity.
3. Preserve the character's voice and authentic dialogue rhythm.
4. Provide a creative in-universe substitute (e.g. plausible fictional equivalent, generic descriptive action, or fresh comedic invention).

For each alternative provide:
- text: The replacement script line or action block.
- explanation: Why this alternative effectively resolves the clearance concern.
- preservedIntent: How the underlying dramatic or narrative beat was kept intact.
- changes: An array of specific modifications made from the original.

Return strict JSON containing an "alternatives" array with exactly 3 items.`;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ text: prompt }],
          config: {
            systemInstruction: `You are CineShield AI's specialized Creative Rewrite Agent.
Your role is to assist screenwriters in substituting trademarked, copyrighted, or clearance-risky elements with legally safer, compelling creative alternatives.
LEGAL NOTICE: Never state or imply that any alternative is guaranteed legally safe or non-infringing. All suggestions are creative options requiring standard production clearance review.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                alternatives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: 'The rewritten screenplay dialogue or action line.',
                      },
                      explanation: {
                        type: Type.STRING,
                        description: 'Clearance explanation and rationale for the replacement.',
                      },
                      preservedIntent: {
                        type: Type.STRING,
                        description: 'Explanation of how dramatic beats and character voice were preserved.',
                      },
                      changes: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Summary of alterations made.',
                      },
                    },
                    required: ['text', 'explanation', 'preservedIntent', 'changes'],
                  },
                },
              },
              required: ['alternatives'],
            },
            temperature: 0.35, // Balanced creativity and discipline
          },
        });

        const rawJson = response.text?.trim() || '{}';
        let parsed: unknown;
        try {
          const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
          parsed = JSON.parse(cleanJson);
        } catch (err) {
          throw new ValidationError(`Malformed JSON received from Creative Rewrite Agent: ${rawJson.substring(0, 100)}`);
        }

        const validated = rewriteAgentResponseSchema.safeParse(parsed);
        if (!validated.success) {
          throw new ValidationError(
            `Rewrite output validation failed: ${validated.error.issues.map((i) => i.message).join(', ')}`
          );
        }

        const disclaimer =
          'CineShield AI creative alternatives are AI-generated suggestions provided for writer assistance and do not constitute formal clearance or legal immunity.';

        return {
          findingId,
          originalText,
          alternatives: validated.data.alternatives,
          disclaimer,
        };
      },
      { operationName: `Creative rewrite for finding ${findingId}`, maxRetries: 2, timeoutMs: 35000 }
    );
  }
}

export const creativeRewriteAgent = new CreativeRewriteAgent();
