import { IbmConfig } from './types';
import { secretsManager } from '../../security/secrets';

/**
 * IBM Integration Configuration Loader
 * Retrieves and validates credentials from environment variables or secrets manager.
 * Never hardcodes credentials or sensitive access tokens.
 */
export function getIbmConfig(): IbmConfig | null {
  const apiKey =
    secretsManager.getSecret('IBM_CLOUD_API_KEY') ||
    secretsManager.getSecret('IBM_API_KEY') ||
    secretsManager.getSecret('IBM_BOB_API_KEY');

  const projectId =
    secretsManager.getSecret('IBM_WATSONX_PROJECT_ID') ||
    secretsManager.getSecret('IBM_PROJECT_ID');

  if (!apiKey || apiKey.trim() === '' || !projectId || projectId.trim() === '') {
    return null;
  }

  const serviceUrl =
    secretsManager.getSecret('IBM_WATSONX_SERVICE_URL') ||
    secretsManager.getSecret('IBM_SERVICE_URL') ||
    'https://us-south.ml.cloud.ibm.com';

  const modelId =
    secretsManager.getSecret('IBM_WATSONX_MODEL_ID') ||
    secretsManager.getSecret('IBM_MODEL_ID') ||
    'ibm/granite-13b-chat-v2';

  const timeoutEnv = secretsManager.getSecret('IBM_REQUEST_TIMEOUT_MS');
  const requestTimeoutMs = timeoutEnv && !isNaN(Number(timeoutEnv))
    ? Math.max(1000, Math.min(30000, Number(timeoutEnv)))
    : 8000;

  const retriesEnv = secretsManager.getSecret('IBM_MAX_RETRIES');
  const maxRetries = retriesEnv && !isNaN(Number(retriesEnv))
    ? Math.max(0, Math.min(5, Number(retriesEnv)))
    : 2;

  return {
    apiKey: apiKey.trim(),
    projectId: projectId.trim(),
    serviceUrl: serviceUrl.replace(/\/+$/, '').trim(),
    modelId: modelId.trim(),
    requestTimeoutMs,
    maxRetries,
  };
}

export function isIbmConfigured(): boolean {
  return getIbmConfig() !== null;
}
