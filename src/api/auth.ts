import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { ValidationError, UnauthorizedError } from '../lib/errors/AppError';
import { isDatabaseConfigured, getDb } from '../db/index';
import { users } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { createSignedToken } from '../lib/security/auth';
import { adminAuth } from '../lib/firebase-admin';

const router = Router();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.string().optional().default('counsel'),
  clearance: z.enum(['LEVEL_03', 'LEVEL_04', 'LEVEL_05']).default('LEVEL_04'),
  studio: z.string().default('Studio Alpha'),
});

/**
 * Verified user store
 */
interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  role: 'admin' | 'counsel' | 'producer' | 'auditor';
  clearance: 'LEVEL_03' | 'LEVEL_04' | 'LEVEL_05';
  studio: string;
  createdAt: string;
}

const registeredUsers = new Map<string, RegisteredUser>();

function normalizeRole(roleInput?: string): 'admin' | 'counsel' | 'producer' | 'auditor' {
  if (!roleInput) return 'counsel';
  const lower = roleInput.toLowerCase();
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('producer')) return 'producer';
  if (lower.includes('auditor')) return 'auditor';
  return 'counsel';
}

function stripPassword(user: RegisteredUser) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function findUserByEmail(email: string): Promise<RegisteredUser | undefined> {
  const cleanEmail = email.toLowerCase().trim();
  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      const rows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (rows.length > 0) {
        const row = rows[0];
        const user: RegisteredUser = {
          id: row.id,
          email: row.email,
          name: row.name || row.email.split('@')[0],
          passwordHash: row.passwordHash || undefined,
          role: normalizeRole(row.role),
          clearance: (row.clearance as RegisteredUser['clearance']) || 'LEVEL_04',
          studio: row.studio || 'Studio Alpha',
          createdAt: row.createdAt.toISOString(),
        };
        registeredUsers.set(cleanEmail, user);
        return user;
      }
    } catch (err) {
      console.warn('Database error while querying user by email:', err instanceof Error ? err.message : String(err));
    }
  }
  return registeredUsers.get(cleanEmail);
}

async function persistUser(user: RegisteredUser): Promise<void> {
  registeredUsers.set(user.email.toLowerCase().trim(), user);
  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      await db.insert(users).values({
        id: user.id,
        email: user.email.toLowerCase().trim(),
        name: user.name,
        role: user.role,
        clearance: user.clearance,
        studio: user.studio,
        passwordHash: user.passwordHash || null,
        createdAt: new Date(user.createdAt),
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email.toLowerCase().trim(),
          name: user.name,
          role: user.role,
          clearance: user.clearance,
          studio: user.studio,
          passwordHash: user.passwordHash || null,
        },
      });
    } catch (err) {
      console.warn('Database error while persisting user:', err instanceof Error ? err.message : String(err));
    }
  }
}

/**
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid login credentials provided. Email and password are required.');
    }

    const { email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      throw new UnauthorizedError('User account not found. Please register an account.');
    }

    if (user.passwordHash && !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = createSignedToken({ id: user.id, email: user.email, role: user.role });

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
const handleRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid registration parameters: ' + parseResult.error.message);
    }

    const { email, name, password, role, clearance, studio } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      throw new ValidationError('An account with this email address already exists.');
    }

    const id = `usr-${randomUUID().slice(0, 8)}`;
    const user: RegisteredUser = {
      id,
      email: cleanEmail,
      name,
      passwordHash: hashPassword(password),
      role: normalizeRole(role),
      clearance,
      studio,
      createdAt: new Date().toISOString(),
    };

    await persistUser(user);

    const token = createSignedToken({ id: user.id, email: user.email, role: user.role });

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
 * POST /api/auth/google
 * Authenticates using Firebase Auth Google ID Token
 */
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      throw new ValidationError('Firebase ID token is required.');
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || `${uid}@cineshield.internal`).toLowerCase();
    const name = decoded.name || email.split('@')[0];

    let user = await findUserByEmail(email);
    if (!user) {
      user = {
        id: uid,
        email,
        name,
        role: decoded.admin ? 'admin' : 'counsel',
        clearance: 'LEVEL_04',
        studio: 'Studio Alpha',
        createdAt: new Date().toISOString(),
      };
    } else {
      user.id = uid;
      user.name = name || user.name;
    }

    await persistUser(user);
    const token = createSignedToken({ id: user.id, email: user.email, role: user.role });

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
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is required to access user profile.');
    }

    const reqUser = req.user;
    const user = reqUser?.email ? await findUserByEmail(reqUser.email.toLowerCase()) : null;

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
 * GET /api/auth/team
 * Returns all studio team members
 */
router.get('/team', async (_req: Request, res: Response) => {
  let membersList: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    clearance: string;
    studio: string;
    status: string;
    createdAt: string;
  }> = [];

  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      if (rows.length > 0) {
        membersList = rows.map((u) => ({
          id: u.id,
          name: u.name || u.email.split('@')[0],
          email: u.email,
          role: u.role === 'admin' ? 'Chief Legal Officer' : u.role === 'counsel' ? 'Senior Counsel' : 'Production Counsel',
          clearance: u.clearance,
          studio: u.studio,
          status: 'Active',
          createdAt: u.createdAt.toISOString(),
        }));
      }
    } catch (err) {
      console.warn('Database error querying team members:', err);
    }
  }

  if (membersList.length === 0) {
    membersList = Array.from(registeredUsers.values()).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === 'admin' ? 'Chief Legal Officer' : u.role === 'counsel' ? 'Senior Counsel' : 'Production Counsel',
      clearance: u.clearance,
      studio: u.studio,
      status: 'Active',
      createdAt: u.createdAt,
    }));
  }

  res.json({
    success: true,
    members: membersList,
    total: membersList.length,
  });
});

/**
 * POST /api/auth/team
 * Invites / registers a new legal team member
 */
router.post('/team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, role, clearance, studio } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('Team member name is required.');
    }

    const memberEmail = email && typeof email === 'string' && email.includes('@')
      ? email.toLowerCase().trim()
      : `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@studioalpha.com`;

    const existing = await findUserByEmail(memberEmail);
    if (existing) {
      throw new ValidationError(`A team member with email ${memberEmail} already exists.`);
    }

    const id = `usr-${randomUUID().slice(0, 8)}`;
    const newMember: RegisteredUser = {
      id,
      email: memberEmail,
      name: name.trim(),
      passwordHash: hashPassword(randomBytes(16).toString('hex')),
      role: normalizeRole(role),
      clearance: clearance === 'LEVEL_05' ? 'LEVEL_05' : clearance === 'LEVEL_03' ? 'LEVEL_03' : 'LEVEL_04',
      studio: studio || 'Studio Alpha',
      createdAt: new Date().toISOString(),
    };

    await persistUser(newMember);

    res.status(201).json({
      success: true,
      member: {
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        role: newMember.role === 'admin' ? 'Chief Legal Officer' : newMember.role === 'counsel' ? 'Senior Counsel' : 'Production Counsel',
        clearance: newMember.clearance,
        studio: newMember.studio,
        status: 'Active',
        createdAt: newMember.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/auth/team/:id
 * Removes a team member
 */
router.delete('/team/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  for (const [email, user] of registeredUsers.entries()) {
    if (user.id === id) {
      registeredUsers.delete(email);
      break;
    }
  }

  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      await db.delete(users).where(eq(users.id, id));
    } catch (err) {
      console.warn('Database error removing team member:', err);
    }
  }

  res.json({ success: true, message: 'Member removed successfully' });
});

/**
 * PUT /api/auth/profile
 * Updates the current authenticated user's profile
 */
router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reqUser = req.user;
    if (!reqUser?.email) {
      throw new UnauthorizedError('Authentication token is required to update profile.');
    }

    const cleanEmail = reqUser.email.toLowerCase();
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }

    const { name, studio, clearance } = req.body;
    if (name && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (studio && typeof studio === 'string' && studio.trim()) {
      user.studio = studio.trim();
    }
    if (clearance && ['LEVEL_03', 'LEVEL_04', 'LEVEL_05'].includes(clearance)) {
      user.clearance = clearance;
    }

    await persistUser(user);

    res.json({
      success: true,
      user: stripPassword(user),
    });
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
