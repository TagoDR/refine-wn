import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { AiBridge } from './services/ai-bridge';
import { ConfigService, type AppConfig } from './services/config-service';
import type { Chapter, EpubMetadata } from './services/epub-service';
import { EpubWorkerClient } from './services/epub-worker-client';
import { type GlossaryEntry, GlossaryManager } from './services/glossary-manager';
import { StoryMemoryService } from './services/story-memory';
import { TextCleaner } from './services/text-cleaner';
import { splitText } from './services/text-splitter';

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

		.column {
			display: flex;
			flex-direction: column;
			height: 100vh;
			border-right: 1px solid var(--wa-color-surface-border);
			background: var(--wa-color-surface-raised);
			min-width: 0;
			overflow: hidden;
		}

		.column:last-child {
			border-right: none;
		}

		.sticky-header {
			padding: var(--wa-space-s);
			background: var(--wa-color-surface-lowered);
			border-bottom: 1px solid var(--wa-color-surface-border);
			display: flex;
			flex-direction: column;
			gap: var(--wa-space-xs);
			z-index: 10;
			flex-shrink: 0;
		}

		.header-title {
			font-weight: var(--wa-font-bold);
			font-size: var(--wa-font-size-s);
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.header-actions {
			display: flex;
			gap: var(--wa-space-3xs);
		}

		.scroll-content {
			flex: 1;
			overflow-y: auto;
			padding: var(--wa-space-xs);
			min-height: 0;
			display: flex;
			flex-direction: column;
		}

		/* Column 1: Chapters */
		.chapter-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--wa-space-2xs) var(--wa-space-xs);
			cursor: pointer;
			border-radius: var(--wa-border-radius-s);
			font-size: var(--wa-font-size-s);
			margin-bottom: 2px;
		}

		.chapter-item:hover {
			background: var(--wa-color-surface-lowered);
		}

		.chapter-item.selected {
			background: var(--wa-color-brand-60);
			color: white;
		}

		.trash-btn {
			opacity: 0.6;
			transition: opacity 0.2s;
		}

		.trash-btn:hover {
			opacity: 1;
		}

		/* Column 2: Glossary */
		.glossary-item {
			padding: var(--wa-space-xs);
			border-bottom: 1px solid var(--wa-color-surface-border);
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.glossary-term {
			font-weight: bold;
			color: var(--wa-color-brand-60);
		}

		.glossary-searches {
			font-size: var(--wa-font-size-2xs);
			color: var(--wa-color-text-quiet);
			font-style: italic;
		}

		/* Column 3: Reader & Console */
		.reader-col {
			background: var(--wa-color-surface-default);
			display: flex;
			flex-direction: column;
			height: 100vh;
			min-height: 0;
			overflow: hidden;
		}

		.reader-area {
			flex: 1;
			overflow-y: auto;
			padding: var(--wa-space-l);
			min-height: 0;
		}

		.console-area {
			height: 200px;
			background: #1e1e1e;
			color: #d4d4d4;
			font-family: var(--wa-font-family-code);
			font-size: var(--wa-font-size-2xs);
			border-top: 4px solid var(--wa-color-surface-border);
			display: flex;
			flex-direction: column;
			flex-shrink: 0;
		}

		.console-header {
			padding: 4px 12px;
			background: #333;
			font-weight: bold;
			border-bottom: 1px solid #444;
			flex-shrink: 0;
		}

		.console-logs {
			flex: 1;
			overflow-y: auto;
			padding: 8px;
			min-height: 0;
		}

		/* Column 4: Services */
		.service-card {
			margin-bottom: var(--wa-space-s);
		}

		.sticky-footer {
			margin-top: auto;
			padding: var(--wa-space-m);
			background: var(--wa-color-surface-lowered);
			border-top: 1px solid var(--wa-color-surface-border);
			flex-shrink: 0;
		}

		.progress-text {
			display: flex;
			justify-content: space-between;
			font-size: var(--wa-font-size-xs);
			margin-bottom: 4px;
		}

		.chapter-content {
			line-height: 1.8;
			font-size: 1.1rem;
			max-width: 800px;
			margin: 0 auto;
		}

		.log-entry { margin-bottom: 2px; }
		.log-error { color: #f44747; }
		.log-info { color: #4fc1ff; }
		.log-success { color: #b5cea8; }

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
  @state() private autoProcess = false;
  @state() private logs: {
    type: 'info' | 'error' | 'success';
    message: string;
    timestamp: string;
  }[] = [];

  // Dialog state
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

  private addLog(type: 'info' | 'error' | 'success', message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logs = [...this.logs, { type, message, timestamp }];
    setTimeout(() => {
      const logDiv = this.shadowRoot?.querySelector('.console-logs');
      if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;
    }, 50);
  }

  async firstUpdated() {
    this.currentConfig = await this.configService.load();
    await this.glossaryManager.load();
    this.storyMemory = await this.storyMemoryService.load();
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

  private async handleTestAi() {
    this.isProcessing = true;
    this.addLog('info', 'Testing AI Connection...');
    try {
      const success = await this.aiBridge.testConnection();
      if (success) {
        this.addLog('success', 'AI Connection Successful!');
      } else {
        this.addLog('error', 'AI Connection Failed. Check settings and local server.');
      }
    } catch (error) {
      this.addLog('error', `AI Connection Error: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleSaveConfig() {
    if (this.currentConfig) {
      await this.configService.save(this.currentConfig);
      this.addLog('success', 'AI Settings saved.');
      this.isConfigDialogOpen = false;
    }
  }

  private async handleSaveMemory() {
    await this.storyMemoryService.save(this.storyMemory);
    this.addLog('success', 'Story Memory updated.');
    this.isMemoryDialogOpen = false;
  }

  private async handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.loadEpubFile(file);
    input.value = '';
  }

  private async loadEpubFile(file: File) {
    this.isProcessing = true;
    this.addLog('info', `Importing EPUB: ${file.name}`);
    try {
      const result = await this.epubClient.load(file);
      // Additive import: append chapters with unique IDs
      const newChapters = result.chapters.map(ch => ({
        ...ch,
        id: `${file.name.replace(/\s+/g, '_')}-${ch.id}`
      }));
      this.chapters = [...this.chapters, ...newChapters];
      this.metadata = result.metadata;
      this.addLog('success', `Added ${newChapters.length} chapters. Total: ${this.chapters.length}`);
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

  private handleCloseProject() {
    this.chapters = [];
    this.metadata = null;
    this.selectedChapterIndex = -1;
    this.addLog('info', 'Project closed.');
  }

  private handleTrashChapter(index: number, e: Event) {
    e.stopPropagation();
    const chapter = this.chapters[index];
    this.chapters = this.chapters.filter((_, i) => i !== index);
    if (this.selectedChapterIndex === index) {
      this.selectedChapterIndex = this.chapters.length > 0 ? 0 : -1;
    } else if (this.selectedChapterIndex > index) {
      this.selectedChapterIndex--;
    }
    this.addLog('info', `Removed chapter: ${chapter.title}`);
  }

  private openGlossaryDialog(entry?: GlossaryEntry) {
    this.editingEntry = entry ? { ...entry } : {
      id: crypto.randomUUID(),
      term: '',
      searches: [''],
      category: 'Other'
    };
    this.isGlossaryDialogOpen = true;
  }

  private async handleSaveGlossary() {
    if (!this.editingEntry || !this.editingEntry.term) return;
    this.editingEntry.searches = this.editingEntry.searches.filter(s => s.trim() !== '');
    this.glossaryManager.upsertEntry(this.editingEntry);
    await this.glossaryManager.save();
    this.glossaryEntries = this.glossaryManager.getAllEntries();
    this.isGlossaryDialogOpen = false;
    this.addLog('success', `Glossary entry saved: ${this.editingEntry.term}`);
  }

  private handleExportGlossary() {
    const text = this.glossaryManager.exportJson();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'glossary.json';
    a.click();
    URL.revokeObjectURL(url);
    this.addLog('success', 'Glossary exported to .json');
  }

  private async handleImportGlossary(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      this.glossaryManager.importJson(text);
      await this.glossaryManager.save();
      this.glossaryEntries = this.glossaryManager.getAllEntries();
      this.addLog('success', 'Glossary appended from .json');
    } catch (error) {
      this.addLog('error', 'Import failed: Invalid dictionary format.');
    }
    (e.target as HTMLInputElement).value = '';
  }

  private async handleCleanup() {
    if (this.chapters.length === 0) return;
    this.isProcessing = true;
    this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
    try {
      this.statusMessage = 'Identifying junk chapters...';
      const chapterData = this.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        snippet: this.textCleaner.clean(ch.content).substring(0, 500),
      }));
      const idsToRemove = await this.aiBridge.identifyJunkChapters(chapterData);
      if (idsToRemove.length > 0) {
        this.chapters = this.chapters.filter(ch => !idsToRemove.includes(ch.id));
        this.addLog('success', `Removed ${idsToRemove.length} junk chapters.`);
      } else {
        this.addLog('info', 'No junk chapters found.');
      }
    } catch (error) {
      this.addLog('error', `Cleanup failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.statusMessage = '';
    }
  }

  private async handleExtractNames() {
    if (this.chapters.length === 0) return;
    this.isProcessing = true;
    this.isPaused = false;
    this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
    try {
      const total = this.chapters.length;
      this.statusMessage = 'Extracting glossary entities...';
      for (let i = 0; i < total; i++) {
        if (this.isPaused) {
          this.addLog('info', 'Extraction paused.');
          break;
        }
        this.currentStep = i + 1;
        this.totalSteps = total;
        this.progress = (i / total) * 100;
        const cleaned = this.textCleaner.clean(this.chapters[i].content);
        // Process in chunks if needed, but for extraction we usually just need the start
        const json = await this.aiBridge.extractNames(cleaned.substring(0, 8000));
        try {
          const newEntries = JSON.parse(json);
          for (const entry of newEntries) {
            this.glossaryManager.upsertEntry({ 
              id: crypto.randomUUID(), 
              term: entry.term, 
              searches: entry.searches || [],
              category: entry.category || 'Other'
            });
          }
          this.glossaryEntries = this.glossaryManager.getAllEntries();
        } catch (e) {
          this.addLog('error', `Failed to parse AI output for ${this.chapters[i].title}`);
        }
      }
      await this.glossaryManager.save();
      this.addLog('success', 'Glossary extraction complete.');
    } catch (error) {
      this.addLog('error', `Extraction error: ${error}`);
    } finally {
      this.isProcessing = false;
      this.progress = 0;
    }
  }

  private async handleRefineIndividual(index: number) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
    try {
      this.statusMessage = `Refining: ${this.chapters[index].title}`;
      const glossaryContext = JSON.stringify(this.glossaryManager.getAllEntries());
      let refined = await this.processRefinement(this.chapters[index].content, glossaryContext);
      
      // Strict Glossary Post-Process
      this.statusMessage = 'Applying strict glossary...';
      refined = this.glossaryManager.applyGlossary(refined);

      this.chapters[index] = { ...this.chapters[index], content: refined };
      this.chapters = [...this.chapters];
      this.addLog('success', `Chapter refined: ${this.chapters[index].title}`);
    } catch (error) {
      this.addLog('error', `Refinement failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.statusMessage = '';
    }
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
      
      for (let i = 0; i < total; i++) {
        if (this.isPaused) {
          this.addLog('info', 'Refinement paused.');
          break;
        }
        this.currentStep = i + 1;
        this.progress = (i / total) * 100;
        this.statusMessage = `Refining: ${this.chapters[i].title}`;
        
        let refined = await this.processRefinement(this.chapters[i].content, glossaryContext);

        // Strict Glossary Post-Process
        refined = this.glossaryManager.applyGlossary(refined);

        this.chapters[i] = { ...this.chapters[i], content: refined };
        
        // Update memory after each chapter
        this.statusMessage = `Updating memory: ${this.chapters[i].title}`;
        this.storyMemory = await this.aiBridge.updateMemory(refined, this.storyMemory);
        await this.storyMemoryService.save(this.storyMemory);

        if (i % 2 === 0) this.chapters = [...this.chapters];
      }
      this.chapters = [...this.chapters];
      this.addLog('success', 'Full book refinement complete.');
    } catch (error) {
      this.addLog('error', `Refinement failed: ${error}`);
    } finally {
      this.isProcessing = false;
      this.progress = 0;
    }
  }

  private async processRefinement(rawContent: string, glossaryContext: string): Promise<string> {
    const config = this.configService.getConfig();
    const cleaned = this.textCleaner.clean(rawContent);
    const chunks = splitText(cleaned, config.ai.maxContext - 2000); // Leave room for prompts
    
    let refinedContent = '';
    for (let j = 0; j < chunks.length; j++) {
      this.addLog('info', `Processing chunk ${j + 1}/${chunks.length}...`);
      const chunkRefined = await this.aiBridge.refineChapter(chunks[j], glossaryContext, this.storyMemory);
      refinedContent += chunkRefined + '\n\n';
    }
    return refinedContent.trim();
  }

  private async handleClearGlossary() {
    if (confirm('Are you sure you want to clear the entire glossary?')) {
      this.glossaryEntries = [];
      // Manually clear the map in glossaryManager
      const entries = this.glossaryManager.getAllEntries();
      for (const entry of entries) {
        this.glossaryManager.deleteEntry(entry.id);
      }
      await this.glossaryManager.save();
      this.addLog('info', 'Glossary cleared.');
    }
  }

  private async handleDeleteGlossary(id: string, e: Event) {
    e.stopPropagation();
    this.glossaryManager.deleteEntry(id);
    await this.glossaryManager.save();
    this.glossaryEntries = this.glossaryManager.getAllEntries();
    this.addLog('info', 'Glossary entry removed.');
  }

  render() {
    const currentChapter = this.chapters[this.selectedChapterIndex];

    return html`
			<div class="app-grid">
				<!-- Column 1: File Management -->
				<div class="column">
					<div class="sticky-header">
						<div class="header-title">
							<span>CHAPTERS</span>
							<wa-tag size="small" variant="neutral">${this.chapters.length}</wa-tag>
						</div>
						<div class="header-actions">
							<wa-button size="small" variant="brand" @click=${() => this.shadowRoot?.getElementById('epub-upload')?.click()}>
								<wa-icon src="/src/icons/file-upload.svg"></wa-icon> Open
							</wa-button>
							<wa-button size="small" @click=${this.handleCloseProject} ?disabled=${this.chapters.length === 0}>
								<wa-icon src="/src/icons/x.svg"></wa-icon> Close
							</wa-button>
							<wa-button size="small" variant="success" @click=${this.handleSaveEpub} ?disabled=${this.chapters.length === 0}>
								<wa-icon src="/src/icons/device-floppy.svg"></wa-icon> Save
							</wa-button>
							<input type="file" id="epub-upload" accept=".epub" style="display: none" @change=${this.handleFileUpload}>
						</div>
					</div>
					<div class="scroll-content">
						${this.chapters.map((ch, i) => html`
							<div class="chapter-item ${this.selectedChapterIndex === i ? 'selected' : ''}" @click=${() => (this.selectedChapterIndex = i)}>
								<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
									${ch.title || `Chapter ${i + 1}`}
								</span>
								<div style="display:flex; gap:2px;">
									<wa-button size="extra-small" variant="neutral" ghost @click=${(e: Event) => { e.stopPropagation(); this.handleRefineIndividual(i); }} title="Refine Chapter">
										<wa-icon src="/src/icons/list-search.svg"></wa-icon>
									</wa-button>
									<wa-button class="trash-btn" size="extra-small" variant="danger" ghost @click=${(e: Event) => this.handleTrashChapter(i, e)}>
										<wa-icon src="/src/icons/trash.svg"></wa-icon>
									</wa-button>
								</div>
							</div>
						`)}
						${this.chapters.length === 0 ? html`<div style="text-align:center; padding-top:2rem; color:var(--wa-color-text-quiet);">No book loaded</div>` : ''}
					</div>
				</div>

				<!-- Column 2: Glossary -->
				<div class="column">
					<div class="sticky-header">
						<div class="header-title">
							<span>GLOSSARY</span>
							<wa-tag size="small" variant="neutral">${this.glossaryEntries.length}</wa-tag>
						</div>
						<div class="header-actions">
							<wa-button size="small" @click=${() => this.shadowRoot?.getElementById('glossary-import')?.click()}>
								<wa-icon src="/src/icons/file-import.svg"></wa-icon> Import
							</wa-button>
							<wa-button size="small" @click=${this.handleExportGlossary} ?disabled=${this.glossaryEntries.length === 0}>
								<wa-icon src="/src/icons/file-export.svg"></wa-icon> Export
							</wa-button>
							<wa-button size="small" variant="danger" ghost @click=${this.handleClearGlossary} ?disabled=${this.glossaryEntries.length === 0}>
								<wa-icon src="/src/icons/trash.svg"></wa-icon>
							</wa-button>
							<wa-button size="small" variant="brand" appearance="accent" @click=${() => this.openGlossaryDialog()}>
								<wa-icon src="/src/icons/square-plus.svg"></wa-icon>
							</wa-button>
							<input type="file" id="glossary-import" accept=".json" style="display: none" @change=${this.handleImportGlossary}>
						</div>
					</div>
					<div class="scroll-content">
						${this.glossaryEntries.map(entry => html`
							<div class="glossary-item" @click=${() => this.openGlossaryDialog(entry)} style="cursor: pointer;">
								<div style="display:flex; justify-content:space-between; align-items:flex-start;">
									<div class="glossary-term">${entry.term}</div>
									<div style="display:flex; gap:4px;">
										<wa-icon src="/src/icons/edit.svg" style="font-size: var(--wa-font-size-xs); color: var(--wa-color-text-quiet);"></wa-icon>
										<wa-button size="extra-small" variant="danger" ghost @click=${(e: Event) => this.handleDeleteGlossary(entry.id, e)}>
											<wa-icon src="/src/icons/trash.svg" style="font-size: var(--wa-font-size-xs);"></wa-icon>
										</wa-button>
									</div>
								</div>
								<div class="glossary-searches">${entry.searches.join(', ')}</div>
								<wa-tag size="extra-small" variant="neutral">${entry.category}</wa-tag>
							</div>
						`)}
					</div>
				</div>

				<!-- Column 3: Reader & Console -->
				<div class="column reader-col">
					<div class="reader-area" style="${this.diffMode ? 'overflow:hidden; display:flex; flex-direction:column;' : ''}">
						${currentChapter ? html`
							<div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-shrink:0;">
								<h1 style="margin:0;">${currentChapter.title}</h1>
								<wa-button size="small" @click=${() => (this.diffMode = !this.diffMode)}>
									<wa-icon src="/src/icons/list-search.svg" slot="prefix"></wa-icon>
									${this.diffMode ? 'Refined View' : 'Diff View'}
								</wa-button>
							</div>
							
							${this.diffMode ? html`
								<wa-split-panel position="50" style="flex:1; min-height:0;">
									<div slot="start" style="padding: var(--wa-space-m); height:100%; overflow:auto;">
										<div style="font-weight:bold; color:var(--wa-color-text-quiet); margin-bottom:1rem;">RAW MTL</div>
										<div class="chapter-content" style="color: var(--wa-color-text-quiet); font-size: 0.9rem;">${unsafeHTML(currentChapter.originalContent || '')}</div>
									</div>
									<div slot="end" style="padding: var(--wa-space-m); height:100%; overflow:auto;">
										<div style="font-weight:bold; color:var(--wa-color-brand-60); margin-bottom:1rem;">REFINED</div>
										<div class="chapter-content">${unsafeHTML(currentChapter.content)}</div>
									</div>
								</wa-split-panel>
							` : html`
								<div class="chapter-content">${unsafeHTML(currentChapter.content)}</div>
							`}
						` : html`
							<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--wa-color-text-quiet);">
								<wa-icon src="/src/icons/list-search.svg" style="font-size: 5rem; margin-bottom: 1rem; opacity: 0.2;"></wa-icon>
								<p>Select a chapter to start reading</p>
							</div>
						`}
					</div>
					
					<div class="console-area">
						<div class="console-header">PROCESS CONSOLE</div>
						<div class="console-logs">
							${this.logs.map(log => html`
								<div class="log-entry log-${log.type}">
									[${log.timestamp}] ${log.message}
								</div>
							`)}
							${this.logs.length === 0 ? html`<div>Waiting for activity...</div>` : ''}
						</div>
					</div>
				</div>

				<!-- Column 4: Services -->
				<div class="column">
					<div class="sticky-header">
						<div class="header-title">SERVICES</div>
					</div>
					<div class="scroll-content">
						<wa-card class="service-card">
							<div slot="header">Local AI Settings</div>
							<wa-button size="small" @click=${() => this.isConfigDialogOpen = true} style="width:100%;">
								<wa-icon name="gear" slot="prefix"></wa-icon> Configure AI
							</wa-button>
							<wa-button size="small" variant="neutral" ghost @click=${this.handleTestAi} style="width:100%; margin-top:4px;">
								<wa-icon name="plug-circle-bolt" slot="prefix"></wa-icon> Test Connection
							</wa-button>
						</wa-card>

						<wa-card class="service-card">
							<div slot="header">Narrative Context</div>
							<wa-button size="small" @click=${() => this.isMemoryDialogOpen = true} style="width:100%;">
								<wa-icon name="brain" slot="prefix"></wa-icon> Story Memory
							</wa-button>
						</wa-card>

						<wa-card class="service-card">
							<div slot="header">1. Content Cleanup</div>
							<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Remove non-story pages (Covers, TOC, Copyright).</p>
							<wa-button size="small" variant="brand" style="width:100%;" @click=${this.handleCleanup} ?disabled=${this.isProcessing || this.chapters.length === 0}>
								<wa-icon name="broom" slot="prefix"></wa-icon> Run Cleanup
							</wa-button>
						</wa-card>

						<wa-card class="service-card">
							<div slot="header">2. Glossary Extraction</div>
							<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Automatically extract names and terms from ALL chapters.</p>
							<wa-button size="small" variant="brand" style="width:100%;" @click=${this.handleExtractNames} ?disabled=${this.isProcessing || this.chapters.length === 0}>
								<wa-icon name="wand-magic-sparkles" slot="prefix"></wa-icon> Extract Terms
							</wa-button>
						</wa-card>

						<wa-card class="service-card">
							<div slot="header">3. Full Refinement</div>
							<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Polish all chapters using glossary and memory.</p>
							<wa-button size="small" variant="success" style="width:100%;" @click=${this.handleRefineAll} ?disabled=${this.isProcessing || this.chapters.length === 0}>
								<wa-icon name="sparkles" slot="prefix"></wa-icon> Refine All
							</wa-button>
						</wa-card>
					</div>

					<div class="sticky-footer">
						<div class="progress-text">
							<span>${this.statusMessage || 'System Idle'}</span>
							<span>
								${this.totalSteps > 0 
									? html`Analysed: ${this.currentStep} | Remaining: ${this.totalSteps - this.currentStep}` 
									: ''}
							</span>
						</div>
						<wa-progress-bar value=${this.progress} ?indeterminate=${this.isProcessing && this.progress === 0}></wa-progress-bar>
						
						${this.isProcessing ? html`
							<div style="display:flex; gap:4px; margin-top:8px;">
								<wa-button size="small" variant="warning" style="flex:1;" @click=${() => this.isPaused = !this.isPaused}>
									<wa-icon name=${this.isPaused ? 'play' : 'pause'} slot="prefix"></wa-icon>
									${this.isPaused ? 'Resume' : 'Stop'}
								</wa-button>
							</div>
						` : ''}
					</div>
				</div>
			</div>

			<!-- AI Config Dialog -->
			<wa-dialog label="AI Settings" ?open=${this.isConfigDialogOpen} @wa-after-hide=${() => (this.isConfigDialogOpen = false)}>
				${this.currentConfig ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<wa-input label="Endpoint URL" value=${this.currentConfig.ai.endpoint} @wa-input=${(e: any) => this.currentConfig!.ai.endpoint = e.target.value}></wa-input>
						<wa-input label="Model Name" value=${this.currentConfig.ai.model} @wa-input=${(e: any) => this.currentConfig!.ai.model = e.target.value}></wa-input>
						<wa-input label="Max Context (tokens)" type="number" value=${this.currentConfig.ai.maxContext} @wa-input=${(e: any) => this.currentConfig!.ai.maxContext = Number(e.target.value)}></wa-input>
						<wa-input label="Temperature" type="number" step="0.1" value=${this.currentConfig.ai.temperature} @wa-input=${(e: any) => this.currentConfig!.ai.temperature = Number(e.target.value)}></wa-input>
					</div>
				` : ''}
				<wa-button slot="footer" variant="brand" @click=${this.handleSaveConfig}>Save Settings</wa-button>
			</wa-dialog>

			<!-- Story Memory Dialog -->
			<wa-dialog label="Story Memory" ?open=${this.isMemoryDialogOpen} style="--width: 80vw;" @wa-after-hide=${() => (this.isMemoryDialogOpen = false)}>
				<wa-textarea label="Current Narrative Context" rows="15" value=${this.storyMemory} @wa-input=${(e: any) => this.storyMemory = e.target.value} help-text="Main characters, descriptions, items, and current plot summary."></wa-textarea>
				<wa-button slot="footer" variant="brand" @click=${this.handleSaveMemory}>Update Memory</wa-button>
			</wa-dialog>

			<!-- Glossary Edit Dialog -->
			<wa-dialog label=${this.editingEntry?.term ? 'Edit Entry' : 'Add Entry'} ?open=${this.isGlossaryDialogOpen} @wa-after-hide=${() => (this.isGlossaryDialogOpen = false)}>
				${this.editingEntry ? html`
					<div style="display:flex; flex-direction:column; gap: var(--wa-space-m);">
						<wa-input label="Replacement Term" value=${this.editingEntry.term} @wa-input=${(e: any) => this.editingEntry!.term = e.target.value}></wa-input>
						
						<div>
							<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
								<label style="font-size:var(--wa-font-size-s); font-weight:bold;">Search Patterns (Regex supported)</label>
								<wa-button size="extra-small" @click=${() => {
                  this.editingEntry!.searches = [...this.editingEntry!.searches, ''];
                  this.requestUpdate();
                }}>+ Add</wa-button>
							</div>
							${this.editingEntry.searches.map((s, i) => html`
								<div style="display:flex; gap:4px; margin-bottom:4px;">
									<wa-input style="flex:1;" value=${s} @wa-input=${(e: any) => this.editingEntry!.searches[i] = e.target.value}></wa-input>
									<wa-button size="small" variant="danger" ghost @click=${() => {
                    this.editingEntry!.searches = this.editingEntry!.searches.filter((_, idx) => idx !== i);
                    this.requestUpdate();
                  }}>
										<wa-icon src="/src/icons/trash.svg"></wa-icon>
									</wa-button>
								</div>
							`)}
						</div>

						<wa-select label="Category" value=${this.editingEntry.category} @wa-change=${(e: any) => this.editingEntry!.category = e.target.value}>
							<wa-option value="Name">Name</wa-option>
							<wa-option value="Place">Place</wa-option>
							<wa-option value="Term">Term</wa-option>
							<wa-option value="Other">Other</wa-option>
						</wa-select>
					</div>
				` : ''}
				<wa-button slot="footer" variant="brand" @click=${this.handleSaveGlossary}>Save Entry</wa-button>
			</wa-dialog>
		`;
  }
}
