import { randomUUID } from 'crypto';
import { ScreenplayScene, ScreenplayMetadata } from '../../types/screenplay';

export function normalizeLineEndings(raw: string): string {
  // Strip BOM if present
  let clean = raw.replace(/^\uFEFF/, '');
  // Normalize \r\n and \r to \n
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return clean;
}

export function parseHeading(heading: string): { location: string; timeOfDay: string } {
  const trimmed = heading.trim().replace(/^\.\s*/, ''); // Remove leading dot for forced headings

  // Common patterns: "INT. COFFEE SHOP - DAY", "EXT. STREET - NIGHT", "INT./EXT. CAR - CONTINUOUS"
  const dashIndex = trimmed.lastIndexOf(' - ');
  let location = trimmed;
  let timeOfDay = 'UNKNOWN';

  if (dashIndex !== -1) {
    location = trimmed.substring(0, dashIndex).trim();
    timeOfDay = trimmed.substring(dashIndex + 3).trim();
  } else {
    // Try single dash
    const singleDash = trimmed.lastIndexOf('-');
    if (singleDash !== -1) {
      location = trimmed.substring(0, singleDash).trim();
      timeOfDay = trimmed.substring(singleDash + 1).trim();
    }
  }

  // Clean location prefix like INT., EXT., etc.
  location = location.replace(/^(INT\.|EXT\.|INT\/EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i, '').trim();

  return {
    location: location || 'UNKNOWN',
    timeOfDay: timeOfDay || 'UNKNOWN',
  };
}

export function buildMetadata(
  scenes: ScreenplayScene[],
  sourceFormat: 'pdf' | 'txt' | 'fountain'
): ScreenplayMetadata {
  const charactersSet = new Set<string>();
  const locationsSet = new Set<string>();
  let totalElements = 0;
  let totalLines = 0;

  for (const scene of scenes) {
    if (scene.location && scene.location !== 'UNKNOWN') {
      locationsSet.add(scene.location);
    }
    for (const elem of scene.elements) {
      totalElements++;
      const lineCount = elem.text.split('\n').length;
      totalLines += lineCount;
      if (elem.type === 'character' && elem.text) {
        const cleanName = elem.text.replace(/\s*\(.*?\)\s*$/, '').trim();
        if (cleanName) {
          charactersSet.add(cleanName);
        }
      }
    }
  }

  // Rough estimation: 55 lines per standard screenplay page, 1 page ~ 1 min
  const estimatedDurationMinutes = Math.max(1, Math.round(totalLines / 55));

  return {
    totalScenes: scenes.length,
    totalElements,
    estimatedDurationMinutes,
    characters: Array.from(charactersSet).sort(),
    locations: Array.from(locationsSet).sort(),
    parsedAt: new Date().toISOString(),
    sourceFormat,
  };
}

export function generateUUID(): string {
  return randomUUID();
}
