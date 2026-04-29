import { get, set } from 'idb-keyval';

export class StoryMemoryService {
  private static readonly STORAGE_KEY = 'refinewn-story-memory';
  private memory = '';

  /**
   * Loads memory from IndexedDB.
   */
  async load(): Promise<string> {
    const saved = await get<string>(StoryMemoryService.STORAGE_KEY);
    this.memory = saved || 'No memory yet.';
    return this.memory;
  }

  /**
   * Saves memory to IndexedDB.
   */
  async save(newMemory: string): Promise<void> {
    this.memory = newMemory;
    await set(StoryMemoryService.STORAGE_KEY, newMemory);
  }

  /**
   * Returns the current memory.
   */
  getMemory(): string {
    return this.memory;
  }

  /**
   * Clears the memory.
   */
  async clear(): Promise<void> {
    this.memory = '';
    await set(StoryMemoryService.STORAGE_KEY, '');
  }
}
