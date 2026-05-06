import { get, set } from 'idb-keyval';
// Import prompts using Vite's ?raw
import contentFilterPrompt from '../instructions/content-filter.md?raw';
import glossaryArchitectPrompt from '../instructions/glossary-architect.md?raw';
import memoryHistorianPrompt from '../instructions/memory-historian.md?raw';
import narrativePolisherPrompt from '../instructions/narrative-polisher.md?raw';
import consolidatedRefinementPrompt from '../instructions/consolidated-refinement.md?raw';
import type { ConfigService } from './config-service';

export interface AiResponse {
  content: string;
  error?: string;
}

export interface ExtractedTerm {
  term: string;
  searches: string[];
  category: 'Name' | 'Place' | 'Term' | 'Other';
}

export interface ConsolidatedResult {
  refinedText: string;
  extractedTerms: ExtractedTerm[];
  updatedMemory: string;
}

export class AiBridge {
  private readonly CACHE_PREFIX = 'ai-cache-';
  private configService: ConfigService;

  public onLog?: (message: string, type: 'info' | 'error' | 'success') => void;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  private log(message: string, type: 'info' | 'error' | 'success' = 'info') {
    if (this.onLog) this.onLog(message, type);
  }

  /**
   * Tests the connection to the local AI.
   */
  async testConnection(): Promise<boolean> {
    const config = this.configService.getConfig();
    this.log(`Testing connection to ${config.ai.endpoint}...`, 'info');
    try {
      const response = await fetch(config.ai.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ai.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        this.log('Endpoint responded OK', 'success');
        return true;
      }

      this.log(`Endpoint failed: ${response.status}`, 'error');
      return false;
    } catch (err) {
      this.log(`Connection error: ${err}`, 'error');
      console.error('AI Connection test failed:', err);
      return false;
    }
  }

  /**
   * Generic method to call the local AI with retry logic.
   */
  async callAi(prompt: string, systemPrompt: string, useCache = false): Promise<string> {
    const config = this.configService.getConfig();

    const utf8SafeBase64 = (str: string) =>
      btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16)),
        ),
      );
    // Include system prompt in cache key to avoid collisions between different tasks
    const cacheKey = `${this.CACHE_PREFIX}${utf8SafeBase64(systemPrompt + prompt).substring(0, 48)}`;

    if (useCache) {
      const cached = await get<string>(cacheKey);
      if (cached) {
        this.log('Found result in local cache.', 'success');
        return cached;
      }
    }

    let retries = 3;
    let lastError: unknown;

    while (retries > 0) {
      this.log(`Calling AI (Attempt ${4 - retries}/3)...`, 'info');
      try {
        const response = await fetch(config.ai.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.ai.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: config.ai.temperature,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
          this.log(`AI Error: ${errorMsg}`, 'error');

          if (response.status === 503) {
            // Server Busy
            throw new Error('Server Busy');
          }
          throw new Error(errorMsg);
        }

        const data = (await response.json()) as { choices: { message: { content: string } }[] };
        const result = data.choices[0].message.content;

        if (useCache) {
          await set(cacheKey, result);
        }

        this.log('AI Response received successfully.', 'success');
        return result;
      } catch (err) {
        lastError = err;
        if (err instanceof Error && err.message === 'Server Busy') {
          this.log('Server busy, retrying in 2s...', 'info');
          retries--;
          await new Promise(r => setTimeout(r, 2000)); // Wait before retry
          continue;
        }
        this.log(`AI Call failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        break;
      }
    }

    throw lastError;
  }

  /**
   * Prompt for Name Extraction (The Glossary Architect)
   */
  async extractNames(
    text: string,
    glossaryContext: string,
    memoryContext: string,
    characterContext: string,
    knowledgeBaseContext: string,
  ): Promise<ExtractedTerm[]> {
    if (!glossaryArchitectPrompt) {
      this.log('Glossary Architect prompt is missing or empty!', 'error');
      return [];
    }

    this.log('Extracting names from chapter...', 'info');
    const prompt = glossaryArchitectPrompt
      .replace('{{glossary}}', glossaryContext)
      .replace('{{memory}}', memoryContext)
      .replace('{{characters}}', characterContext)
      .replace('{{knowledge_base}}', knowledgeBaseContext)
      .replace('{{text}}', text);
    const response = await this.callAi(
      prompt,
      'You are a helpful assistant that only outputs valid JSON.',
      false,
    );

    try {
      // Find JSON block or array
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]) as ExtractedTerm[];
        if (Array.isArray(data)) {
          this.log(`Extracted ${data.length} terms.`, 'success');
          return data;
        }
      }
      this.log('No JSON array found in AI response.', 'error');
      console.log('AI Raw Response:', response);
      return [];
    } catch (error) {
      this.log(`Failed to parse Glossary AI output: ${error}`, 'error');
      console.error('Glossary AI Parse Error. Raw response:', response);
      return [];
    }
  }

  /**
   * Prompt for Chapter Refinement (The Narrative Polisher)
   */
  async refineChapter(
    text: string,
    glossaryContext: string,
    memoryContext: string,
    characterContext: string,
    knowledgeBaseContext: string,
  ): Promise<string> {
    const systemPrompt = narrativePolisherPrompt
      .replace('{{memory}}', memoryContext)
      .replace('{{characters}}', characterContext)
      .replace('{{knowledge_base}}', knowledgeBaseContext)
      .replace('{{glossary}}', glossaryContext);

    return this.callAi(text, systemPrompt);
  }

  /**
   * Update the story memory based on the refined chapter.
   */
  async updateMemory(
    chapterText: string,
    currentMemory: string,
    characterContext: string,
    knowledgeBaseContext: string,
  ): Promise<string> {
    const systemPrompt = memoryHistorianPrompt
      .replace('{{memory}}', currentMemory)
      .replace('{{characters}}', characterContext)
      .replace('{{knowledge_base}}', knowledgeBaseContext)
      .replace('{{chapter}}', chapterText.substring(0, 2000)); // Only send a snippet if too large

    return this.callAi('Update story memory.', systemPrompt, false);
  }

  /**
   * Consolidates refinement, glossary extraction, and memory update into one turn.
   */
  async processConsolidated(
    text: string,
    glossaryContext: string,
    memoryContext: string,
    characterContext: string,
    knowledgeBaseContext: string,
  ): Promise<ConsolidatedResult> {
    const systemPrompt = consolidatedRefinementPrompt
      .replace('{{memory}}', memoryContext)
      .replace('{{characters}}', characterContext)
      .replace('{{knowledge_base}}', knowledgeBaseContext)
      .replace('{{glossary}}', glossaryContext);

    const response = await this.callAi(text, systemPrompt, false);

    const refinedText = this.extractBlock(response, 'refined_prose');
    const updatedMemory = this.extractBlock(response, 'updated_memory') || memoryContext;
    const extractedTermsRaw = this.extractBlock(response, 'extracted_terms');

    let extractedTerms: ExtractedTerm[] = [];
    if (extractedTermsRaw) {
      try {
        const jsonMatch = extractedTermsRaw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedTerms = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        this.log('Failed to parse consolidated glossary terms.', 'error');
      }
    }

    return {
      refinedText: refinedText || text,
      extractedTerms,
      updatedMemory,
    };
  }

  private extractBlock(text: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Identify if a single chapter is junk.
   */
  async isJunkChapter(chapter: {
    id: string;
    title: string;
    snippet: string;
  }): Promise<{ remove: boolean; reason?: string }> {
    const input = `Title: ${chapter.title}\nSnippet: ${chapter.snippet.substring(0, 500)}`;
    const prompt = contentFilterPrompt.replace('{{input}}', input);

    try {
      const response = await this.callAi(
        prompt,
        'You are a helpful assistant that only outputs valid JSON.',
        false,
      );
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { remove: false };
    } catch (error) {
      this.log(`Failed to analyze chapter ${chapter.title}: ${error}`, 'error');
      return { remove: false };
    }
  }
}
