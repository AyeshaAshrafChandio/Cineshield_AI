import { PDFParse } from 'pdf-parse';
import { NormalizedScreenplay } from '../../types/screenplay';
import { parsePlainText } from './txt';
import { MalformedFileError } from '../errors/AppError';

export async function parsePdf(
  buffer: Buffer,
  defaultTitle: string = 'Untitled Screenplay'
): Promise<NormalizedScreenplay> {
  if (!buffer || buffer.length === 0) {
    throw new MalformedFileError('PDF buffer is empty (0 bytes).');
  }

  // Check PDF signature '%PDF-' (0x25 0x50 0x44 0x46 0x2D)
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new MalformedFileError('Invalid PDF file format. Missing standard %PDF- magic signature.');
  }

  let extractedText = '';
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    extractedText = data.text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new MalformedFileError(`Corrupted PDF structure: ${message}`);
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore destroy error
      }
    }
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new MalformedFileError('PDF document does not contain any readable text or is image-only.');
  }

  // Clean common PDF headers/footers (e.g. "1.", "Page 2", standalone page numbers)
  const cleanedText = extractedText
    .split('\n')
    .filter((line) => !/^\s*(page\s+)?\d+\.?\s*$/i.test(line))
    .join('\n');

  const parsed = parsePlainText(cleanedText, defaultTitle);
  parsed.metadata.sourceFormat = 'pdf';

  return parsed;
}
