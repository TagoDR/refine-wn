import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { AiBridge } from './services/ai-bridge';
import { type Chapter, type EpubMetadata } from './services/epub-service';
import { EpubWorkerClient } from './services/epub-worker-client';
import { GlossaryManager, type GlossaryEntry } from './services/glossary-manager';
import { TextCleaner } from './services/text-cleaner';
import { TtsService } from './services/tts-service';

@customElement('app-root')
export class AppRoot extends LitElement {
	static styles = css`
		:host {
			display: block;
			height: 100vh;
		}

		wa-page {
			height: 100vh;
			--menu-width: 350px;
		}

		[slot='navigation'] {
			background-color: var(--wa-color-neutral-50);
			height: 100%;
			border-right: solid 1px var(--wa-color-neutral-200);
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
			background-color: var(--wa-color-white);
			border-bottom: solid 1px var(--wa-color-neutral-200);
			padding: 0 var(--wa-space-m);
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.logo {
			font-weight: var(--wa-font-bold);
			font-size: var(--wa-font-size-l);
			color: var(--wa-color-primary-600);
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
			white-space: pre-wrap;
			padding: var(--wa-space-m);
		}

		.raw-content {
			background-color: var(--wa-color-neutral-50);
			color: var(--wa-color-neutral-600);
			font-size: var(--wa-font-size-s);
		}

		.glossary-list {
			display: flex;
			flex-direction: column;
			gap: var(--wa-space-xs);
		}

		.glossary-item {
			padding: var(--wa-space-xs);
			border-bottom: 1px solid var(--wa-color-neutral-200);
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
			background-color: var(--wa-color-neutral-100);
			border-top: 1px solid var(--wa-color-neutral-200);
		}

		wa-split-panel {
			height: 100%;
			border: 1px solid var(--wa-color-neutral-200);
			border-radius: var(--wa-border-radius-m);
		}

		.panel-label {
			padding: var(--wa-space-xs) var(--wa-space-m);
			background: var(--wa-color-neutral-100);
			border-bottom: 1px solid var(--wa-color-neutral-200);
			font-weight: bold;
			font-size: var(--wa-font-size-xs);
		}
	`;

	@state() private chapters: Chapter[] = [];
	@state() private metadata: EpubMetadata | null = null;
	@state() private selectedChapterIndex = -1;
	@state() private glossaryEntries: GlossaryEntry[] = [];
	@state() private isProcessing = false;
	@state() private progress = 0;
	@state() private statusMessage = '';
	@state() private diffMode = false;

	private epubClient = new EpubWorkerClient();
	private aiBridge = new AiBridge();
	private glossaryManager = new GlossaryManager();
	private textCleaner = new TextCleaner();
	private ttsService = new TtsService();

	async firstUpdated() {
		await this.glossaryManager.load();
		this.glossaryEntries = this.glossaryManager.getAllEntries();
	}

	private async handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		this.isProcessing = true;
		this.statusMessage = 'Loading EPUB...';
		try {
			const result = await this.epubClient.load(file);
			this.chapters = result.chapters;
			this.metadata = result.metadata;
			if (this.chapters.length > 0) this.selectedChapterIndex = 0;
		} catch (error) {
			console.error(error);
			alert('Failed to load EPUB');
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	private async handleExtractNames() {
		if (this.selectedChapterIndex === -1) return;
		
		this.isProcessing = true;
		this.statusMessage = 'Extracting names with AI...';
		try {
			const chapter = this.chapters[this.selectedChapterIndex];
			const cleaned = this.textCleaner.clean(chapter.content);
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
		} catch (error) {
			console.error(error);
			alert('AI Extraction failed');
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	private async handleRefineChapter() {
		if (this.selectedChapterIndex === -1) return;

		this.isProcessing = true;
		this.statusMessage = 'Refining chapter with AI...';
		try {
			const chapter = this.chapters[this.selectedChapterIndex];
			const cleaned = this.textCleaner.clean(chapter.content);
			const glossaryContext = JSON.stringify(this.glossaryManager.getAllEntries());
			
			const refined = await this.aiBridge.refineChapter(cleaned, glossaryContext);
			
			this.chapters[this.selectedChapterIndex] = {
				...chapter,
				content: refined
			};
			this.chapters = [...this.chapters];
		} catch (error) {
			console.error(error);
			alert('AI Refinement failed');
		} finally {
			this.isProcessing = false;
			this.statusMessage = '';
		}
	}

	private handleSpeak() {
		if (this.selectedChapterIndex === -1) return;
		const chapter = this.chapters[this.selectedChapterIndex];
		this.ttsService.speak(chapter.content, this.glossaryEntries);
	}

	private handleStopSpeak() {
		this.ttsService.cancel();
	}

	render() {
		const currentChapter = this.chapters[this.selectedChapterIndex];

		return html`
			<wa-page>
				<div slot="header">
					<div class="logo">RefineWN ${this.metadata ? ` - ${this.metadata.title}` : ''}</div>
					<div style="display: flex; gap: var(--wa-space-s); align-items: center;">
						<wa-button variant="text" data-toggle-nav class="wa-mobile-only">
							<wa-icon name="bars"></wa-icon>
						</wa-button>
						<input type="file" id="epub-upload" accept=".epub" style="display: none" @change=${this.handleFileUpload}>
						<wa-button variant="primary" size="small" @click=${() => this.shadowRoot?.getElementById('epub-upload')?.click()}>
							Upload EPUB
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
						<div class="controls">
							<wa-button size="small" @click=${this.handleExtractNames} ?disabled=${this.isProcessing}>
								<wa-icon name="wand-magic-sparkles" slot="prefix"></wa-icon>
								Extract Names
							</wa-button>
							<wa-button size="small" variant="primary" @click=${this.handleRefineChapter} ?disabled=${this.isProcessing}>
								<wa-icon name="sparkles" slot="prefix"></wa-icon>
								Refine
							</wa-button>
							<wa-button size="small" @click=${() => this.diffMode = !this.diffMode}>
								<wa-icon name=${this.diffMode ? "eye" : "columns-scroll"} slot="prefix"></wa-icon>
								${this.diffMode ? "View Refined" : "Diff View"}
							</wa-button>
							<div style="flex: 1"></div>
							<wa-button size="small" @click=${this.handleSpeak}>
								<wa-icon name="play" slot="prefix"></wa-icon>
								Listen
							</wa-button>
							<wa-button size="small" @click=${this.handleStopSpeak}>
								<wa-icon name="stop" slot="prefix"></wa-icon>
							</wa-button>
						</div>

						<div class="chapter-container">
							${this.diffMode ? html`
								<wa-split-panel position="50">
									<div slot="start" style="height: 100%; display: flex; flex-direction: column;">
										<div class="panel-label">RAW MTL</div>
										<div class="chapter-content raw-content">${currentChapter.originalContent || 'No original content'}</div>
									</div>
									<div slot="end" style="height: 100%; display: flex; flex-direction: column;">
										<div class="panel-label">REFINED PROSE</div>
										<div class="chapter-content">${currentChapter.content}</div>
									</div>
								</wa-split-panel>
							` : html`
								<wa-card style="height: 100%; overflow: auto;">
									<div slot="header">
										<strong>${currentChapter.title}</strong>
									</div>
									<div class="chapter-content">${currentChapter.content}</div>
								</wa-card>
							`}
						</div>
					` : html`
						<div style="text-align: center; margin-top: 100px; color: var(--wa-color-neutral-500);">
							<wa-icon name="book-open" style="font-size: 4rem; display: block; margin-bottom: 1rem;"></wa-icon>
							<p>Upload an EPUB file to start refining.</p>
						</div>
					`}
				</main>

				<div slot="footer">
					&copy; 2026 RefineWN Project
				</div>
			</wa-page>
		`;
	}
}
