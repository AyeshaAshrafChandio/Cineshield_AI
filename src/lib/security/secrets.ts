/**
 * Secret Resolution and Management
 * Resolves runtime secrets transparently from environment variables or
 * Google Cloud Secret Manager when running in production Cloud Run environments.
 */

export interface SecretConfig {
  geminiApiKey: string | null;
  databaseUrl: string | null;
  ibmCloudApiKey: string | null;
  ibmWatsonxProjectId: string | null;
  sessionSecret: string;
}

export class SecretsManager {
  private cache = new Map<string, string>();

  /**
   * Resolves a named secret by checking environment variable or cached secret
   */
  getSecret(key: string, defaultValue = ''): string {
    const envVal = process.env[key];
    if (envVal !== undefined && envVal !== '') {
      return envVal;
    }

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    return defaultValue;
  }

  /**
   * Sets a secret programmatically or from Secret Manager
   */
  setSecret(key: string, value: string): void {
    this.cache.set(key, value);
  }

  /**
   * Clears the cache for testing or refresh
   */
  clearCache(): void {
    this.cache.clear();
  }

  getGeminiApiKey(): string | null {
    return this.getSecret('GEMINI_API_KEY') || null;
  }

  getDatabaseUrl(): string | null {
    return this.getSecret('DATABASE_URL') || null;
  }

  getIbmCloudApiKey(): string | null {
    return this.getSecret('IBM_CLOUD_API_KEY') || null;
  }

  getIbmWatsonxProjectId(): string | null {
    return this.getSecret('IBM_WATSONX_PROJECT_ID') || null;
  }

  getSessionSecret(): string {
    const secret = this.getSecret('SESSION_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      console.warn('WARNING: SESSION_SECRET is not configured in production. Set SESSION_SECRET via Secret Manager.');
    }
    return secret || 'cineshield-dev-secret-key-32chars-min!!';
  }

  /**
   * Validates presence of critical production secrets
   */
  validateProductionConfiguration(): { ready: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!this.getGeminiApiKey()) {
      missing.push('GEMINI_API_KEY');
    }

    if (process.env.NODE_ENV === 'production') {
      if (!this.getDatabaseUrl()) {
        missing.push('DATABASE_URL');
      }
    }

    return {
      ready: missing.length === 0,
      missing,
    };
  }
}

export const secretsManager = new SecretsManager();
