import { get, set } from 'idb-keyval';

export interface GlossaryEntry {
  id: string;
  term: string; // The replacement text
  searches: string[]; // List of strings or regex patterns
  category: 'Name' | 'Place' | 'Term' | 'Other';
  notes?: string;
}

export class GlossaryManager {
  private entries: Map<string, GlossaryEntry> = new Map();
  private readonly STORAGE_KEY = 'refinewn-glossary-v2'; // Bumped version for new schema

  /**
   * Loads the glossary from IndexedDB.
   */
  async load(): Promise<void> {
    const saved = await get<GlossaryEntry[]>(this.STORAGE_KEY);
    if (saved) {
      this.entries = new Map(saved.map(entry => [entry.id, entry]));
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
   * Exports the glossary to a dictionary-style JSON string for .json files.
   * Format: { "Replacement": ["Search1", "Search2"] }
   */
  exportJson(): string {
    const dict: Record<string, string[]> = {};
    for (const entry of this.entries.values()) {
      dict[entry.term] = entry.searches;
    }
    return JSON.stringify(dict, null, 2);
  }

  /**
   * Imports the glossary from a dictionary-style JSON string, appending to existing entries.
   */
  importJson(json: string): void {
    try {
      const dict = JSON.parse(json) as Record<string, string[]>;
      for (const [term, searches] of Object.entries(dict)) {
        // Find existing entry by term to avoid duplicates, or create new
        const existing = Array.from(this.entries.values()).find(e => e.term === term);
        const entry: GlossaryEntry = {
          id: existing?.id || crypto.randomUUID(),
          term: term,
          searches: Array.from(new Set([...(existing?.searches || []), ...searches])),
          category: existing?.category || 'Other'
        };
        this.upsertEntry(entry);
      }
    } catch (e) {
      console.error('Failed to import glossary JSON:', e);
      throw e;
    }
  }
}
