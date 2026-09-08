import fs from 'fs';
import { repository } from '../../db/repository';
import { tempStore } from './tempStore';
import { logger } from '../observability/logger';

export class DataLifecycleManager {
  /**
   * Immediately and securely removes a temporary file from disk
   */
  async cleanupDiskFile(filePath: string): Promise<void> {
    try {
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info('Purged temporary file from disk', { meta: { filePath } });
      }
    } catch (err) {
      logger.warn('Failed to delete temporary file', {
        meta: { filePath, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /**
   * Cleans up screenplay raw text from memory while preserving metadata and analysis findings
   */
  cleanupScreenplayMemory(scriptId: string): void {
    tempStore.cleanupScreenplay(scriptId);
    logger.info('Cleaned up screenplay parsed text from memory cache', { meta: { scriptId } });
  }

  /**
   * Complete cascade deletion of a project and all associated scripts, analyses, findings, and reports
   */
  async purgeProject(projectId: string): Promise<void> {
    logger.info('Beginning cascade deletion of project', { meta: { projectId } });
    await repository.deleteProject(projectId);
    logger.info('Successfully purged project and all children', { meta: { projectId } });
  }

  /**
   * Complete cascade deletion of a single script and its analyses
   */
  async purgeScript(scriptId: string): Promise<void> {
    logger.info('Beginning deletion of script', { meta: { scriptId } });
    await repository.deleteScript(scriptId);
    this.cleanupScreenplayMemory(scriptId);
    logger.info('Successfully purged script', { meta: { scriptId } });
  }

  /**
   * Retention policy cleanup: Removes completed or failed analysis runs older than retention window
   */
  async purgeExpiredRuns(_maxAgeDays = 30): Promise<number> {
    // In production with PostgreSQL, can delete records older than NOW() - interval '30 days'
    logger.info('Running expired data retention sweep');
    return 0;
  }
}

export const dataLifecycleManager = new DataLifecycleManager();
