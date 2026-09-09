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

  getJwtSecret(): string | null {
    return this.getSecret('JWT_SECRET') || this.getSecret('SESSION_SECRET') || null;
  }

  getSessionSecret(): string {
    const secret = this.getJwtSecret();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'FATAL SECURITY CONFIGURATION: JWT_SECRET environment variable is missing. A secure production secret is required for cryptographic authentication.'
        );
      }
      return 'cineshield-dev-secret-key-32chars-min!!';
    }
    return secret;
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
      const hasDb = Boolean(
        this.getDatabaseUrl() ||
        (this.getSecret('SQL_HOST') && this.getSecret('SQL_USER') && this.getSecret('SQL_PASSWORD'))
      );
      if (!hasDb) {
        missing.push('SQL_CREDENTIALS');
      }
      if (!this.getJwtSecret()) {
        missing.push('JWT_SECRET');
      }
    }

    return {
      ready: missing.length === 0,
      missing,
    };
  }
}

export const secretsManager = new SecretsManager();
