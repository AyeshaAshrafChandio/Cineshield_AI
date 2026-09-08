import { GoogleGenAI } from '@google/genai';
import { NotConfiguredError } from '../errors/AppError';
import { secretsManager } from '../security/secrets';

export const GEMINI_MODEL = secretsManager.getSecret('GEMINI_MODEL') || 'gemini-3.6-flash';

/**
 * Validates if a valid GEMINI_API_KEY is configured in the environment or secrets manager
 */
export function isGeminiConfigured(): boolean {
  const key = secretsManager.getSecret('GEMINI_API_KEY');
  return Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
}

let cachedClient: GoogleGenAI | null = null;

/**
 * Returns an authorized GoogleGenAI client singleton for server-side processing
 */
export function getGeminiClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new NotConfiguredError(
      'Gemini API',
      'Gemini integration not configured. Please set GEMINI_API_KEY in your environment or the Settings > Secrets panel.'
    );
  }

  const apiKey = secretsManager.getSecret('GEMINI_API_KEY')!;

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return cachedClient;
}

/**
 * Safe execution wrapper for Gemini API calls with timeout, bounded retries, and exponential backoff
 */
export async function callGeminiWithRetry<T>(
  fn: (ai: GoogleGenAI) => Promise<T>,
  options: {
    maxRetries?: number;
    timeoutMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 30000;
  const opName = options.operationName ?? 'Gemini API call';

  const ai = getGeminiClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wrap operation with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`${opName} timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
        // Ensure timer doesn't keep node process alive
        if (typeof timer.unref === 'function') timer.unref();
      });

      const result = await Promise.race([fn(ai), timeoutPromise]);
      return result;
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.status === 429 ||
        err?.status === 503 ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('timed out');

      if (attempt < maxRetries && isTransient) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
