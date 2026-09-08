export type ScreenplayElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition';

export interface ScreenplayElementMetadata {
  character?: string;
  location?: string;
  timeOfDay?: string;
  isDualDialogue?: boolean;
}

export interface ScreenplayElement {
  id: string;
  type: ScreenplayElementType;
  text: string;
  startOffset: number;
  endOffset: number;
  lineNumber?: number;
  metadata?: ScreenplayElementMetadata;
}

export interface ScreenplayScene {
  id: string;
  sceneNumber?: number;
  heading: string;
  location: string;
  timeOfDay: string;
  elements: ScreenplayElement[];
  startOffset: number;
  endOffset: number;
}

export interface ScreenplayMetadata {
  totalScenes: number;
  totalElements: number;
  estimatedDurationMinutes: number;
  characters: string[];
  locations: string[];
  parsedAt: string;
  sourceFormat: 'pdf' | 'txt' | 'fountain';
}

export interface NormalizedScreenplay {
  title: string;
  author?: string;
  scenes: ScreenplayScene[];
  metadata: ScreenplayMetadata;
}
