import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { ValidationError, UnauthorizedError } from '../lib/errors/AppError';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6).optional(),
  role: z.string().optional().default('counsel'),
  clearance: z.enum(['LEVEL_03', 'LEVEL_04', 'LEVEL_05']).default('LEVEL_04'),
  studio: z.string().default('Studio Alpha'),
});

/**
 * In-memory / session user registry for authentication
 */
interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: 'admin' | 'counsel' | 'producer' | 'auditor';
  clearance: 'LEVEL_03' | 'LEVEL_04' | 'LEVEL_05';
  studio: string;
  createdAt: string;
}

const registeredUsers = new Map<string, RegisteredUser>([
  [
    'j.vane@studioalpha.com',
    {
      id: 'usr-julian-vane-01',
      email: 'j.vane@studioalpha.com',
      name: 'Julian Vane',
      password: 'SecretPassword123!',
      role: 'admin',
      clearance: 'LEVEL_05',
      studio: 'Studio Alpha',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  [
    'm.thorne@studioalpha.com',
    {
      id: 'usr-marcus-thorne-02',
      email: 'm.thorne@studioalpha.com',
      name: 'Marcus Thorne',
      password: 'SecretPassword123!',
      role: 'counsel',
      clearance: 'LEVEL_05',
      studio: 'Studio Alpha',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  [
    's.jenkins@studioalpha.com',
    {
      id: 'usr-sarah-jenkins-03',
      email: 's.jenkins@studioalpha.com',
      name: 'Sarah Jenkins',
      password: 'SecretPassword123!',
      role: 'counsel',
      clearance: 'LEVEL_04',
      studio: 'Studio Alpha',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
]);

function normalizeRole(roleInput?: string): 'admin' | 'counsel' | 'producer' | 'auditor' {
  if (!roleInput) return 'counsel';
  const lower = roleInput.toLowerCase();
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('producer')) return 'producer';
  if (lower.includes('auditor')) return 'auditor';
  return 'counsel';
}

function stripPassword(user: RegisteredUser) {
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * POST /api/auth/login
 */
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid login credentials provided.');
    }

    const { email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const user = registeredUsers.get(cleanEmail);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (user.password && user.password !== password) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = `csk_jwt_${Buffer.from(`${user.id}:${user.email}`).toString('base64')}`;

    res.json({
      success: true,
      token,
      user: stripPassword(user),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Common handler for /signup and /register
 */
const handleRegister = (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid registration parameters: ' + parseResult.error.message);
    }

    const { email, name, password, role, clearance, studio } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    if (registeredUsers.has(cleanEmail)) {
      throw new ValidationError('An account with this email address already exists.');
    }

    const id = `usr-${randomUUID().slice(0, 8)}`;
    const user: RegisteredUser = {
      id,
      email: cleanEmail,
      name,
      password: password || 'SecretPassword123!',
      role: normalizeRole(role),
      clearance,
      studio,
      createdAt: new Date().toISOString(),
    };

    registeredUsers.set(cleanEmail, user);
    const token = `csk_jwt_${Buffer.from(`${user.id}:${user.email}`).toString('base64')}`;

    res.status(201).json({
      success: true,
      token,
      user: stripPassword(user),
    });
  } catch (err) {
    next(err);
  }
};

router.post('/signup', handleRegister);
router.post('/register', handleRegister);

/**
 * GET /api/auth/me
 */
router.get('/me', (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is required to access user profile.');
    }

    const reqUser = req.user;
    const user = reqUser?.email ? registeredUsers.get(reqUser.email.toLowerCase()) : null;

    if (user) {
      res.json({ success: true, user: stripPassword(user) });
    } else if (reqUser) {
      res.json({
        success: true,
        user: {
          id: reqUser.id,
          email: reqUser.email,
          name: reqUser.email.split('@')[0],
          role: reqUser.role === 'admin' ? 'admin' : 'counsel',
          clearance: 'LEVEL_04',
          studio: 'Studio Alpha',
          createdAt: new Date().toISOString(),
        },
      });
    } else {
      throw new UnauthorizedError('Invalid user session.');
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
