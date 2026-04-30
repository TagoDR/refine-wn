import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { AiBridge } from './services/ai-bridge';
import { type AppConfig, ConfigService } from './services/config-service';
import type { Chapter, EpubMetadata } from './services/epub-service';
import { EpubWorkerClient } from './services/epub-worker-client';
import { type GlossaryEntry, GlossaryManager } from './services/glossary-manager';
import { StoryMemoryService } from './services/story-memory';
import { TextCleaner } from './services/text-cleaner';
import { splitText } from './services/text-splitter';
import type { LogEntry } from './types';

// Modular Column Components
import './components/chapter-column';
import './components/glossary-column';
import './components/reader-column';
import './components/service-column';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
		:host {
			display: block;
			height: 100vh;
			background-color: var(--wa-color-surface-default);
			color: var(--wa-color-text-normal);
			font-family: var(--wa-font-family-sans);
			overflow: hidden;
		}

		.app-grid {
			display: grid;
			grid-template-columns: 280px 320px 1fr 280px;
			height: 100vh;
			overflow: hidden;
		}

		wa-dialog {
			--width: 500px;
		}
	`;

  @state() private chapters: Chapter[] = [];
  @state() private metadata: EpubMetadata | null = null;
  @state() private selectedChapterIndex = -1;
  @state() private glossaryEntries: GlossaryEntry[] = [];
  @state() private isProcessing = false;
  @state() private isPaused = false;
  @state() private progress = 0;
  @state() private currentStep = 0;
  @state() private totalSteps = 0;
  @state() private statusMessage = '';
  @state() private diffMode = false;
  @state() private logs: LogEntry[] = [];

  @state() private isGlossaryDialogOpen = false;
  @state() private isConfigDialogOpen = false;
  @state() private isMemoryDialogOpen = false;
  @state() private editingEntry: GlossaryEntry | null = null;
  @state() private currentConfig: AppConfig | null = null;
  @state() private storyMemory = '';

  private epubClient = new EpubWorkerClient();
  private configService = new ConfigService();
  private aiBridge = new AiBridge(this.configService);
  private glossaryManager = new GlossaryManager();
  private storyMemoryService = new StoryMemoryService();
  private textCleaner = new TextCleaner();

  private addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs = [...this.logs, { type, message, timestamp }];
  }

  async firstUpdated() {
    this.currentConfig = await this.configService.load();
    await this.glossaryManager.load();
    this.storyMemory = await this.storyMemoryService.load();

    // Auto-load test glossary for faster testing if empty
    if (this.glossaryManager.getAllEntries().length === 0) {
      try {
        const response = await fetch('/test/test-glossary.json');
        if (response.ok) {
          const testGlossary = (await response.json()) as Omit<GlossaryEntry, 'id'>[];
          for (const entry of testGlossary) {
            this.glossaryManager.upsertEntry({
              ...entry,
              id: crypto.randomUUID(),
            });
          }
          await this.glossaryManager.save();
        }
      } catch (_e) {
        console.warn('Test glossary file not found, skipping auto-import.');
      }
    }

    this.glossaryEntries = this.glossaryManager.getAllEntries();
    await this.autoLoadTestEpub();
  }

  private async autoLoadTestEpub() {
    try {
      const response = await fetch('/test/test.epub');
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], 'test.epub', { type: 'application/epub+zip' });
        await this.loadEpubFile(file);
      }
    } catch (_e) {}
  }

  // --- Handlers ---

  private async loadEpubFile(file: File) {
    this.isProcessing = true;
    this.addLog('info', `Importing EPUB: ${file.name}`);
    try {
      const result = await this.epubClient.load(file);
      const newChapters = result.chapters.map(ch => ({
        ...ch,
        id: `${file.name.replace(/\s+/g, '_')}-${ch.id}`,
        source: file.name,
      }));
      this.chapters = [...this.chapters, ...newChapters];
      this.metadata = result.metadata;
      if (this.selectedChapterIndex === -1 && this.chapters.length > 0) {
        this.selectedChapterIndex = 0;
      }
    } catch (error) {
      this.addLog('error', `Failed to load EPUB: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleSaveEpub() {
    if (this.chapters.length === 0) return;
    this.isProcessing = true;
    this.addLog('info', 'Generating refined EPUB...');
    let url = '';
    try {
      const blob = await this.epubClient.save(this.chapters);
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refined_${this.metadata?.title || 'book'}.epub`;
      a.click();
      this.addLog('success', 'EPUB saved successfully!');
    } catch (error) {
      this.addLog('error', `Save failed: ${error}`);
    } finally {
      if (url) URL.revokeObjectURL(url);
      this.isProcessing = false;
    }
  }

  private handleTrashChapter(index: number) {
    this.chapters = this.chapters.filter((_, i) => i !== index);
    if (this.selectedChapterIndex === index) {
      this.selectedChapterIndex = this.chapters.length > 0 ? 0 : -1;
    } else if (this.selectedChapterIndex > index) {
      this.selectedChapterIndex--;
    }
  }

  private async handleCleanup() {
    if (this.chapters.length === 0) return;
    this.isProcessing = true;
    this.isPaused = false;
    this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);

    try {
      this.currentStep = 0;
      const groups = new Map<string, Chapter[]>();
      for (const ch of this.chapters) {
        const source = ch.source || 'Unknown';
        if (!groups.has(source)) groups.set(source, []);
        groups.get(source)?.push(ch);
      }

      this.totalSteps = this.chapters.length;
      let processedCount = 0;
      const idsToRemove = new Set<string>();

      for (const [source, bookChapters] of groups.entries()) {
        if (this.isPaused) break;
        this.addLog('info', `Cleaning up EPUB: ${source}`);

        for (let i = 0; i < bookChapters.length; i++) {
          if (this.isPaused) break;
          const ch = bookChapters[i];
          this.statusMessage = `Analyzing (Start): ${ch.title}`;
          const isJunk = await this.checkIfJunk(ch);
          processedCount++;
          this.progress = (processedCount / this.totalSteps) * 100;
          if (isJunk) idsToRemove.add(ch.id);
          else break;
        }

        for (let i = bookChapters.length - 1; i >= 0; i--) {
          if (this.isPaused) break;
          const ch = bookChapters[i];
          if (idsToRemove.has(ch.id)) continue;
          this.statusMessage = `Analyzing (End): ${ch.title}`;
          const isJunk = await this.checkIfJunk(ch);
          processedCount++;
          this.progress = (processedCount / this.totalSteps) * 100;
          if (isJunk) idsToRemove.add(ch.id);
          else break;
        }
      }

      if (idsToRemove.size > 0) {
        this.chapters = this.chapters.filter(ch => !idsToRemove.has(ch.id));
        this.addLog('success', `Cleanup complete. Removed ${idsToRemove.size} junk chapters.`);
      }
      this.progress = 100;
    } catch (error) {
      this.addLog('error', `Cleanup failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.statusMessage = '';
      this.progress = 0;
    }
  }

  private async checkIfJunk(ch: Chapter): Promise<boolean> {
    this.currentStep++;
    const result = await this.aiBridge.isJunkChapter({
      id: ch.id,
      title: ch.title,
      snippet: this.textCleaner.clean(ch.content).substring(0, 500),
    });
    return result.remove;
  }

  private async handleRefineAll() {
    if (this.chapters.length === 0) return;
    this.isProcessing = true;
    this.isPaused = false;
    this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);

    try {
      const total = this.chapters.length;
      this.totalSteps = total;
      const glossaryContext = JSON.stringify(this.glossaryManager.getAllEntries());

      for (let i = this.currentStep; i < total; i++) {
        if (this.isPaused) return;
        this.currentStep = i;
        this.progress = (i / total) * 100;
        this.statusMessage = `Refining: ${this.chapters[i].title}`;

        let refined = await this.processRefinement(this.chapters[i].content, glossaryContext);
        refined = this.glossaryManager.applyGlossary(refined);
        this.chapters[i] = { ...this.chapters[i], content: refined };

        this.storyMemory = await this.aiBridge.updateMemory(refined, this.storyMemory);
        this.addLog('info', `Story Memory updated after chapter: ${this.chapters[i].title}`);
        await this.storyMemoryService.save(this.storyMemory);
        if (i % 2 === 0) this.chapters = [...this.chapters];
      }
      this.chapters = [...this.chapters];
      this.currentStep = 0;
    } catch (error) {
      this.addLog('error', `Refinement failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.statusMessage = '';
      this.progress = 0;
    }
  }

  private async processRefinement(rawContent: string, glossaryContext: string): Promise<string> {
    const config = this.configService.getConfig();
    const cleaned = this.textCleaner.clean(rawContent);
    const chunks = splitText(cleaned, config.ai.maxContext - 2000);
    let refinedContent = '';
    for (let j = 0; j < chunks.length; j++) {
      const chunkRefined = await this.aiBridge.refineChapter(
        chunks[j],
        glossaryContext,
        this.storyMemory,
      );
      refinedContent += `${chunkRefined}\n\n`;
    }
    return refinedContent.trim();
  }

  private async handleSaveGlossary() {
    if (!this.editingEntry?.term) return;
    this.editingEntry.searches = this.editingEntry.searches.filter(s => s.trim() !== '');
    this.glossaryManager.upsertEntry(this.editingEntry);
    await this.glossaryManager.save();
    this.glossaryEntries = this.glossaryManager.getAllEntries();
    this.isGlossaryDialogOpen = false;
  }

  render() {
    return html`
			<div class="app-grid">
				<chapter-column 
					.chapters=${this.chapters} 
					.selectedIndex=${this.selectedChapterIndex}
					@open-epub=${() => (this.shadowRoot?.getElementById('epub-upload') as HTMLInputElement | null)?.click()}
					@close-project=${() => {
            this.chapters = [];
            this.selectedChapterIndex = -1;
          }}
					@save-epub=${this.handleSaveEpub}
					@select-chapter=${(e: CustomEvent<number>) => (this.selectedChapterIndex = e.detail)}
					@trash-chapter=${(e: CustomEvent<number>) => this.handleTrashChapter(e.detail)}
				></chapter-column>

				<glossary-column
					.entries=${this.glossaryEntries}
					@add-entry=${() => {
            this.editingEntry = {
              id: crypto.randomUUID(),
              term: '',
              searches: [''],
              category: 'Other',
            };
            this.isGlossaryDialogOpen = true;
          }}
					@edit-entry=${(e: CustomEvent<GlossaryEntry>) => {
            this.editingEntry = { ...e.detail };
            this.isGlossaryDialogOpen = true;
          }}
					@delete-entry=${(e: CustomEvent<string>) => {
            this.glossaryManager.deleteEntry(e.detail);
            this.glossaryEntries = this.glossaryManager.getAllEntries();
          }}
					@import-glossary=${() => (this.shadowRoot?.getElementById('glossary-import') as HTMLInputElement | null)?.click()}
				></glossary-column>

				<reader-column
					.chapter=${this.chapters[this.selectedChapterIndex]}
					.diffMode=${this.diffMode}
					.logs=${this.logs}
					@toggle-diff=${() => (this.diffMode = !this.diffMode)}
				></reader-column>

				<service-column
					.isProcessing=${this.isProcessing}
					.isPaused=${this.isPaused}
					.progress=${this.progress}
					.currentStep=${this.currentStep}
					.totalSteps=${this.totalSteps}
					.statusMessage=${this.statusMessage}
					.hasChapters=${this.chapters.length > 0}
					@configure-ai=${() => (this.isConfigDialogOpen = true)}
					@story-memory=${() => (this.isMemoryDialogOpen = true)}
					@run-cleanup=${this.handleCleanup}
					@run-refinement=${this.handleRefineAll}
					@toggle-pause=${() => (this.isPaused = !this.isPaused)}
					@resume-next=${() => {
            this.isPaused = false;
            this.handleRefineAll();
          }}
					@retry-chapter=${this.handleRefineAll}
				></service-column>
			</div>

			<input type="file" id="epub-upload" accept=".epub" style="display: none" @change=${(
        e: Event,
      ) => {
        const input = e.target as HTMLInputElement;
        if (input.files?.[0]) this.loadEpubFile(input.files[0]);
      }}>
			<input type="file" id="glossary-import" accept=".json" style="display: none" @change=${async (
        e: Event,
      ) => {
        const input = e.target as HTMLInputElement;
        if (input.files?.[0]) {
          this.glossaryManager.importJson(await input.files[0].text());
          this.glossaryEntries = this.glossaryManager.getAllEntries();
        }
      }}>

			<!-- AI Config Dialog -->
			<wa-dialog label="AI Settings" ?open=${this.isConfigDialogOpen} @wa-after-hide=${() => (this.isConfigDialogOpen = false)}>
				${
          this.currentConfig
            ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<wa-input label="Endpoint URL" .value=${this.currentConfig.ai.endpoint} @wa-input=${(
              e: Event,
            ) => {
              if (this.currentConfig)
                this.currentConfig.ai.endpoint = (e.target as HTMLInputElement).value;
            }}></wa-input>
						<wa-input label="Model Name" .value=${this.currentConfig.ai.model} @wa-input=${(
              e: Event,
            ) => {
              if (this.currentConfig)
                this.currentConfig.ai.model = (e.target as HTMLInputElement).value;
            }}></wa-input>
						<wa-input label="Max Context (tokens)" type="number" .value=${this.currentConfig.ai.maxContext.toString()} @wa-input=${(
              e: Event,
            ) => {
              if (this.currentConfig)
                this.currentConfig.ai.maxContext = Number((e.target as HTMLInputElement).value);
            }}></wa-input>
					</div>
				`
            : ''
        }
				<wa-button slot="footer" variant="brand" @click=${() => {
          if (this.currentConfig) {
            this.configService.save(this.currentConfig);
            this.isConfigDialogOpen = false;
          }
        }}>Save Settings</wa-button>
			</wa-dialog>

			<!-- Story Memory Dialog -->
			<wa-dialog label="Story Memory" ?open=${this.isMemoryDialogOpen} style="--width: 80vw;" @wa-after-hide=${() => (this.isMemoryDialogOpen = false)}>
				<div style="display: flex; flex-direction: column; gap: var(--wa-space-m);">
					<p style="font-size: var(--wa-font-size-xs); color: var(--wa-color-text-quiet);">
						${this.isProcessing ? 'Memory is being updated by AI... (Pause to edit manually)' : 'Edit narrative context to guide the AI.'}
					</p>
					
					<wa-textarea 
						label="Current Narrative Context" 
						rows="15" 
						.value=${this.storyMemory} 
						?readonly=${this.isProcessing}
						@wa-input=${(e: Event) => (this.storyMemory = (e.target as HTMLTextAreaElement).value)} 
						help-text="Main characters, descriptions, items, and current plot summary.">
					</wa-textarea>
				</div>
				<wa-button slot="footer" variant="brand" @click=${() => {
          this.storyMemoryService.save(this.storyMemory);
          this.isMemoryDialogOpen = false;
        }} ?disabled=${this.isProcessing}>Update Memory</wa-button>
			</wa-dialog>

			<!-- Glossary Edit Dialog -->
			<wa-dialog label=${this.editingEntry?.term ? 'Edit Entry' : 'Add Entry'} ?open=${this.isGlossaryDialogOpen} @wa-after-hide=${() => (this.isGlossaryDialogOpen = false)}>
				${
          this.editingEntry
            ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<wa-input label="Replacement Term" .value=${this.editingEntry.term} @wa-input=${(
              e: Event,
            ) => {
              if (this.editingEntry) this.editingEntry.term = (e.target as HTMLInputElement).value;
            }}></wa-input>
						<wa-select label="Category" .value=${this.editingEntry.category} @wa-change=${(
              e: Event,
            ) => {
              if (this.editingEntry)
                this.editingEntry.category = (e.target as HTMLSelectElement)
                  .value as GlossaryEntry['category'];
            }}>
							<wa-option value="Name">Name</wa-option><wa-option value="Place">Place</wa-option><wa-option value="Term">Term</wa-option><wa-option value="Other">Other</wa-option>
						</wa-select>
					</div>
				`
            : ''
        }
				<wa-button slot="footer" variant="brand" @click=${this.handleSaveGlossary}>Save Entry</wa-button>
			</wa-dialog>
		`;
  }
}
