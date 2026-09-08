import { NormalizedScreenplay } from '../../types/screenplay';
import { parseFountain } from './fountain';
import { parsePlainText } from './txt';
import { parsePdf } from './pdf';
import { InvalidFileError } from '../errors/AppError';

export async function parseScreenplay(
  content: Buffer,
  format: 'pdf' | 'txt' | 'fountain',
  fileName: string
): Promise<NormalizedScreenplay> {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const title = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  switch (format) {
    case 'pdf':
      return parsePdf(content, title);
    case 'fountain': {
      const text = content.toString('utf-8');
      return parseFountain(text, title);
    }
    case 'txt': {
      const text = content.toString('utf-8');
      return parsePlainText(text, title);
    }
    default:
      throw new InvalidFileError(`Unsupported format: ${format}`);
  }
}

export * from './fountain';
export * from './txt';
export * from './pdf';
export * from './normalize';
