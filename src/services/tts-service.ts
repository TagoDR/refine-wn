import type { GlossaryEntry } from './glossary-manager';

export class TtsService {
	private synth = window.speechSynthesis;

	/**
	 * Speaks the text, applying phonetic replacements from the glossary.
	 */
	speak(text: string, glossary: GlossaryEntry[]) {
		this.cancel();

		let processedText = text;

		// Sort glossary by length descending to avoid partial replacements
		const sortedGlossary = [...glossary].sort((a, b) => b.translated.length - a.translated.length);

		for (const entry of sortedGlossary) {
			if (entry.phonetic && entry.phonetic.trim() !== '') {
				// We replace the translated version with the phonetic one for the ear
				const regex = new RegExp(`\\b${this.escapeRegExp(entry.translated)}\\b`, 'gi');
				processedText = processedText.replace(regex, entry.phonetic);
			}
		}

		const utterance = new SpeechSynthesisUtterance(processedText);
		this.synth.speak(utterance);
	}

	cancel() {
		this.synth.cancel();
	}

	private escapeRegExp(string: string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}
