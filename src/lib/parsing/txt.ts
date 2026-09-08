import { ScreenplayElement, ScreenplayScene, NormalizedScreenplay } from '../../types/screenplay';
import { normalizeLineEndings, parseHeading, buildMetadata, generateUUID } from './normalize';
import { MalformedFileError } from '../errors/AppError';

export function parsePlainText(rawText: string, defaultTitle: string = 'Untitled Screenplay'): NormalizedScreenplay {
  if (!rawText || rawText.trim().length === 0) {
    throw new MalformedFileError('Plain text screenplay file is empty or contains only whitespace.');
  }

  const normalized = normalizeLineEndings(rawText);
  const lines = normalized.split('\n');

  // Offset tracking
  const lineOffsets: number[] = [];
  let curOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(curOffset);
    curOffset += lines[i].length + 1; // +1 for newline
  }

  let title = defaultTitle;
  let author: string | undefined = undefined;

  const sceneHeadingRegex = /^((INT|EXT|EST|INT\/EXT|INT\.\/EXT|I\/E)(\.|\s))/i;
  const transitionRegex = /^([A-Z\s]+TO:|\s*FADE IN:|\s*FADE OUT:|\s*CUT TO:)/;
  const parentheticalRegex = /^\s*\(.*?\)\s*$/;
  const characterRegex = /^([A-Z0-9\s_'-]+)(\s*\(.*?\))?$/;

  // Process initial title page headers before first scene
  let lineIdx = 0;
  while (lineIdx < lines.length) {
    const trimmed = lines[lineIdx].trim();
    if (!trimmed) {
      lineIdx++;
      continue;
    }

    if (sceneHeadingRegex.test(trimmed)) {
      break;
    }

    if (trimmed.toLowerCase().startsWith('title:')) {
      title = trimmed.substring(6).trim();
      lineIdx++;
      continue;
    }

    if (/^(written by|author|by)\s*:/i.test(trimmed)) {
      author = trimmed.replace(/^(written by|author|by)\s*:/i, '').trim();
      lineIdx++;
      continue;
    }

    if (/^(draft|date|contact|copyright)\s*:/i.test(trimmed)) {
      lineIdx++;
      continue;
    }

    // Stop header parsing once arbitrary screenplay text begins
    break;
  }

  const scenes: ScreenplayScene[] = [];
  let currentScene: ScreenplayScene | null = null;
  let sceneIndex = 1;
  let lastCharacterName: string | undefined = undefined;
  let expectingDialogue = false;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();
    const lineStart = lineOffsets[lineIdx];
    const lineEnd = lineStart + rawLine.length;

    if (!trimmed) {
      expectingDialogue = false;
      lastCharacterName = undefined;
      lineIdx++;
      continue;
    }

    // 1. Scene Heading
    if (sceneHeadingRegex.test(trimmed)) {
      if (currentScene) {
        currentScene.endOffset = lineStart - 1;
        scenes.push(currentScene);
      }

      const { location, timeOfDay } = parseHeading(trimmed);
      const sceneId = generateUUID();
      const headingElement: ScreenplayElement = {
        id: generateUUID(),
        type: 'scene_heading',
        text: trimmed,
        startOffset: lineStart,
        endOffset: lineEnd,
        lineNumber: lineIdx + 1,
        metadata: { location, timeOfDay },
      };

      currentScene = {
        id: sceneId,
        sceneNumber: sceneIndex++,
        heading: trimmed,
        location,
        timeOfDay,
        elements: [headingElement],
        startOffset: lineStart,
        endOffset: lineEnd,
      };

      expectingDialogue = false;
      lastCharacterName = undefined;
      lineIdx++;
      continue;
    }

    // Ensure we have a scene container even if script starts before heading
    if (!currentScene) {
      const sceneId = generateUUID();
      currentScene = {
        id: sceneId,
        sceneNumber: sceneIndex++,
        heading: 'OPENING',
        location: 'UNKNOWN',
        timeOfDay: 'UNKNOWN',
        elements: [],
        startOffset: lineStart,
        endOffset: lineEnd,
      };
    }

    // 2. Transition
    if (transitionRegex.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      currentScene.elements.push({
        id: generateUUID(),
        type: 'transition',
        text: trimmed,
        startOffset: lineStart,
        endOffset: lineEnd,
        lineNumber: lineIdx + 1,
      });
      currentScene.endOffset = Math.max(currentScene.endOffset, lineEnd);
      expectingDialogue = false;
      lastCharacterName = undefined;
      lineIdx++;
      continue;
    }

    // 3. Character line:
    // Uppercase, relatively short (< 35 chars), surrounded by spaces or previous line empty
    const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length < 40;
    const prevLineEmpty = lineIdx === 0 || lines[lineIdx - 1].trim() === '';

    if (isUpper && prevLineEmpty && characterRegex.test(trimmed) && lineIdx + 1 < lines.length) {
      const nextTrimmed = lines[lineIdx + 1].trim();
      if (nextTrimmed && !sceneHeadingRegex.test(nextTrimmed)) {
        const cleanName = trimmed.replace(/\s*\(.*?\)\s*$/, '').trim();
        lastCharacterName = cleanName;
        currentScene.elements.push({
          id: generateUUID(),
          type: 'character',
          text: trimmed,
          startOffset: lineStart,
          endOffset: lineEnd,
          lineNumber: lineIdx + 1,
          metadata: { character: cleanName },
        });
        currentScene.endOffset = Math.max(currentScene.endOffset, lineEnd);
        expectingDialogue = true;
        lineIdx++;
        continue;
      }
    }

    // 4. Parenthetical
    if (parentheticalRegex.test(trimmed) && (expectingDialogue || lastCharacterName)) {
      currentScene.elements.push({
        id: generateUUID(),
        type: 'parenthetical',
        text: trimmed,
        startOffset: lineStart,
        endOffset: lineEnd,
        lineNumber: lineIdx + 1,
        metadata: { character: lastCharacterName },
      });
      currentScene.endOffset = Math.max(currentScene.endOffset, lineEnd);
      lineIdx++;
      continue;
    }

    // 5. Dialogue
    if (expectingDialogue && lastCharacterName) {
      const dialogueLines: string[] = [trimmed];
      let dEnd = lineEnd;
      lineIdx++;

      while (lineIdx < lines.length) {
        const nextRaw = lines[lineIdx];
        const nextTrimmed = nextRaw.trim();
        if (!nextTrimmed) break;
        if (parentheticalRegex.test(nextTrimmed)) break;
        dialogueLines.push(nextTrimmed);
        dEnd = lineOffsets[lineIdx] + nextRaw.length;
        lineIdx++;
      }

      currentScene.elements.push({
        id: generateUUID(),
        type: 'dialogue',
        text: dialogueLines.join('\n'),
        startOffset: lineStart,
        endOffset: dEnd,
        lineNumber: lineIdx,
        metadata: { character: lastCharacterName },
      });
      currentScene.endOffset = Math.max(currentScene.endOffset, dEnd);
      continue;
    }

    // 6. Action / Narrative Description
    const actionLines: string[] = [trimmed];
    let aEnd = lineEnd;
    lineIdx++;

    while (lineIdx < lines.length) {
      const nextRaw = lines[lineIdx];
      const nextTrimmed = nextRaw.trim();
      if (!nextTrimmed) break;
      if (sceneHeadingRegex.test(nextTrimmed)) break;
      if (
        nextTrimmed === nextTrimmed.toUpperCase() &&
        characterRegex.test(nextTrimmed) &&
        lines[lineIdx - 1].trim() === ''
      ) {
        break;
      }
      actionLines.push(nextTrimmed);
      aEnd = lineOffsets[lineIdx] + nextRaw.length;
      lineIdx++;
    }

    currentScene.elements.push({
      id: generateUUID(),
      type: 'action',
      text: actionLines.join(' '),
      startOffset: lineStart,
      endOffset: aEnd,
      lineNumber: lineIdx,
    });
    currentScene.endOffset = Math.max(currentScene.endOffset, aEnd);
    expectingDialogue = false;
    lastCharacterName = undefined;
  }

  if (currentScene) {
    scenes.push(currentScene);
  }

  if (scenes.length === 0) {
    throw new MalformedFileError('Unable to extract any screenplay scenes from the plain text file.');
  }

  const metadata = buildMetadata(scenes, 'txt');

  return {
    title,
    author,
    scenes,
    metadata,
  };
}
