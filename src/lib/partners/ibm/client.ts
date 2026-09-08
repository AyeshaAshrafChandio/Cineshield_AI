import { z } from 'zod';
import { IbmConfig, IbmIamTokenResponse, WatsonxGenerationResponse } from './types';
import { getIbmConfig } from './config';

export class IbmError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'IbmError';
  }
}

export class IbmConfigError extends IbmError {
  constructor(message = 'IBM partner integration credentials are not configured.') {
    super(message, 'IBM_NOT_CONFIGURED');
    this.name = 'IbmConfigError';
  }
}

export class IbmAuthError extends IbmError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'IBM_AUTH_ERROR');
    this.name = 'IbmAuthError';
  }
}

export class IbmTimeoutError extends IbmError {
  constructor(message = 'IBM API request timed out.') {
    super(message, 'IBM_TIMEOUT');
    this.name = 'IbmTimeoutError';
  }
}

export class IbmApiError extends IbmError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message, 'IBM_API_ERROR');
    this.name = 'IbmApiError';
  }
}

const iamResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().optional().default(3600),
  expiration: z.number().optional(),
});

const watsonxResponseSchema = z.object({
  model_id: z.string().optional().default('ibm-model'),
  created_at: z.string().optional().default(() => new Date().toISOString()),
  results: z
    .array(
      z.object({
        generated_text: z.string().default(''),
        generated_token_count: z.number().optional(),
        input_token_count: z.number().optional(),
        stop_reason: z.string().optional(),
      })
    )
    .default([]),
});

/**
 * IBM Watson / Cloud HTTP Client
 * Manages IAM authentication token lifecycle, request execution, timeouts,
 * retries, and structured error responses.
 */
export class IbmClient {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configProvider: () => IbmConfig | null = getIbmConfig) {}

  /**
   * Resets cached IAM token (used when invalid token received or in tests)
   */
  clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Acquires a valid IBM Cloud IAM access token using the configured API key.
   * Exchanges API key with https://iam.cloud.ibm.com/identity/token.
   */
  async getAccessToken(): Promise<string> {
    const config = this.configProvider();
    if (!config) {
      throw new IbmConfigError();
    }

    const now = Date.now();
    // Cache token with 60-second buffer
    if (this.cachedToken && this.tokenExpiresAt > now + 60_000) {
      return this.cachedToken;
    }

    const tokenUrl = 'https://iam.cloud.ibm.com/identity/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
    params.append('apikey', config.apiKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errBody: string;
        try {
          errBody = await response.text();
        } catch {
          errBody = '';
        }

        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new IbmAuthError(
            `IBM Cloud IAM authentication failed with status ${response.status}. Please verify your IBM API key.`,
            response.status
          );
        }

        throw new IbmApiError(
          `IBM IAM token service returned error ${response.status}`,
          response.status,
          errBody
        );
      }

      const rawJson = await response.json();
      const parsed = iamResponseSchema.safeParse(rawJson);
      if (!parsed.success) {
        throw new IbmApiError('Malformed response received from IBM Cloud IAM service.', 502);
      }

      const tokenData: IbmIamTokenResponse = {
        access_token: parsed.data.access_token,
        token_type: parsed.data.token_type,
        expires_in: parsed.data.expires_in,
        expiration: parsed.data.expiration || Math.floor(now / 1000) + parsed.data.expires_in,
      };

      this.cachedToken = tokenData.access_token;
      this.tokenExpiresAt = tokenData.expiration * 1000;
      return this.cachedToken;
    } catch (err: unknown) {
      if (err instanceof IbmError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new IbmTimeoutError('IBM IAM authentication request timed out.');
      }
      throw new IbmAuthError(
        `Failed to communicate with IBM IAM service: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Queries IBM watsonx Foundation Model text generation endpoint.
   */
  async generateText(prompt: string): Promise<WatsonxGenerationResponse> {
    const config = this.configProvider();
    if (!config) {
      throw new IbmConfigError();
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= config.maxRetries) {
      attempt++;
      try {
        const token = await this.getAccessToken();
        const endpoint = `${config.serviceUrl}/ml/v1/text/generation?version=2023-05-29`;

        const payload = {
          input: prompt,
          parameters: {
            decoding_method: 'greedy',
            max_new_tokens: 350,
            min_new_tokens: 1,
            temperature: 0.0,
          },
          model_id: config.modelId,
          project_id: config.projectId,
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } catch (fetchErr: unknown) {
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            throw new IbmTimeoutError('IBM watsonx API request timed out.');
          }
          throw fetchErr;
        } finally {
          clearTimeout(timer);
        }

        if (response.status === 401 || response.status === 403) {
          // Token might have been invalidated, clear cache and retry once
          this.clearTokenCache();
          if (attempt <= config.maxRetries) {
            continue;
          }
          throw new IbmAuthError(
            `IBM watsonx authorization failed (status ${response.status}).`,
            response.status
          );
        }

        if (!response.ok) {
          let errText = '';
          try {
            errText = await response.text();
          } catch {
            // Ignore text read error
          }

          if ((response.status === 429 || response.status >= 500) && attempt <= config.maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 250;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          throw new IbmApiError(
            `IBM watsonx API returned HTTP ${response.status}`,
            response.status,
            errText
          );
        }

        const rawJson = await response.json();
        const parsed = watsonxResponseSchema.safeParse(rawJson);
        if (!parsed.success) {
          throw new IbmApiError('Malformed JSON payload received from IBM watsonx service.', 502);
        }

        return parsed.data;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError instanceof IbmAuthError || lastError instanceof IbmConfigError) {
          throw lastError;
        }

        if (attempt > config.maxRetries) {
          break;
        }
        const backoffMs = Math.pow(2, attempt) * 200;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || new IbmApiError('IBM watsonx request failed after retries.', 500);
  }
}

export const ibmClient = new IbmClient();
