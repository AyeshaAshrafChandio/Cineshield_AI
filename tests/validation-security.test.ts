import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { sanitizeFileName, validateFileFormat } from '../src/lib/security/sanitize';
import { writeTempFile, cleanupTempFile } from '../src/lib/storage/fileManager';
import { startAnalysisSchema, rewriteRequestSchema, uuidSchema } from '../src/lib/validation/schemas';
import { InvalidFileError, DatabaseNotConfiguredError } from '../src/lib/errors/AppError';
import { isDatabaseConfigured, getDb } from '../src/db/index';

describe('Validation and Security Infrastructure', () => {
  describe('Filename Sanitization', () => {
    it('should strip path traversal attempts', () => {
      expect(sanitizeFileName('../../etc/passwd.fountain')).toBe('passwd.fountain');
      expect(sanitizeFileName('..\\..\\windows\\system32.pdf')).toBe('system32.pdf');
      expect(sanitizeFileName('/var/log/screenplay.txt')).toBe('screenplay.txt');
    });

    it('should remove special characters and control characters', () => {
      expect(sanitizeFileName('my<script>;drop--table.fountain')).toBe('my_script__drop--table.fountain');
      expect(sanitizeFileName('test\0file.pdf')).toBe('test_file.pdf');
    });

    it('should truncate excessively long filenames', () => {
      const longName = 'a'.repeat(200) + '.txt';
      const sanitized = sanitizeFileName(longName);
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });
  });

  describe('MIME & Extension Validation', () => {
    it('should accept valid PDF, TXT, and Fountain formats', () => {
      const pdf = validateFileFormat('script.pdf', 'application/pdf');
      expect(pdf.format).toBe('pdf');

      const txt = validateFileFormat('script.txt', 'text/plain');
      expect(txt.format).toBe('txt');

      const fountain = validateFileFormat('script.fountain', 'text/plain');
      expect(fountain.format).toBe('fountain');
    });

    it('should reject unpermitted file extensions', () => {
      expect(() => validateFileFormat('malicious.exe', 'application/x-msdownload')).toThrow(InvalidFileError);
      expect(() => validateFileFormat('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toThrow(InvalidFileError);
      expect(() => validateFileFormat('script.html', 'text/html')).toThrow(InvalidFileError);
    });

    it('should reject unpermitted MIME types for matching extension', () => {
      expect(() => validateFileFormat('script.txt', 'application/x-executable')).toThrow(InvalidFileError);
    });
  });

  describe('Zod Validation Schemas', () => {
    it('should validate standard UUIDs correctly', () => {
      const validUUID = crypto.randomUUID();
      expect(uuidSchema.safeParse(validUUID).success).toBe(true);

      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
      expect(uuidSchema.safeParse('').success).toBe(false);
      expect(uuidSchema.safeParse('crypto.randomUUID()').success).toBe(false);
    });

    it('should validate start analysis request schema', () => {
      const validScriptId = crypto.randomUUID();
      expect(startAnalysisSchema.safeParse({ scriptId: validScriptId }).success).toBe(true);
      expect(startAnalysisSchema.safeParse({ scriptId: 'invalid' }).success).toBe(false);
      expect(startAnalysisSchema.safeParse({}).success).toBe(false);
    });

    it('should validate rewrite request schema', () => {
      expect(rewriteRequestSchema.safeParse({ prompt: 'Make dialogue less aggressive' }).success).toBe(true);
      expect(rewriteRequestSchema.safeParse({ prompt: '' }).success).toBe(false);
    });
  });

  describe('Temporary File Lifecycle & Automatic Cleanup', () => {
    it('should write temporary file and successfully clean it up', async () => {
      const testBuffer = Buffer.from('TEST SCREENPLAY CONTENT');
      const tempPath = await writeTempFile(testBuffer, '.txt');

      expect(fs.existsSync(tempPath)).toBe(true);

      await cleanupTempFile(tempPath);
      expect(fs.existsSync(tempPath)).toBe(false);
    });

    it('should gracefully handle non-existent path cleanup without throwing', async () => {
      await expect(cleanupTempFile('/tmp/cineshield-uploads/non-existent-uuid.txt')).resolves.not.toThrow();
      await expect(cleanupTempFile(null)).resolves.not.toThrow();
    });
  });

  describe('Database Not Configured Handling', () => {
    it('should report database configuration status and throw clean DatabaseNotConfiguredError when missing', () => {
      const originalDbUrl = process.env.DATABASE_URL;
      const originalSqlHost = process.env.SQL_HOST;

      try {
        delete process.env.DATABASE_URL;
        delete process.env.SQL_HOST;

        expect(isDatabaseConfigured()).toBe(false);
        expect(() => getDb()).toThrow(DatabaseNotConfiguredError);
      } finally {
        if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
        if (originalSqlHost) process.env.SQL_HOST = originalSqlHost;
      }
    });
  });
});
