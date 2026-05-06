import type { ProjectState } from '../types';
import { CharacterService } from './character-service';
import { GlossaryManager } from './glossary-manager';
import { KnowledgeBaseService } from './knowledge-base';
import { StoryMemoryService } from './story-memory';

export class PortabilityService {
  private glossaryManager: GlossaryManager;
  private characterService: CharacterService;
  private storyMemoryService: StoryMemoryService;
  private knowledgeBaseService: KnowledgeBaseService;

  constructor(
    glossaryManager: GlossaryManager,
    characterService: CharacterService,
    storyMemoryService: StoryMemoryService,
    knowledgeBaseService: KnowledgeBaseService,
  ) {
    this.glossaryManager = glossaryManager;
    this.characterService = characterService;
    this.storyMemoryService = storyMemoryService;
    this.knowledgeBaseService = knowledgeBaseService;
  }

  /**
   * Exports the entire project state to a JSON string.
   */
  exportProject(): string {
    const state: ProjectState = {
      glossary: this.glossaryManager.getAllEntries(),
      characters: this.characterService.getAll(),
      memory: this.storyMemoryService.getMemory(),
      knowledgeBase: this.knowledgeBaseService.getKnowledgeBase(),
    };
    return JSON.stringify(state, null, 2);
  }

  /**
   * Imports the project state from a JSON string.
   */
  async importProject(json: string): Promise<void> {
    const state = JSON.parse(json) as ProjectState;

    if (state.glossary) {
      this.glossaryManager.clear();
      for (const entry of state.glossary) {
        this.glossaryManager.upsertEntry(entry);
      }
      await this.glossaryManager.save();
    }

    if (state.characters) {
      this.characterService.setAll(state.characters);
      await this.characterService.save();
    }

    if (state.memory !== undefined) {
      await this.storyMemoryService.save(state.memory);
    }

    if (state.knowledgeBase !== undefined) {
      await this.knowledgeBaseService.save(state.knowledgeBase);
    }
  }
}
