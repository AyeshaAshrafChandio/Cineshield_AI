import { describe, it, expect } from 'vitest';
import { parseFountain } from '../src/lib/parsing/fountain';
import { parsePlainText } from '../src/lib/parsing/txt';
import { parsePdf } from '../src/lib/parsing/pdf';
import { MalformedFileError } from '../src/lib/errors/AppError';

describe('Screenplay Parsing Engine', () => {
  describe('Fountain Parser', () => {
    const sampleFountain = `Title: THE QUANTUM HEIST
Author: Jane Doe

EXT. HIGH TECH LAB - NIGHT

Heavy rain lashes against the reinforced glass windows. ALICE (30s) examines the glowing security terminal.

ALICE
(whispering)
We have exactly forty-five seconds before the perimeter alarm trips.

BOB
(over radio)
The bridge is clear. Move now!

> CUT TO: <

INT. VAULT CORRIDOR - CONTINUOUS

Alice drops from the ceiling vent, landing silently on the polished marble floor.`;

    it('should parse title and author from title page headers', () => {
      const parsed = parseFountain(sampleFountain);
      expect(parsed.title).toBe('THE QUANTUM HEIST');
      expect(parsed.author).toBe('Jane Doe');
    });

    it('should accurately extract scenes and scene headings', () => {
      const parsed = parseFountain(sampleFountain);
      expect(parsed.scenes.length).toBe(2);

      const scene1 = parsed.scenes[0];
      expect(scene1.heading).toBe('EXT. HIGH TECH LAB - NIGHT');
      expect(scene1.location).toBe('HIGH TECH LAB');
      expect(scene1.timeOfDay).toBe('NIGHT');

      const scene2 = parsed.scenes[1];
      expect(scene2.heading).toBe('INT. VAULT CORRIDOR - CONTINUOUS');
      expect(scene2.location).toBe('VAULT CORRIDOR');
      expect(scene2.timeOfDay).toBe('CONTINUOUS');
    });

    it('should generate valid, non-literal UUIDs for every scene and element', () => {
      const parsed = parseFountain(sampleFountain);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const scene of parsed.scenes) {
        expect(scene.id).toMatch(uuidRegex);
        expect(scene.id).not.toBe('crypto.randomUUID()');

        for (const element of scene.elements) {
          expect(element.id).toMatch(uuidRegex);
          expect(element.id).not.toBe('crypto.randomUUID()');
        }
      }
    });

    it('should accurately track character cues, parentheticals, dialogue, and transitions', () => {
      const parsed = parseFountain(sampleFountain);
      const elements = parsed.scenes[0].elements;

      const characters = elements.filter((e) => e.type === 'character');
      const dialogues = elements.filter((e) => e.type === 'dialogue');
      const parentheticals = elements.filter((e) => e.type === 'parenthetical');
      const transitions = elements.filter((e) => e.type === 'transition');

      expect(characters.length).toBeGreaterThanOrEqual(2);
      expect(dialogues.length).toBeGreaterThanOrEqual(2);
      expect(parentheticals.length).toBeGreaterThanOrEqual(2);
      expect(transitions.length).toBe(1);

      expect(transitions[0].text).toBe('CUT TO:');
      expect(dialogues[0].text).toContain('forty-five seconds');
    });

    it('should maintain valid, strictly non-negative offsets', () => {
      const parsed = parseFountain(sampleFountain);
      for (const scene of parsed.scenes) {
        expect(scene.startOffset).toBeGreaterThanOrEqual(0);
        expect(scene.endOffset).toBeGreaterThan(scene.startOffset);

        for (const el of scene.elements) {
          expect(el.startOffset).toBeGreaterThanOrEqual(0);
          expect(el.endOffset).toBeGreaterThan(el.startOffset);
        }
      }
    });

    it('should throw MalformedFileError on empty or whitespace fountain input', () => {
      expect(() => parseFountain('')).toThrow(MalformedFileError);
      expect(() => parseFountain('   \n  \n  ')).toThrow(MalformedFileError);
    });
  });

  describe('Plain Text (TXT) Parser', () => {
    const sampleTxt = `Title: MIDNIGHT RUNNERS
Written by: Alex Chen

INT. WAREHOUSE - NIGHT

Rows of stacked shipping containers cast long shadows.

MARCUS
Did anyone follow you?

SARAH
(catching her breath)
No. We lost them three blocks back.

MARCUS
Good. Grab the drive and let's go.

FADE OUT:`;

    it('should parse industry standard plain text screenplay format', () => {
      const parsed = parsePlainText(sampleTxt);
      expect(parsed.title).toBe('MIDNIGHT RUNNERS');
      expect(parsed.author).toBe('Alex Chen');
      expect(parsed.scenes.length).toBe(1);

      const scene = parsed.scenes[0];
      expect(scene.heading).toBe('INT. WAREHOUSE - NIGHT');
      expect(scene.location).toBe('WAREHOUSE');
      expect(scene.timeOfDay).toBe('NIGHT');
    });

    it('should extract characters and metadata statistics correctly', () => {
      const parsed = parsePlainText(sampleTxt);
      expect(parsed.metadata.characters).toContain('MARCUS');
      expect(parsed.metadata.characters).toContain('SARAH');
      expect(parsed.metadata.locations).toContain('WAREHOUSE');
      expect(parsed.metadata.totalScenes).toBe(1);
      expect(parsed.metadata.sourceFormat).toBe('txt');
    });

    it('should throw MalformedFileError on empty plain text input', () => {
      expect(() => parsePlainText('')).toThrow(MalformedFileError);
      expect(() => parsePlainText('   ')).toThrow(MalformedFileError);
    });
  });

  describe('PDF Parser', () => {
    it('should reject non-PDF binary buffers missing the %PDF- signature', async () => {
      const fakeBuffer = Buffer.from('NOT A PDF FILE AT ALL');
      await expect(parsePdf(fakeBuffer)).rejects.toThrow(MalformedFileError);
    });

    it('should reject 0-byte buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(parsePdf(emptyBuffer)).rejects.toThrow(MalformedFileError);
    });

    it('should reject corrupted PDF buffer with invalid internal structures', async () => {
      const corruptPdf = Buffer.from('%PDF-1.4\ncorrupted junk payload');
      await expect(parsePdf(corruptPdf)).rejects.toThrow(MalformedFileError);
    });
  });
});
