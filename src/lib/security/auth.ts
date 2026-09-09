import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { repository } from '../../db/repository';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Resolves current tenant/user from:
 * 1. Authorization: Bearer <token>
 * 2. x-user-id header
 * 3. Google Cloud IAP header: x-goog-authenticated-user-email
 * 4. Default persistent anonymous tenant if non-strict/development
 */
export function extractAuthUser(req: Request): AuthenticatedUser {
  // 1. Check Google Cloud IAP headers (in production behind IAP / Cloud Run)
  const iapEmail = req.headers['x-goog-authenticated-user-email'] as string;
  const iapId = req.headers['x-goog-authenticated-user-id'] as string;
  if (iapEmail || iapId) {
    const cleanEmail = iapEmail ? iapEmail.replace('accounts.google.com:', '') : 'user@cineshield.internal';
    const id = iapId || cleanEmail.replace(/[^a-zA-Z0-9]/g, '-');
    return { id, email: cleanEmail, role: 'user' };
  }

  // 2. Check x-user-id or custom header
  const customUserId = req.headers['x-user-id'] as string;
  if (customUserId) {
    return {
      id: customUserId,
      email: (req.headers['x-user-email'] as string) || `${customUserId}@cineshield.internal`,
      role: 'user',
    };
  }

  // 3. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      if (token.startsWith('csk_jwt_')) {
        try {
          const raw = Buffer.from(token.replace('csk_jwt_', ''), 'base64').toString('utf-8');
          const [id, email] = raw.split(':');
          if (id && email) {
            return {
              id,
              email: email.toLowerCase(),
              role: id.includes('admin') ? 'admin' : 'user',
            };
          }
        } catch {
          // fall through
        }
      }
      return {
        id: `usr-${token.substring(0, 16)}`,
        email: `token-user@cineshield.internal`,
        role: 'user',
      };
    }
  }

  // 4. In development or test, provide standard deterministic tenant
  const defaultTenantId = process.env.DEFAULT_TENANT_ID || 'tenant-default-producer-01';
  return {
    id: defaultTenantId,
    email: 'producer@cineshield.internal',
    role: 'user',
  };
}

/**
 * Authentication middleware that attaches the current tenant user to Express Request
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const user = extractAuthUser(req);
  req.user = user;

  // If strict auth is required by environment
  if (process.env.REQUIRE_AUTH === 'true' && (!req.headers.authorization && !req.headers['x-user-id'])) {
    return next(new UnauthorizedError('Valid authentication token or user identity header is required.'));
  }

  next();
}

/**
 * Enforces server-side project authorization
 */
export async function authorizeProject(req: Request, projectId: string): Promise<void> {
  const project = await repository.getProject(projectId);
  if (!project) return; // NotFoundError will be handled by route

  if (project.userId && req.user && project.userId !== req.user.id && req.user.role !== 'admin') {
    throw new ForbiddenError('You do not have permission to access or modify this project.');
  }
}

/**
 * Enforces server-side script authorization
 */
export async function authorizeScript(req: Request, scriptId: string): Promise<void> {
  const script = await repository.getScript(scriptId);
  if (!script) return;

  await authorizeProject(req, script.projectId);
}

/**
 * Enforces server-side analysis authorization
 */
export async function authorizeAnalysis(req: Request, analysisId: string): Promise<void> {
  const analysis = await repository.getAnalysisRun(analysisId);
  if (!analysis) return;

  await authorizeProject(req, analysis.projectId);
}

/**
 * Enforces server-side finding authorization
 */
export async function authorizeFinding(req: Request, findingId: string): Promise<void> {
  const finding = await repository.getFinding(findingId);
  if (!finding) return;

  await authorizeAnalysis(req, finding.analysisId);
}
