import { get, set } from 'idb-keyval';
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('app-root')
export class AppRoot extends LitElement {
	static styles = css`
		:host {
			display: block;
			height: 100vh;
		}

		wa-page {
			height: 100vh;
			--menu-width: 300px;
		}

		[slot='navigation'] {
			padding: var(--wa-space-m);
			background-color: var(--wa-color-neutral-50);
			height: 100%;
			border-right: solid 1px var(--wa-color-neutral-200);
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
	`;

	@state()
	private settings = {
		theme: 'light',
		apiKey: '',
	};

	async firstUpdated() {
		const savedSettings = await get('project-settings');
		if (savedSettings) {
			this.settings = savedSettings;
		}
	}

	protected async saveSettings() {
		await set('project-settings', this.settings);
	}

	render() {
		return html`
			<wa-page>
				<div slot="header">
					<div class="logo">RefineWN</div>
					<div style="display: flex; gap: var(--wa-space-s); align-items: center;">
						<span>Theme: ${this.settings.theme}</span>
						<wa-button variant="text" data-toggle-nav class="wa-mobile-only">
							<wa-icon name="bars"></wa-icon>
						</wa-button>
					</div>
				</div>

				<div slot="navigation">
					<h3>Chapters</h3>
					<wa-tree>
						<wa-tree-item>Chapter 1: The Awakening</wa-tree-item>
						<wa-tree-item>Chapter 2: The Sect Entrance</wa-tree-item>
						<wa-tree-item>Chapter 3: Hidden Talent</wa-tree-item>
					</wa-tree>
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
