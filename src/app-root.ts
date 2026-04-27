import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { GlossaryManager, type GlossaryEntry } from './services/glossary-manager';

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
			max-width: 800px;
			margin: 0 auto;
		}

		.chapter-content {
			line-height: 1.6;
			font-size: var(--wa-font-size-m);
		}

		.glossary-form {
			display: flex;
			flex-direction: column;
			gap: var(--wa-space-s);
			margin-bottom: var(--wa-space-l);
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
	`;

	@state()
	private glossaryEntries: GlossaryEntry[] = [];

	private glossaryManager = new GlossaryManager();

	async firstUpdated() {
		await this.glossaryManager.load();
		this.glossaryEntries = this.glossaryManager.getAllEntries();
	}

	private async handleAddGlossary(e: Event) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);

		const entry: GlossaryEntry = {
			id: crypto.randomUUID(),
			original: formData.get('original') as string,
			translated: formData.get('translated') as string,
			phonetic: formData.get('phonetic') as string,
			category: formData.get('category') as any,
		};

		this.glossaryManager.upsertEntry(entry);
		await this.glossaryManager.save();
		this.glossaryEntries = this.glossaryManager.getAllEntries();
		form.reset();
	}

	private async handleExportGlossary() {
		const json = this.glossaryManager.exportJson();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'glossary.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	render() {
		return html`
			<wa-page>
				<div slot="header">
					<div class="logo">RefineWN</div>
					<div style="display: flex; gap: var(--wa-space-s); align-items: center;">
						<wa-button variant="text" data-toggle-nav class="wa-mobile-only">
							<wa-icon name="bars"></wa-icon>
						</wa-button>
					</div>
				</div>

				<div slot="navigation">
					<wa-tab-group>
						<wa-tab slot="nav" panel="chapters">Chapters</wa-tab>
						<wa-tab slot="nav" panel="glossary">Glossary</wa-tab>

						<wa-tab-panel name="chapters">
							<wa-tree>
								<wa-tree-item>Chapter 1: The Awakening</wa-tree-item>
								<wa-tree-item>Chapter 2: The Sect Entrance</wa-tree-item>
								<wa-tree-item>Chapter 3: Hidden Talent</wa-tree-item>
							</wa-tree>
						</wa-tab-panel>

						<wa-tab-panel name="glossary">
							<form class="glossary-form" @submit=${this.handleAddGlossary}>
								<wa-input name="original" label="Original" size="small" required></wa-input>
								<wa-input name="translated" label="Translated" size="small" required></wa-input>
								<wa-input name="phonetic" label="Phonetic (TTS)" size="small"></wa-input>
								<wa-select name="category" label="Category" value="Name" size="small">
									<wa-option value="Name">Name</wa-option>
									<wa-option value="Place">Place</wa-option>
									<wa-option value="Term">Term</wa-option>
									<wa-option value="Other">Other</wa-option>
								</wa-select>
								<wa-button type="submit" variant="primary" size="small">Add Entry</wa-button>
							</form>

							<wa-divider></wa-divider>

							<div class="glossary-list">
								${this.glossaryEntries.map(
									(entry) => html`
									<div class="glossary-item">
										<strong>${entry.original}</strong>: ${entry.translated} 
										${entry.phonetic ? html`<i>(${entry.phonetic})</i>` : ''}
										<wa-tag size="small" variant="neutral">${entry.category}</wa-tag>
									</div>
								`,
								)}
							</div>

							<wa-button @click=${this.handleExportGlossary} style="margin-top: var(--wa-space-m)" size="small">
								Export JSON
							</wa-button>
						</wa-tab-panel>
					</wa-tab-group>
				</div>

				<main>
					<wa-card>
						<div slot="header">
							<strong>Chapter 1: The Awakening</strong>
						</div>
						<div class="chapter-content">
							<p>The morning mist clung to the peaks of the Azure Cloud Pavilion...</p>
							<p>Long Chen opened his eyes, feeling a strange warmth in his dantian.</p>
						</div>
					</wa-card>
				</main>

				<div slot="footer">
					&copy; 2026 RefineWN Project
				</div>
			</wa-page>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-root': AppRoot;
	}
}
