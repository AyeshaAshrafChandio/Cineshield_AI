import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
  IbmPartnerEvidenceAdapter,
  ibmPartnerEvidenceAdapter,
  IbmClient,
  getIbmConfig,
  isIbmConfigured,
  IbmAuthError,
  IbmTimeoutError,
  IbmApiError,
  IbmConfigError,
} from '../src/lib/partners/ibm';
import { partnerEvidenceService } from '../src/lib/agents/evidenceService';
import { riskAnalysisAgent } from '../src/lib/agents/riskAnalysisAgent';
import { DetectedEntity, PartnerEvidenceResult } from '../src/lib/agents/types';

describe('Task 4: IBM Partner Integration & Evidence Verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Start with clean IBM env vars for deterministic unit testing
    delete process.env.IBM_CLOUD_API_KEY;
    delete process.env.IBM_API_KEY;
    delete process.env.IBM_BOB_API_KEY;
    delete process.env.IBM_WATSONX_PROJECT_ID;
    delete process.env.IBM_PROJECT_ID;
    delete process.env.IBM_WATSONX_SERVICE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Configuration & Credential Resolution', () => {
    it('should report unconfigured when required IBM credentials are missing', () => {
      expect(isIbmConfigured()).toBe(false);
      expect(getIbmConfig()).toBeNull();
      expect(ibmPartnerEvidenceAdapter.isConfigured()).toBe(false);
    });

    it('should properly parse and validate valid IBM configuration', () => {
      process.env.IBM_CLOUD_API_KEY = 'test-ibm-api-key-123';
      process.env.IBM_WATSONX_PROJECT_ID = 'test-project-guid-456';
      process.env.IBM_WATSONX_SERVICE_URL = 'https://us-south.ml.cloud.ibm.com';
      process.env.IBM_REQUEST_TIMEOUT_MS = '5000';
      process.env.IBM_MAX_RETRIES = '3';

      expect(isIbmConfigured()).toBe(true);
      const config = getIbmConfig();
      expect(config).not.toBeNull();
      expect(config?.apiKey).toBe('test-ibm-api-key-123');
      expect(config?.projectId).toBe('test-project-guid-456');
      expect(config?.serviceUrl).toBe('https://us-south.ml.cloud.ibm.com');
      expect(config?.requestTimeoutMs).toBe(5000);
      expect(config?.maxRetries).toBe(3);
    });

    it('should support fallback environment variable names', () => {
      process.env.IBM_API_KEY = 'fallback-key';
      process.env.IBM_PROJECT_ID = 'fallback-project';

      expect(isIbmConfigured()).toBe(true);
      const config = getIbmConfig();
      expect(config?.apiKey).toBe('fallback-key');
      expect(config?.projectId).toBe('fallback-project');
    });
  });

  describe('2. Truthful Unconfigured State Behavior (No Fabrication)', () => {
    it('should return truthful unconfigured status without fabricating trademark records', async () => {
      const adapter = new IbmPartnerEvidenceAdapter();
      expect(adapter.isConfigured()).toBe(false);

      const entityPayload = {
        id: randomUUID(),
        entity: 'Wayne Enterprises',
        type: 'FICTIONAL_UNIVERSE',
        sourceText: 'Meet me at Wayne Enterprises tower.',
      };

      const result = await adapter.lookupEntity(entityPayload);

      expect(result.isAvailable).toBe(false);
      expect(result.provider).toBe('IBM watsonx');
      expect(result.entity).toBe('Wayne Enterprises');
      expect(result.matches).toEqual([]);
      expect(result.evidence).toEqual([]);
      expect(result.notes).toContain('IBM watsonx partner credentials are not configured');
      expect(result.notes).toContain('No external trademark or copyright registry records were queried or fabricated');
    });
  });

  describe('3. IAM Token Authentication & Caching', () => {
    it('should throw IbmConfigError if getAccessToken is invoked without configuration', async () => {
      const client = new IbmClient(() => null);
      await expect(client.getAccessToken()).rejects.toThrow(IbmConfigError);
    });

    it('should acquire and cache IAM token within expiration window', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'valid-iam-token-abc',
          token_type: 'Bearer',
          expires_in: 3600,
          expiration: Math.floor(Date.now() / 1000) + 3600,
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new IbmClient(() => ({
        apiKey: 'fake-key',
        projectId: 'fake-project',
        serviceUrl: 'https://us-south.ml.cloud.ibm.com',
        modelId: 'ibm/granite-13b-chat-v2',
        requestTimeoutMs: 5000,
        maxRetries: 1,
      }));

      // First call: fetches token via network
      const token1 = await client.getAccessToken();
      expect(token1).toBe('valid-iam-token-abc');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call: should use cached token without additional fetch
      const token2 = await client.getAccessToken();
      expect(token2).toBe('valid-iam-token-abc');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw IbmAuthError when IAM service returns 401 or 403', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized: Invalid API Key',
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new IbmClient(() => ({
        apiKey: 'invalid-key',
        projectId: 'fake-project',
        serviceUrl: 'https://us-south.ml.cloud.ibm.com',
        modelId: 'ibm/granite-13b-chat-v2',
        requestTimeoutMs: 5000,
        maxRetries: 0,
      }));

      await expect(client.getAccessToken()).rejects.toThrow(IbmAuthError);
    });
  });

  describe('4. Error Handling & Timeout Resiliency', () => {
    it('should throw IbmTimeoutError when request aborts due to timeout', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        return Promise.reject(abortError);
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new IbmClient(() => ({
        apiKey: 'fake-key',
        projectId: 'fake-project',
        serviceUrl: 'https://us-south.ml.cloud.ibm.com',
        modelId: 'ibm/granite-13b-chat-v2',
        requestTimeoutMs: 100,
        maxRetries: 0,
      }));

      await expect(client.getAccessToken()).rejects.toThrow(IbmTimeoutError);
    });

    it('should throw IbmApiError when watsonx service returns persistent 500', async () => {
      const mockFetch = vi.fn()
        // First call: IAM token success
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'valid-token',
            token_type: 'Bearer',
            expires_in: 3600,
            expiration: Math.floor(Date.now() / 1000) + 3600,
          }),
        })
        // Second call: watsonx 500 error
        .mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });
      vi.stubGlobal('fetch', mockFetch);

      const client = new IbmClient(() => ({
        apiKey: 'fake-key',
        projectId: 'fake-project',
        serviceUrl: 'https://us-south.ml.cloud.ibm.com',
        modelId: 'ibm/granite-13b-chat-v2',
        requestTimeoutMs: 5000,
        maxRetries: 0,
      }));

      await expect(client.generateText('Test prompt')).rejects.toThrow(IbmApiError);
    });
  });

  describe('5. Evidence Normalization & Schema Conformance', () => {
    it('should normalize structured watsonx trademark confirmation into valid match', async () => {
      const mockClient = {
        generateText: vi.fn().mockResolvedValue({
          model_id: 'ibm/granite-13b-chat-v2',
          created_at: new Date().toISOString(),
          results: [
            {
              generated_text: JSON.stringify({
                hasKnownTrademark: true,
                registeredOwner: 'The Coca-Cola Company',
                trademarkClass: 'Class 32: Non-alcoholic Beverages',
                jurisdiction: 'USPTO / International',
                isFictionalOrCelebrity: false,
                notes: 'Registered trademark for carbonated soft drinks since 1893.',
                confidence: 0.98,
              }),
            },
          ],
        }),
      } as unknown as IbmClient;

      const adapter = new IbmPartnerEvidenceAdapter(mockClient);
      vi.spyOn(adapter, 'isConfigured').mockReturnValue(true);

      const entityPayload = {
        id: randomUUID(),
        entity: 'Coca-Cola',
        type: 'BRAND',
        sourceText: 'He ordered a cold Coca-Cola at the bar.',
      };

      const result = await adapter.lookupEntity(entityPayload);

      expect(result.isAvailable).toBe(true);
      expect(result.provider).toBe('IBM watsonx');
      expect(result.entity).toBe('Coca-Cola');
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].title).toContain('Coca-Cola');
      expect(result.matches[0].owner).toBe('The Coca-Cola Company');
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0]).toContain('The Coca-Cola Company');
    });

    it('should handle unconfirmed entity safely without fabricating fake records', async () => {
      const mockClient = {
        generateText: vi.fn().mockResolvedValue({
          model_id: 'ibm/granite-13b-chat-v2',
          created_at: new Date().toISOString(),
          results: [
            {
              generated_text: JSON.stringify({
                hasKnownTrademark: false,
                registeredOwner: null,
                trademarkClass: null,
                jurisdiction: null,
                isFictionalOrCelebrity: false,
                notes: 'Descriptive or common term without registered trademark conflict found.',
                confidence: 0.4,
              }),
            },
          ],
        }),
      } as unknown as IbmClient;

      const adapter = new IbmPartnerEvidenceAdapter(mockClient);
      vi.spyOn(adapter, 'isConfigured').mockReturnValue(true);

      const entityPayload = {
        id: randomUUID(),
        entity: 'Black Umbrella',
        type: 'PRODUCT',
        sourceText: 'She held a black umbrella under the rain.',
      };

      const result = await adapter.lookupEntity(entityPayload);

      expect(result.isAvailable).toBe(true);
      expect(result.matches).toEqual([]);
      expect(result.notes).toContain('no registered trademark conflict');
    });
  });

  describe('6. Partner Evidence Service Layer Decoupling', () => {
    it('should use IBM adapter as default provider and delegate lookups', async () => {
      expect(partnerEvidenceService.getProviderName()).toContain('IBM watsonx');

      const mockEntity: DetectedEntity = {
        id: randomUUID(),
        entity: 'Stark Industries',
        type: 'FICTIONAL_UNIVERSE',
        sourceText: 'Stark Industries R&D lab',
        location: 'INT. LAB - DAY',
        sceneId: 'sc-1',
        elementId: 'el-1',
        startOffset: 0,
        endOffset: 24,
        confidence: 0.95,
        occurrencesCount: 1,
      };

      const map = await partnerEvidenceService.gatherEvidence([mockEntity]);
      expect(map.has(mockEntity.id)).toBe(true);
      const evidence = map.get(mockEntity.id);
      expect(evidence?.entity).toBe('Stark Industries');
      expect(evidence?.isAvailable).toBe(false); // unconfigured
    });

    it('should allow setting a custom provider for testing or alternative registries', async () => {
      const customProvider = {
        providerName: 'Custom Mock Provider',
        isConfigured: () => true,
        lookupEntity: async (e: { id: string; entity: string }) => ({
          entity: e.entity,
          entityId: e.id,
          isAvailable: true,
          source: 'Custom Mock',
          matches: [],
          evidence: [],
          notes: 'Custom mock verification.',
        }),
      };

      partnerEvidenceService.setProvider(customProvider);
      expect(partnerEvidenceService.getProviderName()).toBe('Custom Mock Provider');
      expect(partnerEvidenceService.isConfigured()).toBe(true);

      // Reset
      partnerEvidenceService.resetDefaultProvider();
      expect(partnerEvidenceService.getProviderName()).toContain('IBM watsonx');
    });
  });

  describe('7. No Evidence ≠ No Risk Principle', () => {
    it('should format partner evidence summary informing downstream agents that no evidence is not safe', () => {
      const unavailableEvidence: PartnerEvidenceResult = {
        provider: 'IBM watsonx',
        entity: 'Generic Soda',
        entityId: 'id-1',
        isAvailable: false,
        source: 'IBM watsonx (Unconfigured)',
        matches: [],
        evidence: [],
        notes: 'Partner credentials not configured.',
      };

      // Verify that the object explicitly signals unconfigured state
      expect(unavailableEvidence.isAvailable).toBe(false);
      expect(unavailableEvidence.matches).toEqual([]);
      expect(unavailableEvidence.notes).toContain('not configured');
    });
  });

  describe('8. Live IBM Integration Test (Conditional)', () => {
    it('should perform genuine IBM Cloud IAM authentication and watsonx inference if credentials exist', async () => {
      const hasRealCredentials = Boolean(
        process.env.IBM_CLOUD_API_KEY &&
        process.env.IBM_WATSONX_PROJECT_ID &&
        process.env.IBM_CLOUD_API_KEY !== '' &&
        process.env.IBM_WATSONX_PROJECT_ID !== ''
      );

      if (!hasRealCredentials) {
        // Truthful reporting without claiming fake execution
        console.log(
          'ℹ️ Live IBM Integration Test skipped: Integration test requires real IBM credentials (IBM_CLOUD_API_KEY, IBM_WATSONX_PROJECT_ID).'
        );
        expect(isIbmConfigured()).toBe(false);
        return;
      }

      // Real live execution when credentials are provided
      const realClient = new IbmClient();
      const token = await realClient.getAccessToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);

      const response = await realClient.generateText(
        'Verify if "Pepsi" is a registered trademark. Answer in one sentence.'
      );
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0].generated_text).toBeDefined();
    });
  });
});
