import { DetectedEntity, PartnerEvidenceResult } from './types';
import { ibmPartnerEvidenceAdapter, PartnerEvidenceProvider } from '../partners/ibm';

/**
 * Interface defining the contract for external IP evidence and clearance databases.
 * Decouples downstream screening agents from partner-specific implementations.
 */
export interface IPartnerEvidenceProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  lookupEntity(entity: DetectedEntity): Promise<PartnerEvidenceResult>;
}

/**
 * Partner Evidence Service
 * Intermediary layer between Entity Detection and Gemini Risk Analysis.
 * Resolves external trademark / copyright clearance context using the configured
 * partner provider (IBM watsonx).
 */
export class PartnerEvidenceService {
  private defaultProvider: IPartnerEvidenceProvider = ibmPartnerEvidenceAdapter;
  private provider: IPartnerEvidenceProvider = this.defaultProvider;

  /**
   * Returns current active provider name
   */
  getProviderName(): string {
    return this.provider.providerName;
  }

  /**
   * Set custom provider (e.g. for testing or alternative clearance providers)
   */
  setProvider(customProvider: IPartnerEvidenceProvider): void {
    this.provider = customProvider;
  }

  /**
   * Reset to the default IBM partner evidence provider
   */
  resetDefaultProvider(): void {
    this.provider = this.defaultProvider;
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Fetches evidence results for all detected entities
   */
  async gatherEvidence(entities: DetectedEntity[]): Promise<Map<string, PartnerEvidenceResult>> {
    const evidenceMap = new Map<string, PartnerEvidenceResult>();

    for (const entity of entities) {
      const result = await this.provider.lookupEntity(entity);
      evidenceMap.set(entity.id, result);
    }

    return evidenceMap;
  }
}

export const partnerEvidenceService = new PartnerEvidenceService();

