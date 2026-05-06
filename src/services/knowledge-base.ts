import { get, set } from 'idb-keyval';

export class KnowledgeBaseService {
  private static readonly STORAGE_KEY = 'refinewn-knowledge-base';
  private content = '';

  private readonly DEFAULT_TEMPLATE = `## Style Guide
- **Tone**: Epic/Serious
- **Perspective**: Third person limited
- **Honorifics**: Keep -er, -ge, -shidi suffixes

## World Building
- **Cultivation Stages**: Qi Condensation, Foundation Establishment...
- **Factions**: Blue Cloud Sect, Crimson Peak...

## MTL Correction Rules
- **'This Seat'**: Translate as "I" when spoken by high-ranking elders or sect leaders.
- **'Took a cold breath'**: Translate as "Gasped in shock" or "Took a sharp intake of breath".
- **'Beautiful and Beautiful'**: Fix repetitive descriptors that result from synonym translation.
`;

  /**
   * Loads knowledge base from IndexedDB.
   */
  async load(): Promise<string> {
    const saved = await get<string>(KnowledgeBaseService.STORAGE_KEY);
    this.content = saved || this.DEFAULT_TEMPLATE;
    return this.content;
  }

  /**
   * Saves knowledge base to IndexedDB.
   */
  async save(newContent: string): Promise<void> {
    this.content = newContent;
    await set(KnowledgeBaseService.STORAGE_KEY, newContent);
  }

  /**
   * Returns the current content.
   */
  getKnowledgeBase(): string {
    return this.content;
  }

  /**
   * Clears the knowledge base.
   */
  async clear(): Promise<void> {
    this.content = '';
    await set(KnowledgeBaseService.STORAGE_KEY, '');
  }
}
