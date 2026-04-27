import { get, set } from 'idb-keyval';

export interface GlossaryEntry {
	id: string;
	original: string;
	translated: string;
	phonetic: string;
	category: 'Name' | 'Place' | 'Term' | 'Other';
	notes?: string;
}

export class GlossaryManager {
	private entries: Map<string, GlossaryEntry> = new Map();
	private readonly STORAGE_KEY = 'refinewn-glossary';

	/**
	 * Loads the glossary from IndexedDB.
	 */
	async load(): Promise<void> {
		const saved = await get<GlossaryEntry[]>(this.STORAGE_KEY);
		if (saved) {
			this.entries = new Map(saved.map((entry) => [entry.id, entry]));
		}
	}

	/**
	 * Persists the current glossary to IndexedDB.
	 */
	async save(): Promise<void> {
		await set(this.STORAGE_KEY, Array.from(this.entries.values()));
	}

	/**
	 * Adds or updates an entry.
	 */
	upsertEntry(entry: GlossaryEntry): void {
		this.entries.set(entry.id, entry);
	}

	/**
	 * Deletes an entry.
	 */
	deleteEntry(id: string): void {
		this.entries.delete(id);
	}

	/**
	 * Returns all entries as an array.
	 */
	getAllEntries(): GlossaryEntry[] {
		return Array.from(this.entries.values());
	}

	/**
	 * Exports the glossary to a JSON string.
	 */
	exportJson(): string {
		return JSON.stringify(this.getAllEntries(), null, 2);
	}

	/**
	 * Imports the glossary from a JSON string.
	 */
	importJson(json: string): void {
		const parsed = JSON.parse(json) as GlossaryEntry[];
		for (const entry of parsed) {
			this.upsertEntry(entry);
		}
	}
}
