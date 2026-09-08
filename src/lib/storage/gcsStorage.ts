import { Storage, Bucket } from '@google-cloud/storage';
import { logger } from '../observability/logger';
import { NormalizedScreenplay } from '../../types/screenplay';

let storageClient: Storage | null = null;
let targetBucket: Bucket | null = null;

export class GCSStorageService {
  private bucketName: string | null = null;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || null;
  }

  /**
   * Check if GCS is configured via environment variables
   */
  isConfigured(): boolean {
    return Boolean(process.env.GCS_BUCKET_NAME);
  }

  /**
   * Lazy initialization of Google Cloud Storage client
   */
  private getBucket(): Bucket {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME is not configured.');
    }

    if (!storageClient) {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
      storageClient = new Storage({
        projectId: projectId || undefined,
      });
    }

    if (!targetBucket || this.bucketName !== bucketName) {
      this.bucketName = bucketName;
      targetBucket = storageClient.bucket(bucketName);
    }

    return targetBucket;
  }

  /**
   * Uploads normalized screenplay data to private GCS bucket
   */
  async uploadScreenplay(scriptId: string, screenplay: NormalizedScreenplay): Promise<string> {
    if (!this.isConfigured()) {
      return '';
    }

    try {
      const bucket = this.getBucket();
      const objectPath = `screenplays/${scriptId}.json`;
      const file = bucket.file(objectPath);

      const content = JSON.stringify(screenplay);
      await file.save(content, {
        contentType: 'application/json',
        resumable: false,
        metadata: {
          cacheControl: 'private, max-age=0, no-transform',
          scriptId,
          title: screenplay.title,
        },
      });

      logger.info('Screenplay saved to Google Cloud Storage', {
        meta: { scriptId, bucket: this.bucketName, objectPath },
      });

      return `gs://${this.bucketName}/${objectPath}`;
    } catch (err) {
      logger.error('Failed to upload screenplay to GCS', err, {
        meta: { scriptId, bucket: this.bucketName },
      });
      // Do not throw fatal error; caller will retain in-memory/DB backup
      return '';
    }
  }

  /**
   * Downloads normalized screenplay data from GCS
   */
  async downloadScreenplay(scriptId: string): Promise<NormalizedScreenplay | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const bucket = this.getBucket();
      const objectPath = `screenplays/${scriptId}.json`;
      const file = bucket.file(objectPath);

      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [buffer] = await file.download();
      const text = buffer.toString('utf-8');
      return JSON.parse(text) as NormalizedScreenplay;
    } catch (err) {
      logger.error('Failed to download screenplay from GCS', err, {
        meta: { scriptId, bucket: this.bucketName },
      });
      return null;
    }
  }

  /**
   * Deletes screenplay object from GCS upon cascade project/script deletion
   */
  async deleteScreenplay(scriptId: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const bucket = this.getBucket();
      const objectPath = `screenplays/${scriptId}.json`;
      const file = bucket.file(objectPath);

      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        logger.info('Deleted screenplay from GCS', {
          meta: { scriptId, objectPath },
        });
      }
    } catch (err) {
      logger.warn('Failed to delete screenplay from GCS', {
        meta: { scriptId, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /**
   * Generates a short-lived V4 signed URL for secure download (expires in 15 minutes)
   */
  async getSignedReadUrl(scriptId: string, expiresInMinutes = 15): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const bucket = this.getBucket();
      const objectPath = `screenplays/${scriptId}.json`;
      const file = bucket.file(objectPath);

      const [exists] = await file.exists();
      if (!exists) return null;

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      return url;
    } catch (err) {
      logger.error('Failed to generate GCS signed URL', err, {
        meta: { scriptId },
      });
      return null;
    }
  }
}

export const gcsStorage = new GCSStorageService();
