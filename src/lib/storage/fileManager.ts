import fs from 'fs';
import path from 'path';
import os from 'os';

const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), 'cineshield-uploads');

// Ensure temporary upload directory exists
try {
  if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true, mode: 0o700 });
  }
} catch (err) {
  console.error('Failed to initialize temporary directory:', err);
}

export async function writeTempFile(buffer: Buffer, extension: string): Promise<string> {
  const fileName = `upload-${crypto.randomUUID()}${extension}`;
  const filePath = path.join(TEMP_UPLOAD_DIR, fileName);
  await fs.promises.writeFile(filePath, buffer, { mode: 0o600 });
  return filePath;
}

export async function cleanupTempFile(filePath?: string | null): Promise<void> {
  if (!filePath) return;
  try {
    // Only delete files inside TEMP_UPLOAD_DIR to prevent arbitrary deletion
    const resolved = path.resolve(filePath);
    if (resolved.startsWith(TEMP_UPLOAD_DIR) && fs.existsSync(resolved)) {
      await fs.promises.unlink(resolved);
    }
  } catch {
    // Ignore cleanup failure silently to avoid leaking errors
  }
}

export { TEMP_UPLOAD_DIR };
