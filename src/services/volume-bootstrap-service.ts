import type { AiBridge, BootstrapResult } from './ai-bridge';
import type { EpubWorkerClient } from './epub-worker-client';
import { TextCleaner } from './text-cleaner';

export class VolumeBootstrapService {
  private textCleaner = new TextCleaner();
  private aiBridge: AiBridge;
  private epubClient: EpubWorkerClient;

  constructor(aiBridge: AiBridge, epubClient: EpubWorkerClient) {
    this.aiBridge = aiBridge;
    this.epubClient = epubClient;
  }

  /**
   * Bootstraps context by analyzing a full EPUB volume.
   */
  async bootstrapFromEpub(
    file: File,
    onLog?: (msg: string, type: 'info' | 'success' | 'error') => void,
    signal?: AbortSignal,
    onProgress?: (percent: number) => void,
  ): Promise<BootstrapResult> {
    if (onLog) onLog(`Loading previous volume: ${file.name}`, 'info');

    const result = await this.epubClient.load(file);
    // Combine all chapter content into one large text pool
    const fullText = result.chapters
      .map(ch => this.textCleaner.clean(ch.content))
      .join('\n\n---\n\n');

    // Chunk size: ~25,000 chars (leaving room for 32k token context prompt + response)
    // Assuming ~4 chars per token, 25k chars is ~6-7k tokens.
    // Given 32k context, we could go much higher, but let's be safe and efficient.
    // 60,000 chars is ~15k tokens. Let's try 80,000 chars for a large context.
    const CHUNK_SIZE = 80000;
    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
      chunks.push(fullText.substring(i, i + CHUNK_SIZE));
    }

    if (onLog) onLog(`Analyzing volume in ${chunks.length} large chunks...`, 'info');

    const combinedResult: BootstrapResult = {
      characters: [],
      terms: [],
      knowledgeBase: '',
      storyMemory: '',
    };

    for (let i = 0; i < chunks.length; i++) {
      if (signal?.aborted) throw new Error('Aborted');
      if (onLog) onLog(`Processing chunk ${i + 1}/${chunks.length}...`, 'info');
      const chunkResult = await this.aiBridge.analyzePreviousVolume(chunks[i], signal);

      // Merge results
      combinedResult.characters = this.mergeCharacters(
        combinedResult.characters,
        chunkResult.characters,
      );
      combinedResult.terms = this.mergeTerms(combinedResult.terms, chunkResult.terms);

      if (chunkResult.knowledgeBase) {
        combinedResult.knowledgeBase += `\n\n--- Chunk ${i + 1} ---\n${chunkResult.knowledgeBase}`;
      }
      if (chunkResult.storyMemory) {
        combinedResult.storyMemory = chunkResult.storyMemory; // Always prefer the latest plot summary
      }

      if (onProgress) onProgress(((i + 1) / chunks.length) * 100);
    }

    if (onLog) onLog('Consolidating extracted context...', 'info');

    return combinedResult;
  }

  private mergeCharacters(existing: any[], newChars: any[]): any[] {
    const map = new Map<string, any>();
    // Pre-populate with existing
    for (const c of existing) map.set((c.name || c.term || '').toLowerCase(), c);

    for (const c of newChars) {
      const name = c.name || c.term;
      if (!name) continue;
      const key = name.toLowerCase();
      
      const newAliases = c.aliases || c.searches || [];

      if (map.has(key)) {
        const char = map.get(key);
        // Merge aliases
        char.aliases = Array.from(new Set([...(char.aliases || []), ...newAliases]));
        // Append other fields if they add info
        if (c.affiliation && !char.affiliation?.includes(c.affiliation))
          char.affiliation = (char.affiliation ? `${char.affiliation}; ` : '') + c.affiliation;
        if (c.relationships && !char.relationships?.includes(c.relationships))
          char.relationships = (char.relationships ? `${char.relationships}; ` : '') + c.relationships;
      } else {
        map.set(key, {
           ...c,
           name,
           aliases: newAliases
        });
      }
    }
    return Array.from(map.values());
  }

  private mergeTerms(existing: any[], newTerms: any[]): any[] {
    const map = new Map<string, any>();
    for (const t of existing) map.set((t.term || '').toLowerCase(), t);

    for (const t of newTerms) {
      if (!t.term) continue;
      const key = t.term.toLowerCase();
      const newSearches = t.searches || [];

      if (map.has(key)) {
        const term = map.get(key);
        term.searches = Array.from(new Set([...(term.searches || []), ...newSearches]));
      } else {
        map.set(key, {
           ...t,
           searches: newSearches
        });
      }
    }
    return Array.from(map.values());
  }
}
