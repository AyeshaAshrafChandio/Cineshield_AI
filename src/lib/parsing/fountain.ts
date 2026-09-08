import { ScreenplayElement, ScreenplayScene, NormalizedScreenplay } from '../../types/screenplay';
import { normalizeLineEndings, parseHeading, buildMetadata, generateUUID } from './normalize';
import { MalformedFileError } from '../errors/AppError';

interface ParsedBlock {
  type: 'title_page' | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';
  text: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  metadata?: Record<string, unknown>;
}

export function parseFountain(rawText: string, defaultTitle: string = 'Untitled Screenplay'): NormalizedScreenplay {
  if (!rawText || rawText.trim().length === 0) {
    throw new MalformedFileError('Fountain file is empty or contains only whitespace.');
  }

  const normalized = normalizeLineEndings(rawText);

  // 1. Extract Title Page if present
  let title = defaultTitle;
  let author: string | undefined = undefined;
  let textStartIndex = 0;

  const lines = normalized.split('\n');
  let inTitlePage = true;
  let currentOffset = 0;
  const lineOffsets: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(currentOffset);
    currentOffset += lines[i].length + 1; // +1 for \n
  }

  let lineIdx = 0;
  // Check if first lines look like title page
  const titlePageKeyRegex = /^(title|credit|author|authors|source|draft date|contact|copyright):\s*(.*)$/i;

  while (lineIdx < lines.length && inTitlePage) {
    const line = lines[lineIdx].trim();
    if (line === '') {
      // Check if subsequent lines continue title page or start script
      if (lineIdx + 1 < lines.length) {
        const nextLine = lines[lineIdx + 1].trim();
        if (!titlePageKeyRegex.test(nextLine) && !nextLine.startsWith('   ')) {
          inTitlePage = false;
          lineIdx++;
          break;
        }
      } else {
        inTitlePage = false;
        break;
      }
    } else {
      const match = line.match(titlePageKeyRegex);
      if (match) {
        const key = match[1].toLowerCase();
        const val = match[2].trim();
        if (key === 'title') {
          title = val;
        } else if (key === 'author' || key === 'authors') {
          author = val;
        }
      } else if (!line.startsWith('   ') && lineIdx === 0) {
        // First line is not a title page key
        inTitlePage = false;
        break;
      }
    }
    lineIdx++;
  }

  if (!inTitlePage) {
    // If not in title page, reset index if first line wasn't title page
    if (title === defaultTitle && !titlePageKeyRegex.test(lines[0].trim())) {
      lineIdx = 0;
    }
  }

  // 2. Parse screenplay elements
  const blocks: ParsedBlock[] = [];
  const sceneHeadingRegex = /^((INT|EXT|EST|INT\/EXT|INT\.\/EXT|I\/E)(\.|\s)|^\.[A-Z0-9])/i;
  const transitionRegex = /^([A-Z\s]+TO:|\s*>\s*[^<]+<\s*|\s*>[A-Z\s:]+)$/;
  const characterRegex = /^([A-Z0-9\s_'-]+)(\s*\(.*?\))?$/;
  const parentheticalRegex = /^\s*\(.*?\)\s*$/;

  let prevBlockType: ParsedBlock['type'] | null = null;
  let lastCharacterName: string | undefined = undefined;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();
    const lineStartOffset = lineOffsets[lineIdx];
    const lineEndOffset = lineStartOffset + rawLine.length;

    // Skip empty lines
    if (!trimmed) {
      lineIdx++;
      continue;
    }

    // Skip comments / boneyard /* ... */
    if (trimmed.startsWith('/*')) {
      while (lineIdx < lines.length && !lines[lineIdx].includes('*/')) {
        lineIdx++;
      }
      lineIdx++;
      continue;
    }

    // Skip synopses (=) and section headings (#)
    if (trimmed.startsWith('=') || trimmed.startsWith('#')) {
      lineIdx++;
      continue;
    }

    // 1. Scene Heading
    if (sceneHeadingRegex.test(trimmed)) {
      const headingText = trimmed.startsWith('.') ? trimmed.substring(1).trim() : trimmed;
      blocks.push({
        type: 'scene_heading',
        text: headingText,
        startOffset: lineStartOffset,
        endOffset: lineEndOffset,
        lineNumber: lineIdx + 1,
      });
      prevBlockType = 'scene_heading';
      lastCharacterName = undefined;
      lineIdx++;
      continue;
    }

    // 2. Transition (e.g. "CUT TO:", "> FADE OUT: <")
    if (transitionRegex.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      const cleanTransition = trimmed.replace(/^>\s*/, '').replace(/\s*<$/, '');
      blocks.push({
        type: 'transition',
        text: cleanTransition,
        startOffset: lineStartOffset,
        endOffset: lineEndOffset,
        lineNumber: lineIdx + 1,
      });
      prevBlockType = 'transition';
      lastCharacterName = undefined;
      lineIdx++;
      continue;
    }

    // 3. Forced Character (@NAME) or Character Name
    // A character line is uppercase, usually preceded by a blank line, and has following lines
    const isForcedCharacter = rawLine.startsWith('@');
    const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
    const prevLineEmpty = lineIdx === 0 || lines[lineIdx - 1].trim() === '';

    if ((isForcedCharacter || (isUpper && prevLineEmpty && characterRegex.test(trimmed))) && lineIdx + 1 < lines.length) {
      const nextLineTrimmed = lines[lineIdx + 1].trim();
      // Only treat as character if followed by dialogue or parenthetical, not empty or scene heading
      if (nextLineTrimmed && !sceneHeadingRegex.test(nextLineTrimmed)) {
        const charName = isForcedCharacter ? trimmed.substring(1).trim() : trimmed;
        blocks.push({
          type: 'character',
          text: charName,
          startOffset: lineStartOffset,
          endOffset: lineEndOffset,
          lineNumber: lineIdx + 1,
          metadata: { character: charName },
        });
        prevBlockType = 'character';
        lastCharacterName = charName;
        lineIdx++;
        continue;
      }
    }

    // 4. Parenthetical (inside dialogue)
    if (parentheticalRegex.test(trimmed) && (prevBlockType === 'character' || prevBlockType === 'dialogue')) {
      blocks.push({
        type: 'parenthetical',
        text: trimmed,
        startOffset: lineStartOffset,
        endOffset: lineEndOffset,
        lineNumber: lineIdx + 1,
        metadata: { character: lastCharacterName },
      });
      prevBlockType = 'parenthetical';
      lineIdx++;
      continue;
    }

    // 5. Dialogue (following character or parenthetical)
    if (prevBlockType === 'character' || prevBlockType === 'parenthetical' || prevBlockType === 'dialogue') {
      // Collect dialogue lines until an empty line
      const dialogueLines: string[] = [trimmed];
      let endOffset = lineEndOffset;
      lineIdx++;

      while (lineIdx < lines.length) {
        const nextRaw = lines[lineIdx];
        const nextTrimmed = nextRaw.trim();
        if (!nextTrimmed) {
          break; // Empty line ends dialogue
        }
        if (parentheticalRegex.test(nextTrimmed)) {
          // Parenthetical inside dialogue
          break;
        }
        dialogueLines.push(nextTrimmed);
        endOffset = lineOffsets[lineIdx] + nextRaw.length;
        lineIdx++;
      }

      blocks.push({
        type: 'dialogue',
        text: dialogueLines.join('\n'),
        startOffset: lineStartOffset,
        endOffset: endOffset,
        lineNumber: lineIdx,
        metadata: { character: lastCharacterName },
      });
      prevBlockType = 'dialogue';
      continue;
    }

    // 6. Action / Description
    // Collect multiline action block
    const actionLines: string[] = [trimmed];
    let endOffset = lineEndOffset;
    lineIdx++;

    while (lineIdx < lines.length) {
      const nextRaw = lines[lineIdx];
      const nextTrimmed = nextRaw.trim();
      if (!nextTrimmed) {
        break; // Empty line ends action block
      }
      if (
        sceneHeadingRegex.test(nextTrimmed) ||
        (nextTrimmed === nextTrimmed.toUpperCase() && characterRegex.test(nextTrimmed) && lines[lineIdx - 1].trim() === '')
      ) {
        break;
      }
      actionLines.push(nextTrimmed);
      endOffset = lineOffsets[lineIdx] + nextRaw.length;
      lineIdx++;
    }

    blocks.push({
      type: 'action',
      text: actionLines.join(' '),
      startOffset: lineStartOffset,
      endOffset: endOffset,
      lineNumber: lineIdx,
    });
    prevBlockType = 'action';
    lastCharacterName = undefined;
  }

  // 3. Assemble Normalized Scenes
  const scenes: ScreenplayScene[] = [];
  let currentScene: ScreenplayScene | null = null;
  let sceneIndex = 1;

  for (const block of blocks) {
    if (block.type === 'title_page') {
      continue;
    }

    if (block.type === 'scene_heading') {
      if (currentScene) {
        currentScene.endOffset = block.startOffset - 1;
        scenes.push(currentScene);
      }
      const { location, timeOfDay } = parseHeading(block.text);
      const sceneId = generateUUID();
      const headingElement: ScreenplayElement = {
        id: generateUUID(),
        type: 'scene_heading',
        text: block.text,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        lineNumber: block.lineNumber,
        metadata: { location, timeOfDay },
      };

      currentScene = {
        id: sceneId,
        sceneNumber: sceneIndex++,
        heading: block.text,
        location,
        timeOfDay,
        elements: [headingElement],
        startOffset: block.startOffset,
        endOffset: block.endOffset,
      };
    } else {
      if (!currentScene) {
        // Action before first heading (e.g. teaser, opening prologue)
        const sceneId = generateUUID();
        currentScene = {
          id: sceneId,
          sceneNumber: sceneIndex++,
          heading: 'OPENING',
          location: 'UNKNOWN',
          timeOfDay: 'UNKNOWN',
          elements: [],
          startOffset: block.startOffset,
          endOffset: block.endOffset,
        };
      }

      const element: ScreenplayElement = {
        id: generateUUID(),
        type: block.type,
        text: block.text,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        lineNumber: block.lineNumber,
        metadata: block.metadata,
      };

      currentScene.elements.push(element);
      currentScene.endOffset = Math.max(currentScene.endOffset, block.endOffset);
    }
  }

  if (currentScene) {
    scenes.push(currentScene);
  }

  if (scenes.length === 0) {
    throw new MalformedFileError('Unable to extract any screenplay scenes or dialogue from the Fountain document.');
  }

  const metadata = buildMetadata(scenes, 'fountain');

  return {
    title,
    author,
    scenes,
    metadata,
  };
}
