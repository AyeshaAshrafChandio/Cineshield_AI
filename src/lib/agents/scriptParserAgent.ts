import { NormalizedScreenplay } from '../../types/screenplay';
import { ParsedScreenplayContext } from './types';
import { MalformedFileError } from '../errors/AppError';

/**
 * Script Parser Agent
 * Operates as the deterministic foundation of the pipeline, transforming and validating
 * normalized screenplay data into verified structural context for downstream IP analysis.
 */
export class ScriptParserAgent {
  /**
   * Confirms and extracts verified structural screenplay context
   */
  async process(screenplay: NormalizedScreenplay): Promise<ParsedScreenplayContext> {
    if (!screenplay || !screenplay.scenes) {
      throw new MalformedFileError('Screenplay structure is missing or malformed.');
    }

    const uniqueCharacters = new Set<string>();
    const uniqueLocations = new Set<string>();
    let totalElements = 0;

    for (const scene of screenplay.scenes) {
      if (scene.location) {
        uniqueLocations.add(scene.location.trim().toUpperCase());
      }

      for (const el of scene.elements) {
        totalElements++;
        if (el.type === 'character' && el.text) {
          const cleanChar = el.text.replace(/\s*\(.*?\)\s*$/, '').trim().toUpperCase();
          if (cleanChar) {
            uniqueCharacters.add(cleanChar);
          }
        }
      }
    }

    // Include any pre-parsed characters or locations from metadata
    if (screenplay.metadata?.characters) {
      for (const char of screenplay.metadata.characters) {
        uniqueCharacters.add(char.trim().toUpperCase());
      }
    }
    if (screenplay.metadata?.locations) {
      for (const loc of screenplay.metadata.locations) {
        uniqueLocations.add(loc.trim().toUpperCase());
      }
    }

    const charactersList = Array.from(uniqueCharacters).sort();
    const locationsList = Array.from(uniqueLocations).sort();

    // Standard screenplay pacing heuristic: 1 page approx 1 minute (approx 200 words / 55 lines per page)
    const estimatedDuration = screenplay.metadata?.estimatedDurationMinutes ||
      Math.max(1, Math.round(totalElements / 15));

    return {
      title: screenplay.title || 'Untitled Screenplay',
      scenes: screenplay.scenes,
      characters: charactersList,
      locations: locationsList,
      totalElements,
      estimatedDurationMinutes: estimatedDuration,
    };
  }
}

export const scriptParserAgent = new ScriptParserAgent();
