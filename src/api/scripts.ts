import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { validateFileFormat } from '../lib/security/sanitize';
import { parseScreenplay } from '../lib/parsing';
import { writeTempFile, cleanupTempFile } from '../lib/storage/fileManager';
import { repository } from '../db/repository';
import { tempStore } from '../lib/storage/tempStore';
import { uuidSchema } from '../lib/validation/schemas';
import { authorizeScript } from '../lib/security/auth';
import { dataLifecycleManager } from '../lib/storage/cleanupService';
import {
  FileTooLargeError,
  InvalidFileError,
  NotFoundError,
  ValidationError,
} from '../lib/errors/AppError';
import { ScriptUploadResponse, ScreenplayDataResponse } from '../types/api';

const router = Router();

// Configure Multer for in-memory buffer handling with 50MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    try {
      validateFileFormat(file.originalname, file.mimetype);
      cb(null, true);
    } catch (err) {
      cb(err as Error);
    }
  },
});

// Middleware to handle multer limits and errors gracefully
const uploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new FileTooLargeError());
        }
        return next(new ValidationError(`Upload error: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};

/**
 * POST /api/scripts/upload
 * Upload and parse screenplay (PDF, TXT, Fountain up to 50MB)
 */
router.post('/upload', uploadMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  let tempFilePath: string | null = null;

  try {
    const file = req.file;
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new ValidationError('No screenplay file provided or file is empty.');
    }

    const { format, safeFileName } = validateFileFormat(file.originalname, file.mimetype);

    // Write file to secure temporary storage for processing lifecycle
    tempFilePath = await writeTempFile(file.buffer, `.${format}`);

    // Parse screenplay into normalized data model
    const normalizedScreenplay = await parseScreenplay(file.buffer, format, safeFileName);

    // Generate real unique identifiers
    const projectId = randomUUID();
    const scriptId = randomUUID();
    const now = new Date().toISOString();

    // Persist project record with tenant user ID
    await repository.saveProject({
      id: projectId,
      title: normalizedScreenplay.title || safeFileName,
      userId: req.user?.id || 'default-user',
      createdAt: now,
      updatedAt: now,
    });

    // Persist script record
    await repository.saveScript(
      {
        id: scriptId,
        projectId,
        fileName: safeFileName,
        fileType: format,
        fileSize: file.size,
        title: normalizedScreenplay.title || safeFileName,
        status: 'uploaded',
        uploadedAt: now,
      },
      {
        totalScenes: normalizedScreenplay.metadata.totalScenes,
        totalElements: normalizedScreenplay.metadata.totalElements,
        estimatedDurationMinutes: normalizedScreenplay.metadata.estimatedDurationMinutes,
        characters: normalizedScreenplay.metadata.characters,
        locations: normalizedScreenplay.metadata.locations,
      }
    );

    // Store parsed screenplay representation in tempStore for analysis and viewer access
    tempStore.saveScreenplay(scriptId, normalizedScreenplay);

    const response: ScriptUploadResponse = {
      success: true,
      scriptId,
      projectId,
      fileName: safeFileName,
      fileType: format,
      status: 'uploaded',
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  } finally {
    // Automatic cleanup of temporary file from filesystem
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
});

/**
 * GET /api/scripts/:id/screenplay
 * Retrieve normalized screenplay data model for screenplay viewer
 */
router.get('/:id/screenplay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid script ID format.');
    }
    const scriptId = parseResult.data;

    await authorizeScript(req, scriptId);

    const script = await repository.getScript(scriptId);
    if (!script) {
      throw new NotFoundError('Script', scriptId);
    }

    const screenplay = tempStore.getScreenplay(scriptId);
    if (!screenplay) {
      throw new NotFoundError('Screenplay data', scriptId);
    }

    const response: ScreenplayDataResponse = {
      success: true,
      scriptId,
      title: screenplay.title,
      scenes: screenplay.scenes,
      metadata: screenplay.metadata,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/scripts/:id
 * Delete script and clean up screenplay parsed data
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = uuidSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      throw new ValidationError('Invalid script ID format.');
    }
    const scriptId = parseResult.data;

    await authorizeScript(req, scriptId);

    const script = await repository.getScript(scriptId);
    if (!script) {
      throw new NotFoundError('Script', scriptId);
    }

    await dataLifecycleManager.purgeScript(scriptId);

    res.json({
      success: true,
      message: `Script ${scriptId} has been successfully deleted.`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
