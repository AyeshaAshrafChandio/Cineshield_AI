import { z } from 'zod';

export const uuidSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID' });

export const startAnalysisSchema = z.object({
  scriptId: uuidSchema,
});

export const rewriteRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(2000).optional(),
  userPrompt: z.string().min(1).max(2000).optional(),
  targetRiskCategory: z.string().max(100).optional(),
  instructions: z.string().max(1000).optional(),
});

export const projectParamsSchema = z.object({
  id: uuidSchema,
});

export const analysisParamsSchema = z.object({
  id: uuidSchema,
});

export const findingsParamsSchema = z.object({
  id: uuidSchema,
});

export const reportParamsSchema = z.object({
  id: uuidSchema,
});
