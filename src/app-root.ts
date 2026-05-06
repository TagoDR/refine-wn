import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { AiBridge } from './services/ai-bridge';
import { BatchRefinementService } from './services/batch-refinement-service';
import { type AppConfig, ConfigService } from './services/config-service';
import type { Chapter, EpubMetadata } from './services/epub-service';
import { EpubWorkerClient } from './services/epub-worker-client';
import { type GlossaryEntry, GlossaryManager } from './services/glossary-manager';
import { StoryMemoryService } from './services/story-memory';
import { TextCleaner } from './services/text-cleaner';
import { CharacterService } from './services/character-service';
import { KnowledgeBaseService } from './services/knowledge-base';
import { PortabilityService } from './services/portability-service';
import type { LogEntry, Character } from './types';

// Modular Column Components
import './components/chapter-column';
import './components/glossary-column';
import './components/character-column';
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
			font-family: var(--wa-font-family-body),sans-serif;
			overflow: hidden;
		}

		.app-grid {
			display: grid;
			grid-template-columns: 280px 320px 320px 1fr 280px;
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
  @state() private characters: Character[] = [];
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
  @state() private isCharacterDialogOpen = false;
  @state() private isKnowledgeBaseDialogOpen = false;

  @state() private editingEntry: GlossaryEntry | null = null;
  @state() private editingCharacter: Character | null = null;
  @state() private currentConfig: AppConfig | null = null;
  @state() private storyMemory = '';
  @state() private knowledgeBase = '';

  private epubClient = new EpubWorkerClient();
  private configService = new ConfigService();
  private aiBridge = new AiBridge(this.configService);
  private glossaryManager = new GlossaryManager();
  private storyMemoryService = new StoryMemoryService();
  private characterService = new CharacterService();
  private knowledgeBaseService = new KnowledgeBaseService();
  private portabilityService = new PortabilityService(
    this.glossaryManager,
    this.characterService,
    this.storyMemoryService,
    this.knowledgeBaseService,
  );
  private textCleaner = new TextCleaner();
  private batchRefinementService = new BatchRefinementService(
    this.aiBridge,
    this.storyMemoryService,
    this.glossaryManager,
    this.configService,
    this.characterService,
    this.knowledgeBaseService,
  );

  private addLog(type: LogEntry['type'], message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs = [...this.logs, { type, message, timestamp }];
  }

  async firstUpdated() {
    this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
    this.currentConfig = await this.configService.load();
    await this.glossaryManager.load();
    this.storyMemory = await this.storyMemoryService.load();
    this.characters = await this.characterService.load();
    this.knowledgeBase = await this.knowledgeBaseService.load();

    // Auto-load test settings for faster testing if empty (Dev only)
    if (import.meta.env.DEV && this.glossaryManager.getAllEntries().length === 0) {
      try {
        const response = await fetch('/test/test-settings.json');
        if (response.ok) {
          const testSettings = await response.json();
          await this.portabilityService.importProject(JSON.stringify(testSettings));
          this.syncLocalState();
          this.addLog('success', 'Auto-loaded test settings.');
        } else {
          // Fallback to old glossary logic if settings.json not found
          const oldGlossaryResp = await fetch('/test/test-glossary.json');
          if (oldGlossaryResp.ok) {
            const testGlossary = await oldGlossaryResp.json();
            for (const entry of testGlossary) {
              this.glossaryManager.upsertEntry({ ...entry, id: crypto.randomUUID() });
            }
            await this.glossaryManager.save();
            this.glossaryEntries = this.glossaryManager.getAllEntries();
          }
        }
      } catch (_e) {
        console.warn('Test settings file not found, skipping auto-import.');
      }
    }

    this.syncLocalState();

    if (import.meta.env.DEV) {
      await this.autoLoadTestEpub();
    }
  }

  private syncLocalState() {
    this.glossaryEntries = this.glossaryManager.getAllEntries();
    this.characters = this.characterService.getAll();
    this.storyMemory = this.storyMemoryService.getMemory();
    this.knowledgeBase = this.knowledgeBaseService.getKnowledgeBase();
    this.requestUpdate();
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

  private assetUrls: Map<string, string> = new Map();

  private handleCloseProject() {
    for (const url of this.assetUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.assetUrls.clear();

    this.chapters = [];
    this.selectedChapterIndex = -1;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.progress = 0;
    this.statusMessage = '';
    this.addLog('info', 'Project closed. All local resources cleared.');
  }

  private async loadEpubFile(file: File) {
    this.isProcessing = true;
    this.addLog('info', `Importing EPUB: ${file.name}`);

    try {
      if (this.chapters.length > 0) {
        this.handleCloseProject();
      }

      const result = await this.epubClient.load(file);

      for (const asset of result.assets) {
        const blob = new Blob([asset.content as BlobPart], { type: asset.mediaType });
        const url = URL.createObjectURL(blob);
        this.assetUrls.set(asset.href, url);
      }

      const newChapters = result.chapters.map(ch => {
        let content = ch.content;
        for (const [href, url] of this.assetUrls.entries()) {
          const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`src=["'](?:\\.\\./)*${escapedHref}["']`, 'g');
          content = content.replace(regex, `src="${url}"`);
        }

        return {
          ...ch,
          id: `${file.name.replace(/\s+/g, '_')}-${ch.id}`,
          source: file.name,
          content,
        };
      });

      if (this.chapters.length > 0) {
        this.addLog('info', 'Appending new chapters to current project.');
      }

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
      const chaptersToSave = this.chapters.map(ch => {
        let content = ch.content;
        for (const [href, blobUrl] of this.assetUrls.entries()) {
          const regex = new RegExp(blobUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          content = content.replace(regex, href);
        }
        return { ...ch, content };
      });

      const blob = await this.epubClient.save(chaptersToSave);
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

  private async handleTestConnection() {
    this.isProcessing = true;
    this.statusMessage = 'Testing Connection...';
    try {
      await this.aiBridge.testConnection();
    } finally {
      this.isProcessing = false;
      this.statusMessage = '';
    }
  }

  private async handleCleanup() {
    if (this.chapters.length === 0) return;
    this.isProcessing = true;
    this.isPaused = false;

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

    try {
      const total = this.chapters.length;
      this.totalSteps = total;

      for (let i = this.currentStep; i < total; i++) {
        if (this.isPaused) {
          this.isProcessing = false;
          return;
        }

        this.currentStep = i;
        this.progress = (i / total) * 100;
        this.statusMessage = `Refining: ${this.chapters[i].title}`;

        try {
          this.chapters[i] = { ...this.chapters[i], status: 'processing' };
          this.chapters = [...this.chapters];

          const refined = await this.batchRefinementService.refineChapter(
            this.chapters[i].content,
            (msg, type) => this.addLog(type, msg),
          );

          this.chapters[i] = {
            ...this.chapters[i],
            content: refined,
            status: 'completed',
          };

          this.syncLocalState();

          if (i % 2 === 0) this.chapters = [...this.chapters];
        } catch (error) {
          this.isPaused = true;
          this.addLog('error', `AI Error: ${error}. Process paused.`);
          return;
        }
      }
      this.chapters = [...this.chapters];
      this.currentStep = 0;
    } catch (error) {
      this.addLog('error', `Critical refinement failure: ${error}`);
    } finally {
      this.isProcessing = false;
      this.statusMessage = this.isPaused ? 'Paused' : '';
      if (!this.isPaused) this.progress = 0;
    }
  }

  private async handleSingleRefinement() {
    if (this.selectedChapterIndex === -1) return;
    this.isProcessing = true;
    this.statusMessage = `Refining: ${this.chapters[this.selectedChapterIndex].title}`;
    this.addLog('info', `Starting individual refinement: ${this.chapters[this.selectedChapterIndex].title}`);

    try {
      this.chapters[this.selectedChapterIndex] = {
        ...this.chapters[this.selectedChapterIndex],
        status: 'processing',
      };
      this.chapters = [...this.chapters];

      const refined = await this.batchRefinementService.refineChapter(
        this.chapters[this.selectedChapterIndex].content,
        (msg, type) => this.addLog(type, msg),
      );

      this.chapters[this.selectedChapterIndex] = {
        ...this.chapters[this.selectedChapterIndex],
        content: refined,
        status: 'completed',
      };
      this.chapters = [...this.chapters];

      this.syncLocalState();

      this.addLog('success', 'Individual refinement complete.');
    } catch (error) {
      this.addLog('error', `Individual refinement failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.statusMessage = '';
    }
  }

  private handleExportGlossary() {
    const json = this.portabilityService.exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refinewn_settings_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.addLog('info', 'Project settings exported.');
  }

  private async handleSaveGlossary() {
    if (!this.editingEntry?.term) {
      this.addLog('error', 'Term is required.');
      return;
    }

    const success = this.glossaryManager.upsertEntry(this.editingEntry);

    if (!success) {
      this.addLog(
        'error',
        'Invalid entry: At least one search pattern distinct from the term is required.',
      );
      return;
    }

    await this.glossaryManager.save();
    this.syncLocalState();

    this.isGlossaryDialogOpen = false;
    this.editingEntry = null;
    this.addLog('success', 'Glossary entry saved.');
  }

  private async handleSaveCharacter() {
    if (!this.editingCharacter?.name) {
      this.addLog('error', 'Character name is required.');
      return;
    }

    this.characterService.upsert(this.editingCharacter);
    await this.characterService.save();
    this.syncLocalState();

    this.isCharacterDialogOpen = false;
    this.editingCharacter = null;
    this.addLog('success', 'Character saved.');
  }

  private async handleDeleteCharacter(id: string) {
    if (confirm('Are you sure you want to delete this character?')) {
      this.characterService.delete(id);
      await this.characterService.save();
      this.syncLocalState();
      this.addLog('info', 'Character deleted.');
    }
  }

  render() {
    return html`
			<div class="app-grid">
				<chapter-column 
					.chapters=${this.chapters} 
					.selectedIndex=${this.selectedChapterIndex}
					@open-epub=${() => (this.shadowRoot?.getElementById('epub-upload') as HTMLInputElement | null)?.click()}
					@close-project=${this.handleCloseProject}
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
					@delete-entry=${async (e: CustomEvent<string>) => {
            this.glossaryManager.deleteEntry(e.detail);
            await this.glossaryManager.save();
            this.syncLocalState();
          }}
				></glossary-column>

				<character-column
					.characters=${this.characters}
					@add-character=${() => {
            this.editingCharacter = {
              id: crypto.randomUUID(),
              name: '',
              aliases: [],
              gender: '',
              category: 'Supporting',
              affiliation: '',
              relationships: '',
            };
            this.isCharacterDialogOpen = true;
          }}
					@edit-character=${(e: CustomEvent<Character>) => {
            this.editingCharacter = { ...e.detail };
            this.isCharacterDialogOpen = true;
          }}
					@delete-character=${(e: CustomEvent<string>) => this.handleDeleteCharacter(e.detail)}
				></character-column>

				<reader-column
					.chapter=${this.chapters[this.selectedChapterIndex]}
					.diffMode=${this.diffMode}
					.logs=${this.logs}
					@toggle-diff=${() => (this.diffMode = !this.diffMode)}
					@discard-refinement=${() => {
            if (this.selectedChapterIndex !== -1) {
              const ch = this.chapters[this.selectedChapterIndex];
              this.chapters[this.selectedChapterIndex] = {
                ...ch,
                content: ch.originalContent || ch.content,
              };
              this.chapters = [...this.chapters];
              this.addLog('info', `Discarded refinement for: ${ch.title}`);
            }
          }}
				></reader-column>

				<service-column
					.isProcessing=${this.isProcessing}
					.isPaused=${this.isPaused}
					.progress=${this.progress}
					.currentStep=${this.currentStep}
					.totalSteps=${this.totalSteps}
					.statusMessage=${this.statusMessage}
					.hasChapters=${this.chapters.length > 0}
					.hasSelectedChapter=${this.selectedChapterIndex !== -1}
					@configure-ai=${() => (this.isConfigDialogOpen = true)}
					@test-ai=${this.handleTestConnection}
					@story-memory=${() => (this.isMemoryDialogOpen = true)}
					@run-cleanup=${this.handleCleanup}
					@run-single-refinement=${this.handleSingleRefinement}
					@run-refinement=${this.handleRefineAll}
					@toggle-pause=${() => (this.isPaused = !this.isPaused)}
					@resume-next=${() => {
            this.isPaused = false;
            this.handleRefineAll();
          }}
					@retry-chapter=${this.handleRefineAll}
					@import-glossary=${() => (this.shadowRoot?.getElementById('glossary-import') as HTMLInputElement | null)?.click()}
					@export-glossary=${this.handleExportGlossary}
					@clear-glossary=${async () => {
            if (confirm('Are you sure you want to clear all settings? Use Export first if unsure.')) {
              await this.glossaryManager.clear();
              await this.characterService.clear();
              await this.storyMemoryService.clear();
              await this.knowledgeBaseService.clear();
              this.syncLocalState();
              this.addLog('info', 'All settings cleared.');
            }
          }}
				>
					<wa-card class="service-card" slot="extra">
						<div slot="header">Project Knowledge Base</div>
						<wa-button size="small" variant="brand" style="width:100%;" @click=${() =>
              (this.isKnowledgeBaseDialogOpen = true)}>
							<wa-icon name="book" slot="prefix"></wa-icon> Edit Knowledge Base
						</wa-button>
					</wa-card>
				</service-column>
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
          try {
            await this.portabilityService.importProject(await input.files[0].text());
            this.syncLocalState();
            this.addLog('success', 'Project settings imported.');
          } catch (err) {
            this.addLog('error', `Import failed: ${err}`);
          }
        }
      }}>

			<!-- AI Config Dialog -->
			<wa-dialog label="AI Settings" ?open=${this.isConfigDialogOpen} @wa-after-hide=${(
        e: Event,
      ) => {
        if (e.target === e.currentTarget) this.isConfigDialogOpen = false;
      }}>
				${
          this.currentConfig
            ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<wa-input label="Endpoint URL" .value=${this.currentConfig.ai.endpoint} @input=${(
              e: Event,
            ) => {
              if (this.currentConfig)
                this.currentConfig.ai.endpoint = (e.target as HTMLInputElement).value;
            }}></wa-input>
						<wa-input label="Model Name" .value=${this.currentConfig.ai.model} @input=${(
              e: Event,
            ) => {
              if (this.currentConfig)
                this.currentConfig.ai.model = (e.target as HTMLInputElement).value;
            }}></wa-input>
						<wa-input label="Max Context (tokens)" type="number" .value=${this.currentConfig.ai.maxContext.toString()} @input=${(
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
			<wa-dialog label="Story Memory" ?open=${this.isMemoryDialogOpen} style="--width: 80vw;" @wa-after-hide=${(
        e: Event,
      ) => {
        if (e.target === e.currentTarget) this.isMemoryDialogOpen = false;
      }}>
				<div style="display: flex; flex-direction: column; gap: var(--wa-space-m);">
					<wa-textarea 
						label="Current Narrative Context" 
						rows="15" 
						.value=${this.storyMemory} 
						?readonly=${this.isProcessing}
						@input=${(e: Event) => (this.storyMemory = (e.target as HTMLTextAreaElement).value)} 
						help-text="Main characters, descriptions, items, and current plot summary.">
					</wa-textarea>
				</div>
				<wa-button slot="footer" variant="brand" @click=${() => {
          this.storyMemoryService.save(this.storyMemory);
          this.isMemoryDialogOpen = false;
        }}>Update Memory</wa-button>
			</wa-dialog>

			<!-- Project Knowledge Base Dialog -->
			<wa-dialog label="Project Knowledge Base" ?open=${this.isKnowledgeBaseDialogOpen} style="--width: 80vw;" @wa-after-hide=${(
        e: Event,
      ) => {
        if (e.target === e.currentTarget) this.isKnowledgeBaseDialogOpen = false;
      }}>
				<div style="display: flex; flex-direction: column; gap: var(--wa-space-m);">
					<wa-textarea 
						label="World Lore & Style Guide" 
						rows="20" 
						.value=${this.knowledgeBase} 
						@input=${(e: Event) => (this.knowledgeBase = (e.target as HTMLTextAreaElement).value)} 
						help-text="Static information that guides the AI across the entire book.">
					</wa-textarea>
				</div>
				<wa-button slot="footer" variant="brand" @click=${() => {
          this.knowledgeBaseService.save(this.knowledgeBase);
          this.isKnowledgeBaseDialogOpen = false;
        }}>Save Knowledge Base</wa-button>
			</wa-dialog>

			<!-- Glossary Edit Dialog -->
			<wa-dialog label=${this.editingEntry?.term ? 'Edit Entry' : 'Add Entry'} ?open=${this.isGlossaryDialogOpen} @wa-after-hide=${(
        e: Event,
      ) => {
        if (e.target === e.currentTarget) this.isGlossaryDialogOpen = false;
      }}>
				${
          this.editingEntry
            ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<wa-input label="Replacement Term" .value=${this.editingEntry.term} @input=${(
              e: Event,
            ) => {
              if (this.editingEntry) {
                this.editingEntry.term = (e.target as HTMLInputElement).value;
                this.requestUpdate();
              }
            }}></wa-input>
						
						<div style="display: flex; flex-direction: column; gap: var(--wa-space-xs);">
							<label style="font-size: var(--wa-font-size-s); font-weight: bold;">Search Patterns (MTL variations)</label>
							${this.editingEntry.searches.map(
                (search, idx) => html`
								<div style="display: flex; gap: var(--wa-space-xs); align-items: center;">
									<wa-input 
										style="flex: 1;" 
										.value=${search} 
										placeholder="e.g. MTL name variant"
										@input=${(e: Event) => {
                      if (this.editingEntry) {
                        this.editingEntry.searches[idx] = (e.target as HTMLInputElement).value;
                        this.requestUpdate();
                      }
                    }}
									></wa-input>
									<wa-button 
										size="small"
										variant="neutral"
										ghost
										@click=${() => {
                      if (this.editingEntry) {
                        this.editingEntry.searches = this.editingEntry.searches.filter(
                          (_, i) => i !== idx,
                        );
                        this.requestUpdate();
                      }
                    }}
									>
										<wa-icon src="/icons/x.svg"></wa-icon>
									</wa-button>
								</div>
							`,
              )}
							<wa-button size="small" @click=${() => {
                if (this.editingEntry) {
                  this.editingEntry.searches = [...this.editingEntry.searches, ''];
                  this.requestUpdate();
                }
              }}>
								<wa-icon src="/icons/square-plus.svg"></wa-icon> Add Pattern
							</wa-button>
						</div>

						<wa-select label="Category" .value=${this.editingEntry.category} @change=${(
              e: Event,
            ) => {
              if (this.editingEntry) {
                this.editingEntry.category = (e.target as any).value;
                this.requestUpdate();
              }
            }}>
							<wa-option value="Name">Name</wa-option><wa-option value="Place">Place</wa-option><wa-option value="Term">Term</wa-option><wa-option value="Other">Other</wa-option>
						</wa-select>
					</div>
				`
            : ''
        }
				<wa-button slot="footer" variant="brand" @click=${() => this.handleSaveGlossary()}>Save Entry</wa-button>
			</wa-dialog>

			<!-- Character Edit Dialog -->
			<wa-dialog label=${this.editingCharacter?.name ? 'Edit Character' : 'Add Character'} ?open=${this.isCharacterDialogOpen} style="--width: 600px;" @wa-after-hide=${(
        e: Event,
      ) => {
        if (e.target === e.currentTarget) this.isCharacterDialogOpen = false;
      }}>
				${
          this.editingCharacter
            ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--wa-space-m);">
							<wa-input label="Name" .value=${this.editingCharacter.name} @input=${(
                e: Event,
              ) => {
                if (this.editingCharacter)
                  this.editingCharacter.name = (e.target as HTMLInputElement).value;
              }}></wa-input>
							<wa-select label="Category" .value=${this.editingCharacter.category} @change=${(
                e: Event,
              ) => {
                if (this.editingCharacter)
                  this.editingCharacter.category = (e.target as any).value;
              }}>
								<wa-option value="Main">Main</wa-option>
								<wa-option value="Supporting">Supporting</wa-option>
								<wa-option value="Extra">Extra</wa-option>
								<wa-option value="Background">Background</wa-option>
							</wa-select>
						</div>

						<wa-input label="Aliases (comma separated)" .value=${this.editingCharacter.aliases.join(', ')} @input=${(
                e: Event,
              ) => {
                if (this.editingCharacter)
                  this.editingCharacter.aliases = (e.target as HTMLInputElement).value
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => !!s);
              }}></wa-input>

						<div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--wa-space-m);">
							<wa-input label="Gender" .value=${this.editingCharacter.gender} @input=${(
                e: Event,
              ) => {
                if (this.editingCharacter)
                  this.editingCharacter.gender = (e.target as HTMLInputElement).value;
              }}></wa-input>
							<wa-input label="Affiliation" .value=${this.editingCharacter.affiliation} @input=${(
                e: Event,
              ) => {
                if (this.editingCharacter)
                  this.editingCharacter.affiliation = (e.target as HTMLInputElement).value;
              }}></wa-input>
						</div>

						<wa-textarea label="Relationships" .value=${this.editingCharacter.relationships} @input=${(
                e: Event,
              ) => {
                if (this.editingCharacter)
                  this.editingCharacter.relationships = (e.target as HTMLTextAreaElement).value;
              }}></wa-textarea>

						${
              this.editingCharacter.category === 'Main'
                ? html`
							<wa-textarea label="Items" .value=${this.editingCharacter.items || ''} @input=${(
                    e: Event,
                  ) => {
                    if (this.editingCharacter)
                      this.editingCharacter.items = (e.target as HTMLTextAreaElement).value;
                  }}></wa-textarea>
							<wa-textarea label="Techniques" .value=${this.editingCharacter.techniques || ''} @input=${(
                    e: Event,
                  ) => {
                    if (this.editingCharacter)
                      this.editingCharacter.techniques = (e.target as HTMLTextAreaElement).value;
                  }}></wa-textarea>
						`
                : ''
            }
					</div>
				`
            : ''
        }
				<wa-button slot="footer" variant="brand" @click=${() => this.handleSaveCharacter()}>Save Character</wa-button>
			</wa-dialog>
		`;
  }
}
