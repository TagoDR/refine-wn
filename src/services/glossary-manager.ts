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
   * Adds or updates an entry. Discards entry if it has no valid search patterns.
   */
  upsertEntry(entry: GlossaryEntry): boolean {
    const term = entry.term.trim();
    if (!term) return false;

    // Filter out search patterns that are identical to the term (case-insensitive)
    const validSearches = entry.searches
      .map(s => s.trim())
      .filter(s => s !== '' && s.toLowerCase() !== term.toLowerCase());

    if (validSearches.length === 0) {
      // If the entry was existing and now has no searches, should we delete it?
      // For upsert, if it's invalid we just don't save/update it.
      return false;
    }

    this.entries.set(entry.id, {
      ...entry,
      term,
      searches: Array.from(new Set(validSearches)), // Ensure uniqueness
    });
    return true;
  }

  /**
   * Deletes an entry.
   */
  deleteEntry(id: string): void {
    this.entries.delete(id);
  }

  /**
   * Clears all entries.
   */
  async clear(): Promise<void> {
    this.entries.clear();
    await this.save();
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
        const existing = Array.from(this.entries.values()).find(e => e.term === term);
        const entry: GlossaryEntry = {
          id: existing?.id || crypto.randomUUID(),
          term: term,
          searches: Array.from(new Set([...(existing?.searches || []), ...searches])),
          category: existing?.category || 'Other',
        };
        this.upsertEntry(entry);
      }
    } catch (e) {
      console.error('Failed to import glossary JSON:', e);
      throw e;
    }
  }

  /**
   * Applies the glossary to a text string.
   * Uses word boundaries and regex escaping for safety.
   */
  applyGlossary(text: string): string {
    let result = text;
    // Sort entries by term length (descending) to avoid partial replacements
    const sortedEntries = this.getAllEntries().sort((a, b) => b.term.length - a.term.length);

    for (const entry of sortedEntries) {
      if (!entry.term || entry.searches.length === 0) continue;

      for (const search of entry.searches) {
        if (!search.trim()) continue;

        try {
          let regex: RegExp;
          if (search.startsWith('/') && search.endsWith('/')) {
            // User provided a raw regex
            regex = new RegExp(search.slice(1, -1), 'gu');
          } else {
            // Standard string search - escape and use word boundaries
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(`\\b${escaped}\\b`, 'gu');
          }

          // Use a replacement function to avoid $1, $2, etc. issues in the term
          result = result.replace(regex, () => entry.term);
        } catch (e) {
          console.error(`Invalid glossary pattern: ${search}`, e);
        }
      }
    }
    return result;
  }

  /**
   * Merges a list of extracted terms into the glossary.
   */
  mergeTerms(terms: { term: string; searches: string[]; category: string }[]): void {
    for (const item of terms) {
      if (item.category === 'Name') continue; // Skip names, handled by CharacterService

      const existing = Array.from(this.entries.values()).find(
        e => e.term.toLowerCase() === item.term.toLowerCase(),
      );
      const entry: GlossaryEntry = {
        id: existing?.id || crypto.randomUUID(),
        term: item.term,
        searches: Array.from(new Set([...(existing?.searches || []), ...item.searches])),
        category: (item.category as GlossaryEntry['category']) || existing?.category || 'Other',
      };
      this.upsertEntry(entry);
    }
  }
}
