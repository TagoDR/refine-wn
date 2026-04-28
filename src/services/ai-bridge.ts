import { get, set } from 'idb-keyval';

export interface AiResponse {
  content: string;
  error?: string;
}

export class AiBridge {
  private readonly endpoint = 'http://localhost:5004/v1/chat/completions';
  private readonly testEndpoint = 'http://localhost:5004/v1/responses';
  private readonly CACHE_PREFIX = 'ai-cache-';

  public onLog?: (message: string, type?: 'info' | 'error' | 'success') => void;

  private log(message: string, type: 'info' | 'error' | 'success' = 'info') {
    if (this.onLog) this.onLog(message, type);
  }

  /**
   * Tests the connection to the local AI.
   */
  async testConnection(): Promise<boolean> {
    this.log('Testing connection to port 5004...', 'info');
    try {
      // First try the standard OpenAI format
      this.log(`Trying standard endpoint: ${this.endpoint}`, 'info');
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemma-4-e4b',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        this.log('Standard endpoint responded OK', 'success');
        return true;
      }

      this.log(`Standard endpoint failed: ${response.status}`, 'error');

      // If that fails, try the /v1/responses format provided by the user
      this.log(`Trying alternative endpoint: ${this.testEndpoint}`, 'info');
      const altResponse = await fetch(this.testEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemma-4-e4b',
          input: 'ping',
        }),
      });

      if (altResponse.ok) {
        this.log('Alternative endpoint responded OK', 'success');
        return true;
      }

      this.log(`Alternative endpoint failed: ${altResponse.status}`, 'error');
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
  async callAi(prompt: string, systemPrompt: string, useCache = true): Promise<string> {
    // Fix InvalidCharacterError: btoa only supports Latin1.
    // Use a simple hash or UTF-8 safe encoding for the cache key.
    const utf8SafeBase64 = (str: string) =>
      btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16)),
        ),
      );
    const cacheKey = `${this.CACHE_PREFIX}${utf8SafeBase64(prompt).substring(0, 32)}`;

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
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemma-4-e4b', // Default for LM Studio
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
          this.log(`AI Error: ${errorMsg}`, 'error');

          if (response.status === 503) {
            // Server Busy
            throw new Error('Server Busy');
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
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
  async extractNames(text: string): Promise<string> {
    const systemPrompt = `You are the Glossary Architect. Entity Extraction and Contextual Translation.
Focus on Xianxia/Wuxia/LitRPG terminology.
Identify "Name-Patterns" (e.g., [Surname] [Title], Sect names).
Suggest "High Fantasy" alternatives for literal MTL translations.
Output ONLY a JSON array of objects: [{"original": "...", "translated": "...", "category": "...", "phonetic": "..."}]`;

    return this.callAi(`Extract entities from this text:\n\n${text}`, systemPrompt, false);
  }

  /**
   * Prompt for Chapter Refinement (The Narrative Polisher)
   */
  async refineChapter(text: string, glossaryContext: string): Promise<string> {
    const systemPrompt = `You are the Narrative Polisher. Prose Refinement and Flow Improvement.
Remove MTL artifacts (e.g., "This seat," "The crowd was shocked").
Maintain a consistent tone (Epic/Serious or LitRPG/System-focused).
Strip out double chapter titles and editor notes.
APPLY THIS GLOSSARY STRICTLY:
${glossaryContext}

Output ONLY the refined chapter prose.`;

    return this.callAi(text, systemPrompt);
  }

  /**
   * Identify junk chapters like covers, TOC, copyright, source pages.
   */
  async identifyJunkChapters(
    chapters: { id: string; title: string; snippet: string }[],
  ): Promise<string[]> {
    const systemPrompt = `You are the Content Filter. Your job is to identify "junk" chapters in an EPUB.
Junk chapters include: Covers, Table of Contents, Copyright pages, Forewords, Afterwords, Source/Site advertisements, empty chapters or just book/section titles, or Author notes that are not part of the story prose.
Analyze the titles and snippets provided.
Output ONLY a JSON array of IDs that should be REMOVED.
Example: ["id1", "id2"]`;

    const input = chapters
      .map(c => `ID: ${c.id} | Title: ${c.title} | Snippet: ${c.snippet.substring(0, 300)}`)
      .join('\n---\n');
    try {
      const response = await this.callAi(input, systemPrompt, false);
      // Try to parse the array from the response
      const match = response.match(/\[.*\]/s);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (error) {
      this.log(`Cleanup identification failed: ${error}`, 'error');
      return [];
    }
  }
}
