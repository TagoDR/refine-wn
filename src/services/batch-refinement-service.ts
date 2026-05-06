import type { AiBridge } from './ai-bridge';
import type { ConfigService } from './config-service';
import type { GlossaryManager } from './glossary-manager';
import type { StoryMemoryService } from './story-memory';
import type { CharacterService } from './character-service';
import type { KnowledgeBaseService } from './knowledge-base';
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

      // 1. Refine Chunk
      let chunkRefined = await this.aiBridge.refineChapter(
        chunks[i],
        glossaryContext,
        memoryContext,
        characterContext,
        pkbContext,
      );

      // Clean up markdown wrappers if AI included them
      chunkRefined = this.stripMarkdown(chunkRefined);

      // 2. Extract Terms from refined chunk
      const extracted = await this.aiBridge.extractNames(
        chunkRefined,
        glossaryContext,
        memoryContext,
        characterContext,
        pkbContext,
      );
      if (extracted.length > 0) {
        this.glossaryManager.mergeTerms(extracted);
        await this.glossaryManager.save();
        if (onLog) {
          onLog(`Glossary updated with ${extracted.length} terms from chunk ${i + 1}.`, 'success');
        }
      }

      // 3. Update Story Memory
      const updatedMemory = await this.aiBridge.updateMemory(
        chunkRefined,
        memoryContext,
        characterContext,
        pkbContext,
      );
      await this.storyMemoryService.save(updatedMemory);

      fullRefinedContent += `${chunkRefined}\n\n`;
    }

    // 4. Final Glossary Application Pass
    const finalContent = this.glossaryManager.applyGlossary(fullRefinedContent.trim());

    return finalContent;
  }

  private stripMarkdown(text: string): string {
    return text.replace(/```(?:html|xml)?\n?([\s\S]*?)```/g, '$1').trim();
  }
}
