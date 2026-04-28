import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { AiBridge } from './services/ai-bridge';
import { type Chapter, type EpubMetadata } from './services/epub-service';
import { EpubWorkerClient } from './services/epub-worker-client';
import { GlossaryManager, type GlossaryEntry } from './services/glossary-manager';
import { TextCleaner } from './services/text-cleaner';

@customElement('app-root')
export class AppRoot extends LitElement {
	static styles = css`
		:host {
			display: block;
			height: 100vh;
			background-color: var(--wa-color-surface-default);
			color: var(--wa-color-text-normal);
		}

		wa-page {
			height: 100vh;
			--menu-width: 350px;
		}

		[slot='navigation'] {
			background-color: var(--wa-color-surface-lowered);
			height: 100%;
			border-right: solid 1px var(--wa-color-surface-border);
			display: flex;
			flex-direction: column;
		}

		wa-tab-group {
			height: 100%;
		}

		wa-tab-panel {
			padding: var(--wa-space-m);
		}

		[slot='header'] {
			background-color: var(--wa-color-surface-raised);
			border-bottom: solid 1px var(--wa-color-surface-border);
			padding: var(--wa-space-xs) var(--wa-space-m);
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-wrap: wrap;
			gap: var(--wa-space-s);
		}

		.header-actions {
			display: flex;
			gap: var(--wa-space-xs);
			align-items: center;
		}

		.logo {
			font-weight: var(--wa-font-bold);
			font-size: var(--wa-font-size-l);
			color: var(--wa-color-brand-60);
		}

		main {
			padding: var(--wa-space-l);
			max-width: 1000px;
			margin: 0 auto;
			height: calc(100vh - 120px);
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}

		.chapter-container {
			flex: 1;
			overflow-y: auto;
		}

		.chapter-content {
			line-height: 1.6;
			font-size: var(--wa-font-size-m);
			padding: var(--wa-space-m);
		}

		.raw-content {
			background-color: var(--wa-color-surface-lowered);
			color: var(--wa-color-text-quiet);
			font-size: var(--wa-font-size-s);
			white-space: pre-wrap;
		}

		.glossary-list {
			display: flex;
			flex-direction: column;
			gap: var(--wa-space-xs);
		}

		.glossary-item {
			padding: var(--wa-space-xs);
			border-bottom: 1px solid var(--wa-color-surface-border);
			font-size: var(--wa-font-size-s);
		}

		.controls {
			display: flex;
			gap: var(--wa-space-s);
			margin-bottom: var(--wa-space-m);
			flex-wrap: wrap;
		}

		.progress-container {
			padding: var(--wa-space-m);
			background-color: var(--wa-color-surface-lowered);
			border-top: 1px solid var(--wa-color-surface-border);
		}

		wa-split-panel {
			height: 100%;
			border: 1px solid var(--wa-color-surface-border);
			border-radius: var(--wa-border-radius-m);
		}

		.panel-label {
			padding: var(--wa-space-xs) var(--wa-space-m);
			background: var(--wa-color-surface-lowered);
			border-bottom: 1px solid var(--wa-color-surface-border);
			font-weight: bold;
			font-size: var(--wa-font-size-xs);
		}

		.console {
			background: #1e1e1e;
			color: #d4d4d4;
			font-family: var(--wa-font-family-code);
			font-size: var(--wa-font-size-2xs);
			padding: var(--wa-space-xs);
			height: 150px;
			overflow-y: auto;
			border-top: 2px solid var(--wa-color-surface-border);
			margin-top: var(--wa-space-s);
		}

		.log-entry {
			margin-bottom: 2px;
			border-bottom: 1px solid #333;
			padding-bottom: 2px;
		}

		.log-error { color: #f44747; }
		.log-info { color: #4fc1ff; }
		.log-success { color: #b5cea8; }
	`;

	@state() private chapters: Chapter[] = [];
	@state() private metadata: EpubMetadata | null = null;
	@state() private selectedChapterIndex = -1;
	@state() private glossaryEntries: GlossaryEntry[] = [];
	@state() private isProcessing = false;
	@state() private progress = 0;
	@state() private statusMessage = '';
	@state() private diffMode = false;
	@state() private logs: { type: 'info' | 'error' | 'success', message: string, timestamp: string }[] = [];

	private epubClient = new EpubWorkerClient();
	private aiBridge = new AiBridge();
	private glossaryManager = new GlossaryManager();
	private textCleaner = new TextCleaner();

	private async handleTestAi() {
		this.isProcessing = true;
		this.addLog('info', 'Testing AI Connection (Port 5004)...');
		try {
			const success = await this.aiBridge.testConnection();
			if (success) {
				this.addLog('success', 'AI Connection Successful!');
			} else {
				this.addLog('error', 'AI Connection Failed. Check if LM Studio is running on port 5004.');
			}
		} catch (error) {
			this.addLog('error', `AI Connection Error: ${error}`);
		} finally {
			this.isProcessing = false;
		}
	}

	private addLog(type: 'info' | 'error' | 'success', message: string) {
		const timestamp = new Date().toLocaleTimeString();
		this.logs = [...this.logs, { type, message, timestamp }];
		// Auto scroll to bottom
		setTimeout(() => {
			const consoleDiv = this.shadowRoot?.querySelector('.console');
			if (consoleDiv) consoleDiv.scrollTop = consoleDiv.scrollHeight;
		}, 50);
	}

	async firstUpdated() {
		await this.glossaryManager.load();
		this.glossaryEntries = this.glossaryManager.getAllEntries();
		await this.autoLoadTestEpub();
	}

	private async autoLoadTestEpub() {
		this.addLog('info', 'Searching for test EPUB...');
		try {
			// Try to load the first epub from the test folder if it exists
			// This assumes the dev server serves the root or the test folder
			const response = await fetch('/test/test.epub');
			if (response.ok) {
				const blob = await response.blob();
				const file = new File([blob], 'test.epub', { type: 'application/epub+zip' });
				await this.loadEpubFile(file);
				this.addLog('success', 'Auto-loaded test EPUB: God Tier Farm');
			} else {
				this.addLog('info', 'Test EPUB not found at expected path.');
			}
		} catch (error) {
			this.addLog('error', `Auto-load failed: ${error}`);
			console.warn('Auto-load test EPUB failed:', error);
		}
	}

	private async handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		this.addLog('info', `Manual upload: ${file.name}`);
		await this.loadEpubFile(file);
	}

	private async loadEpubFile(file: File) {
		this.isProcessing = true;
		this.statusMessage = 'Loading EPUB...';
		try {
			const result = await this.epubClient.load(file);
			this.chapters = result.chapters;
			this.metadata = result.metadata;
			if (this.chapters.length > 0) this.selectedChapterIndex = 0;
			this.addLog('success', `Loaded ${this.chapters.length} chapters.`);
		} catch (error) {
			this.addLog('error', `Failed to load EPUB: ${error}`);
			console.error(error);
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	private async handleExtractNames() {
		if (this.selectedChapterIndex === -1) return;
		
		this.isProcessing = true;
		this.statusMessage = 'Extracting names with AI...';
		this.addLog('info', 'Starting AI name extraction...');
		try {
			const chapter = this.chapters[this.selectedChapterIndex];
			const cleaned = this.textCleaner.clean(chapter.content);
			
			this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
			
			const json = await this.aiBridge.extractNames(cleaned.substring(0, 4000));
			const newEntries = JSON.parse(json);
			
			for (const entry of newEntries) {
				this.glossaryManager.upsertEntry({
					...entry,
					id: crypto.randomUUID()
				});
			}
			await this.glossaryManager.save();
			this.glossaryEntries = this.glossaryManager.getAllEntries();
			this.addLog('success', `Extracted ${newEntries.length} new glossary entries.`);
		} catch (error) {
			this.addLog('error', `Extraction failed: ${error}`);
			console.error(error);
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	private async handleRefineChapter() {
		if (this.selectedChapterIndex === -1) return;

		this.isProcessing = true;
		this.statusMessage = 'Refining chapter with AI...';
		this.addLog('info', `Refining chapter: ${this.chapters[this.selectedChapterIndex].title}`);
		try {
			const chapter = this.chapters[this.selectedChapterIndex];
			const cleaned = this.textCleaner.clean(chapter.content);
			const glossaryContext = JSON.stringify(this.glossaryManager.getAllEntries());
			
			this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
			
			const refined = await this.aiBridge.refineChapter(cleaned, glossaryContext);
			
			this.chapters[this.selectedChapterIndex] = {
				...chapter,
				content: refined
			};
			this.chapters = [...this.chapters];
			this.addLog('success', 'Chapter refinement complete.');
		} catch (error) {
			this.addLog('error', `Refinement failed: ${error}`);
			console.error(error);
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	private async handleCleanup() {
		if (this.chapters.length === 0) return;

		this.isProcessing = true;
		this.statusMessage = 'Identifying junk chapters...';
		this.addLog('info', 'Starting AI content cleanup...');
		try {
			this.aiBridge.onLog = (msg, type) => this.addLog(type || 'info', msg);
			
			const chapterData = this.chapters.map(ch => ({
				id: ch.id,
				title: ch.title,
				snippet: this.textCleaner.clean(ch.content).substring(0, 500)
			}));

			const idsToRemove = await this.aiBridge.identifyJunkChapters(chapterData);
			this.addLog('info', `AI suggested removing ${idsToRemove.length} chapters: ${idsToRemove.join(', ')}`);
			
			if (idsToRemove.length > 0) {
				const beforeCount = this.chapters.length;
				this.chapters = this.chapters.filter(ch => !idsToRemove.includes(ch.id));
				const removedCount = beforeCount - this.chapters.length;
				this.selectedChapterIndex = this.chapters.length > 0 ? 0 : -1;
				this.addLog('success', `Removed ${removedCount} junk chapters.`);
			} else {
				this.addLog('info', 'No junk chapters identified.');
			}
		} catch (error) {
			this.addLog('error', `Cleanup failed: ${error}`);
			console.error(error);
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	render() {
		const currentChapter = this.chapters[this.selectedChapterIndex];

		return html`
			<wa-page>
				<div slot="header">
					<div class="logo">RefineWN ${this.metadata ? ` - ${this.metadata.title}` : ''}</div>
					<div class="header-actions">
						<wa-button size="small" @click=${this.handleTestAi} ?disabled=${this.isProcessing} title="Test AI Connection">
							<wa-icon name="plug-circle-bolt" slot="prefix"></wa-icon>
							Test AI
						</wa-button>
						
						<wa-divider vertical></wa-divider>

						<wa-button size="small" @click=${this.handleCleanup} ?disabled=${this.isProcessing || this.chapters.length === 0} title="Remove junk chapters">
							<wa-icon name="broom" slot="prefix"></wa-icon>
							Cleanup
						</wa-button>

						<wa-button size="small" @click=${this.handleExtractNames} ?disabled=${this.isProcessing || this.selectedChapterIndex === -1} title="Extract glossary names">
							<wa-icon name="wand-magic-sparkles" slot="prefix"></wa-icon>
							Extract
						</wa-button>

						<wa-button size="small" variant="primary" @click=${this.handleRefineChapter} ?disabled=${this.isProcessing || this.selectedChapterIndex === -1} title="Refine prose">
							<wa-icon name="sparkles" slot="prefix"></wa-icon>
							Refine
						</wa-button>

						<wa-button size="small" @click=${() => this.diffMode = !this.diffMode} ?disabled=${this.selectedChapterIndex === -1}>
							<wa-icon name=${this.diffMode ? "eye" : "columns-scroll"} slot="prefix"></wa-icon>
							${this.diffMode ? "Refined" : "Diff"}
						</wa-button>

						<wa-divider vertical></wa-divider>

						<input type="file" id="epub-upload" accept=".epub" style="display: none" @change=${this.handleFileUpload}>
						<wa-button variant="primary" size="small" @click=${() => this.shadowRoot?.getElementById('epub-upload')?.click()} title="Upload EPUB">
							<wa-icon name="file-import" slot="prefix"></wa-icon>
							Upload
						</wa-button>
					</div>
				</div>

				<div slot="navigation">
					<wa-tab-group>
						<wa-tab slot="nav" panel="chapters">Chapters</wa-tab>
						<wa-tab slot="nav" panel="glossary">Glossary</wa-tab>

						<wa-tab-panel name="chapters">
							<wa-tree>
								${this.chapters.map((ch, index) => html`
									<wa-tree-item 
										?selected=${this.selectedChapterIndex === index}
										@click=${() => this.selectedChapterIndex = index}
									>
										${ch.title || `Chapter ${index + 1}`}
									</wa-tree-item>
								`)}
							</wa-tree>
						</wa-tab-panel>

						<wa-tab-panel name="glossary">
							<div class="glossary-list">
								${this.glossaryEntries.map(entry => html`
									<div class="glossary-item">
										<strong>${entry.original}</strong> -> ${entry.translated}
										<wa-tag size="small" variant="neutral">${entry.category}</wa-tag>
									</div>
								`)}
							</div>
						</wa-tab-panel>
					</wa-tab-group>

					${this.isProcessing ? html`
						<div class="progress-container">
							<div style="margin-bottom: var(--wa-space-xs)">${this.statusMessage}</div>
							<wa-progress-bar value=${this.progress} ?indeterminate=${this.progress === 0}></wa-progress-bar>
						</div>
					` : ''}
				</div>

				<main>
					${currentChapter ? html`
						<div class="chapter-container">
							${this.diffMode ? html`
								<wa-split-panel position="50">
									<div slot="start" style="height: 100%; display: flex; flex-direction: column;">
										<div class="panel-label">RAW MTL</div>
										<div class="chapter-content raw-content">${unsafeHTML(currentChapter.originalContent || 'No original content')}</div>
									</div>
									<div slot="end" style="height: 100%; display: flex; flex-direction: column;">
										<div class="panel-label">REFINED PROSE</div>
										<div class="chapter-content">${unsafeHTML(currentChapter.content)}</div>
									</div>
								</wa-split-panel>
							` : html`
								<wa-card style="height: 100%; overflow: auto;">
									<div slot="header">
										<strong>${currentChapter.title}</strong>
									</div>
									<div class="chapter-content">${unsafeHTML(currentChapter.content)}</div>
								</wa-card>
							`}
						</div>
					` : html`
						<div style="text-align: center; margin-top: 100px; color: var(--wa-color-text-quiet);">
							<wa-icon name="book-open" style="font-size: 4rem; display: block; margin-bottom: 1rem;"></wa-icon>
							<p>Upload an EPUB file to start refining.</p>
						</div>
					`}

					<div class="console">
						<div style="font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #444;">Process Console</div>
						${this.logs.map(log => html`
							<div class="log-entry log-${log.type}">
								[${log.timestamp}] ${log.message}
							</div>
						`)}
						${this.logs.length === 0 ? html`<div>Waiting for activity...</div>` : ''}
					</div>
				</main>

				<div slot="footer">
					&copy; 2026 RefineWN Project
				</div>
			</wa-page>
		`;
	}
}
