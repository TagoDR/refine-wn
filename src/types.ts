export interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: string;
}

export type CharacterCategory = 'Main' | 'Supporting' | 'Extra' | 'Background';

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  gender: string;
  category: CharacterCategory;
  affiliation: string;
  relationships: string;
  items?: string;
  techniques?: string;
}

export interface ProjectState {
  glossary: import('./services/glossary-manager').GlossaryEntry[];
  characters: Character[];
  memory: string;
  knowledgeBase: string;
}
