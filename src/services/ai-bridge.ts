import { get, set } from 'idb-keyval';

export interface AiResponse {
	content: string;
	error?: string;
}

export class AiBridge {
	private readonly endpoint = 'http://localhost:1234/v1/chat/completions';
	private readonly CACHE_PREFIX = 'ai-cache-';

	/**
	 * Generic method to call the local AI with retry logic.
	 */
	async callAi(prompt: string, systemPrompt: string, useCache = true): Promise<string> {
		const cacheKey = `${this.CACHE_PREFIX}${btoa(prompt).substring(0, 32)}`;
		
		if (useCache) {
			const cached = await get<string>(cacheKey);
			if (cached) return cached;
		}

		let retries = 3;
		let lastError: any;

		while (retries > 0) {
			try {
				const response = await fetch(this.endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: 'gemma-4b', // Default for LM Studio
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: prompt }
						],
						temperature: 0.7,
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					if (response.status === 503) { // Server Busy
						throw new Error('Server Busy');
					}
					throw new Error(errorData.error?.message || 'AI request failed');
				}

				const data = await response.json();
				const result = data.choices[0].message.content;

				if (useCache) {
					await set(cacheKey, result);
				}

				return result;
			} catch (err: any) {
				lastError = err;
				if (err.message === 'Server Busy') {
					retries--;
					await new Promise(r => setTimeout(r, 2000)); // Wait before retry
					continue;
				}
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
}
