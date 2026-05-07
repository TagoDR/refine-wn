import { get, set } from 'idb-keyval';
import type { Character } from '../types';

export class CharacterService {
  private static readonly STORAGE_KEY = 'refinewn-characters';
  private characters: Character[] = [];

  /**
   * Loads characters from IndexedDB.
   */
  async load(): Promise<Character[]> {
    const saved = await get<Character[]>(CharacterService.STORAGE_KEY);
    this.characters = saved || [];
    return this.characters;
  }

  /**
   * Saves characters to IndexedDB.
   */
  async save(): Promise<void> {
    await set(CharacterService.STORAGE_KEY, this.characters);
  }

  /**
   * Returns all characters.
   */
  getAll(): Character[] {
    return this.characters;
  }

  /**
   * Sets all characters (used for import).
   */
  setAll(characters: Character[]): void {
    this.characters = characters;
  }

  /**
   * Adds or updates a character.
   */
  upsert(character: Character): void {
    const index = this.characters.findIndex(c => c.id === character.id);
    if (index !== -1) {
      this.characters[index] = character;
    } else {
      this.characters.push(character);
    }
  }

  /**
   * Deletes a character by ID.
   */
  delete(id: string): void {
    this.characters = this.characters.filter(c => c.id !== id);
  }

  /**
   * Clears all characters.
   */
  async clear(): Promise<void> {
    this.characters = [];
    await set(CharacterService.STORAGE_KEY, []);
  }

  /**
   * Merges extracted names into the character glossary.
   */
  mergeCharacters(names: { name?: string; term?: string; searches?: string[]; aliases?: string[] }[]): void {
    for (const item of names) {
      const name = item.name || item.term;
      if (!name) continue;

      const newAliases = item.aliases || item.searches || [];

      // Find existing character by name (case-insensitive)
      let existing = this.characters.find(c => c.name.toLowerCase() === name.toLowerCase());

      if (!existing) {
        // Also check if any alias matches the new term
        existing = this.characters.find(c =>
          c.aliases.some(a => a.toLowerCase() === name.toLowerCase()),
        );
      }

      if (existing) {
        // Merge new searches into aliases, avoiding duplicates
        const mergedAliases = new Set([...existing.aliases, ...newAliases]);
        // Also ensure the original searched-for term isn't lost if it was different
        existing.aliases = Array.from(mergedAliases).filter(a => a.toLowerCase() !== existing!.name.toLowerCase());
      } else {
        // Create new character
        this.characters.push({
          id: crypto.randomUUID(),
          name: name,
          aliases: newAliases.filter(s => s.toLowerCase() !== name.toLowerCase()),
          gender: (item as any).gender || '',
          category: (item as any).category || 'Supporting',
          affiliation: (item as any).affiliation || '',
          relationships: (item as any).relationships || '',
        });
      }
    }
  }

  /**
   * Generates a string summary of characters for AI context.
   */
  getAiContext(): string {
    if (this.characters.length === 0) return 'No character information available.';

    return this.characters
      .map(c => {
        let text = `- **${c.name}** (${c.category})\n`;
        if (c.aliases.length > 0) text += `  - Aliases: ${c.aliases.join(', ')}\n`;
        if (c.gender) text += `  - Gender: ${c.gender}\n`;
        if (c.affiliation) text += `  - Affiliation: ${c.affiliation}\n`;
        if (c.relationships) text += `  - Relationships: ${c.relationships}\n`;
        if (c.items) text += `  - Items: ${c.items}\n`;
        if (c.techniques) text += `  - Techniques: ${c.techniques}\n`;
        return text;
      })
      .join('\n');
  }
}
