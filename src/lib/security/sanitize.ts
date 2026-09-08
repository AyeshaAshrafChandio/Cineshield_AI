import path from 'path';
import { InvalidFileError } from '../errors/AppError';

export type ScreenplayFormat = 'pdf' | 'txt' | 'fountain';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.fountain']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/octet-stream',
  'text/x-fountain',
  'application/x-fountain',
]);

export function sanitizeFileName(rawName: string): string {
  if (!rawName) return 'screenplay.txt';

  // Strip path traversal sequences across Unix and Windows separators
  const normalized = rawName.replace(/\\/g, '/');
  const base = path.basename(normalized);

  // Remove control characters and dangerous characters
  const sanitized = base.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').trim();

  // Enforce reasonable length
  return sanitized.length > 100 ? sanitized.substring(0, 100) : sanitized;
}

export function validateFileFormat(
  originalName: string,
  mimetype?: string
): { format: ScreenplayFormat; safeFileName: string } {
  const safeFileName = sanitizeFileName(originalName);
  const ext = path.extname(safeFileName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new InvalidFileError(
      `Unsupported file extension '${ext}'. Only .pdf, .txt, and .fountain files are permitted.`
    );
  }

  if (mimetype && !ALLOWED_MIME_TYPES.has(mimetype.toLowerCase())) {
    throw new InvalidFileError(
      `Unsupported MIME type '${mimetype}'. Screenplays must be PDF, plain text, or Fountain files.`
    );
  }

  let format: ScreenplayFormat;
  if (ext === '.pdf') {
    format = 'pdf';
  } else if (ext === '.fountain') {
    format = 'fountain';
  } else {
    format = 'txt';
  }

  return { format, safeFileName };
}
