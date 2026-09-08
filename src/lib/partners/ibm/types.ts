/**
 * IBM Partner Integration Types
 * Defines interfaces, configuration types, and normalized data contracts
 * for IBM watsonx / IBM Cloud partner services.
 */

export interface IbmConfig {
  apiKey: string;
  projectId: string;
  serviceUrl: string;
  modelId: string;
  requestTimeoutMs: number;
  maxRetries: number;
}

export interface IbmIamTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  expiration: number;
}

export interface WatsonxGenerationParameters {
  decoding_method?: 'greedy' | 'sample';
  max_new_tokens?: number;
  min_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface WatsonxGenerationRequest {
  input: string;
  parameters: WatsonxGenerationParameters;
  model_id: string;
  project_id: string;
}

export interface WatsonxGenerationResult {
  generated_text: string;
  generated_token_count?: number;
  input_token_count?: number;
  stop_reason?: string;
}

export interface WatsonxGenerationResponse {
  model_id: string;
  created_at: string;
  results: WatsonxGenerationResult[];
}

export interface IbmEvidenceMatch {
  title: string;
  registrationNumber?: string;
  owner?: string;
  sourceUrl?: string;
  similarityScore?: number;
  details?: string;
}

export interface NormalizedPartnerEvidence {
  provider: string;
  entity: string;
  entityId: string;
  isAvailable: boolean;
  source: string;
  matches: IbmEvidenceMatch[];
  evidence: string[];
  notes: string;
  retrievedAt?: string;
}

export interface EntityLookupPayload {
  id: string;
  entity: string;
  type: string;
  sourceText: string;
  context?: string;
}

/**
 * Common abstraction for external IP evidence and registry providers.
 * Decouples CineShield AI workflow logic from vendor-specific SDKs.
 */
export interface PartnerEvidenceProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  lookupEntity(entity: EntityLookupPayload): Promise<NormalizedPartnerEvidence>;
}
