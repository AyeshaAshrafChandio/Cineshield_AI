import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { logger } from '../observability/logger';
import { agentOrchestrator } from '../agents/orchestrator';

let tasksClient: CloudTasksClient | null = null;

export interface TaskPayload {
  analysisId: string;
  tenantUserId: string;
}

export class CloudTasksService {
  /**
   * Checks if Cloud Tasks queue is configured
   */
  isConfigured(): boolean {
    const queue = process.env.CLOUD_TASKS_QUEUE;
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    const serviceUrl = process.env.SERVICE_URL;
    return Boolean(queue && project && serviceUrl);
  }

  private getClient(): CloudTasksClient {
    if (!tasksClient) {
      tasksClient = new CloudTasksClient();
    }
    return tasksClient;
  }

  /**
   * Dispatches analysis job either through Cloud Tasks (production) or local async queue
   */
  async enqueueAnalysisTask(payload: TaskPayload): Promise<{ enqueued: boolean; mode: 'cloud_tasks' | 'in_process' }> {
    const { analysisId, tenantUserId } = payload;

    if (!this.isConfigured()) {
      // Local or fallback execution: trigger asynchronously via setImmediate without blocking caller
      setImmediate(() => {
        agentOrchestrator.runAnalysis(analysisId, tenantUserId).catch((err) => {
          logger.error(`Asynchronous analysis ${analysisId} encountered an error:`, err, {
            analysisId,
            userId: tenantUserId,
          });
        });
      });

      return { enqueued: true, mode: 'in_process' };
    }

    try {
      const client = this.getClient();
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT!;
      const location = process.env.CLOUD_TASKS_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      const queueName = process.env.CLOUD_TASKS_QUEUE!;
      const serviceUrl = process.env.SERVICE_URL!.replace(/\/$/, '');

      const parent = client.queuePath(projectId, location, queueName);
      const url = `${serviceUrl}/api/internal/tasks/analysis`;

      const taskSecret = process.env.INTERNAL_TASK_SECRET || '';

      const task: protos.google.cloud.tasks.v2.ITask = {
        httpRequest: {
          httpMethod: 'POST',
          url,
          headers: {
            'Content-Type': 'application/json',
            ...(taskSecret ? { 'X-Internal-Task-Secret': taskSecret } : {}),
          },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        },
      };

      // If Cloud Run Service Account email is provided, configure OIDC token
      const oidcServiceAccount = process.env.CLOUD_RUN_SERVICE_ACCOUNT;
      if (oidcServiceAccount && task.httpRequest) {
        task.httpRequest.oidcToken = {
          serviceAccountEmail: oidcServiceAccount,
          audience: serviceUrl,
        };
      }

      const [response] = await client.createTask({ parent, task });
      logger.info('Analysis task enqueued to Google Cloud Tasks', {
        analysisId,
        meta: { taskName: response.name, queue: queueName, url },
      });

      return { enqueued: true, mode: 'cloud_tasks' };
    } catch (err) {
      logger.warn('Failed to enqueue Cloud Task. Falling back to in-process execution.', {
        analysisId,
        meta: { error: err instanceof Error ? err.message : String(err) },
      });

      setImmediate(() => {
        agentOrchestrator.runAnalysis(analysisId, tenantUserId).catch((e) => {
          logger.error(`Fallback asynchronous analysis ${analysisId} encountered an error:`, e, {
            analysisId,
            userId: tenantUserId,
          });
        });
      });

      return { enqueued: true, mode: 'in_process' };
    }
  }
}

export const cloudTasksService = new CloudTasksService();
