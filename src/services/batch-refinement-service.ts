import type { AiBridge } from './ai-bridge';
import type { CharacterService } from './character-service';
import type { ConfigService } from './config-service';
import type { GlossaryManager } from './glossary-manager';
import type { KnowledgeBaseService } from './knowledge-base';
import type { StoryMemoryService } from './story-memory';
import { TextCleaner } from './text-cleaner';
import { splitText } from './text-splitter';

export class BatchRefinementService {
  private textCleaner = new TextCleaner();
  private aiBridge: AiBridge;
  private storyMemoryService: StoryMemoryService;
  private glossaryManager: GlossaryManager;
  private configService: ConfigService;
  private characterService: CharacterService;
  private knowledgeBaseService: KnowledgeBaseService;

  constructor(
    aiBridge: AiBridge,
    storyMemoryService: StoryMemoryService,
    glossaryManager: GlossaryManager,
    configService: ConfigService,
    characterService: CharacterService,
    knowledgeBaseService: KnowledgeBaseService,
  ) {
    this.aiBridge = aiBridge;
    this.storyMemoryService = storyMemoryService;
    this.glossaryManager = glossaryManager;
    this.configService = configService;
    this.characterService = characterService;
    this.knowledgeBaseService = knowledgeBaseService;
  }

  /**
   * Refines a single chapter by splitting it into chunks and processing each sequentially.
   * Updates Glossary and Story Memory directly after each chunk.
   */
  async refineChapter(
    content: string,
    onLog?: (msg: string, type: 'info' | 'success' | 'error') => void,
  ): Promise<string> {
    const config = this.configService.getConfig();
    const cleaned = this.textCleaner.clean(content);

    // Use maxContext with a safety margin for prompts and memory (approx 4000 chars)
    const maxChars = config.ai.maxContext - 4000;
    const chunks = splitText(cleaned, maxChars);

    let fullRefinedContent = '';

    for (let i = 0; i < chunks.length; i++) {
      if (onLog && chunks.length > 1) {
        onLog(`Processing chunk ${i + 1}/${chunks.length}...`, 'info');
      }

      const glossaryContext = JSON.stringify(this.glossaryManager.getAllEntries());
      const memoryContext = this.storyMemoryService.getMemory();
      const characterContext = this.characterService.getAiContext();
      const pkbContext = this.knowledgeBaseService.getKnowledgeBase();

      // 1. Process Consolidated (Refine, Extract, Memory)
      const result = await this.aiBridge.processConsolidated(
        chunks[i],
        glossaryContext,
        memoryContext,
        characterContext,
        pkbContext,
      );

      let chunkRefined = result.refinedText;

      // Clean up markdown wrappers if AI included them
      chunkRefined = this.stripMarkdown(chunkRefined);

      // 2. Merge Extracted Terms
      if (result.extractedTerms.length > 0) {
        // Split names from other terms
        const names = result.extractedTerms.filter(t => t.category === 'Name');
        const terms = result.extractedTerms.filter(t => t.category !== 'Name');

        if (names.length > 0) {
          this.characterService.mergeCharacters(names);
          await this.characterService.save();
        }

        if (terms.length > 0) {
          this.glossaryManager.mergeTerms(terms);
          await this.glossaryManager.save();
        }

        if (onLog) {
          onLog(
            `Context updated: ${names.length} characters, ${terms.length} terms found in chunk ${i + 1}.`,
            'success',
          );
        }
      }

      // 3. Update Story Memory
      await this.storyMemoryService.save(result.updatedMemory);

      fullRefinedContent += `${chunkRefined}\n\n`;
    }

    return fullRefinedContent.trim();
  }

  private stripMarkdown(text: string): string {
    return text.replace(/```(?:html|xml)?\n?([\s\S]*?)```/g, '$1').trim();
  }
}
