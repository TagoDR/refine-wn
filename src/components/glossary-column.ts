import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { GlossaryEntry } from '../services/glossary-manager';
import type { Character } from '../types';

@customElement('glossary-column')
export class GlossaryColumn extends LitElement {
  static styles = css`
		:host {
			display: flex;
			flex-direction: column;
			height: 100vh;
			border-right: 1px solid var(--wa-color-surface-border);
			background: var(--wa-color-surface-raised);
			min-width: 0;
			overflow: hidden;
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

		.section-divider {
			padding: var(--wa-space-xs) var(--wa-space-s);
			background: var(--wa-color-surface-lowered);
			font-weight: var(--wa-font-bold);
			font-size: var(--wa-font-size-2xs);
			color: var(--wa-color-text-quiet);
			text-transform: uppercase;
			letter-spacing: 0.05em;
			margin: var(--wa-space-s) 0 var(--wa-space-xs) 0;
			border-radius: var(--wa-border-radius-s);
		}

		.glossary-item {
			padding: var(--wa-space-xs);
			border-bottom: 1px solid var(--wa-color-surface-border);
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.glossary-item:hover {
			background: var(--wa-color-surface-lowered);
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

		.glossary-actions {
			display: flex;
			align-items: center;
			gap: var(--wa-space-3xs);
		}

		.char-card {
			padding: var(--wa-space-xs);
			border-bottom: 1px solid var(--wa-color-surface-border);
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.char-card:hover {
			background: var(--wa-color-surface-lowered);
		}

		.char-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
		}

		.char-name {
			font-weight: bold;
			color: var(--wa-color-brand-60);
		}

		.char-meta {
			font-size: var(--wa-font-size-2xs);
			color: var(--wa-color-text-quiet);
		}

		.char-aliases {
			font-size: var(--wa-font-size-2xs);
			color: var(--wa-color-text-quiet);
			font-style: italic;
		}
	`;

  @property({ type: Array }) entries: GlossaryEntry[] = [];
  @property({ type: Array }) characters: Character[] = [];

  render() {
    return html`
			<div class="sticky-header">
				<div class="header-title">
					<span>GLOSSARY</span>
					<div class="header-actions">
						<wa-button size="extra-small" variant="neutral" ghost @click=${() =>
              this.dispatchEvent(new CustomEvent('import-glossary'))}>
							<wa-icon src="/src/icons/file-import.svg"></wa-icon>
						</wa-button>
						<wa-button size="extra-small" variant="neutral" ghost @click=${() =>
              this.dispatchEvent(new CustomEvent('export-glossary'))}>
							<wa-icon src="/src/icons/file-export.svg"></wa-icon>
						</wa-button>
						<wa-button size="extra-small" variant="danger" ghost @click=${() =>
              this.dispatchEvent(new CustomEvent('clear-glossary'))}>
							<wa-icon src="/src/icons/trash.svg"></wa-icon>
						</wa-button>
					</div>
				</div>
				<wa-button size="small" variant="brand" appearance="accent" style="width:100%;" @click=${() =>
          this.dispatchEvent(new CustomEvent('add-entry'))}>
					<wa-icon src="/src/icons/square-plus.svg" slot="prefix"></wa-icon> Add Term
				</wa-button>
			</div>
			
			<div class="scroll-content">
				<div class="section-divider">Terminology</div>
				${this.entries.map(
          entry => html`
					<div class="glossary-item" @click=${() =>
            this.dispatchEvent(new CustomEvent<GlossaryEntry>('edit-entry', { detail: entry }))} style="cursor: pointer;">
						<div style="display:flex; justify-content:space-between; align-items:flex-start;">
							<div class="glossary-term">${entry.term}</div>
							<div class="glossary-actions">
								<wa-button size="extra-small" variant="neutral" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(
                    new CustomEvent<GlossaryEntry>('edit-entry', { detail: entry }),
                  );
                }}>
									<wa-icon src="/src/icons/edit.svg"></wa-icon>
								</wa-button>
								<wa-button size="extra-small" variant="danger" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(new CustomEvent<string>('delete-entry', { detail: entry.id }));
                }}>
									<wa-icon src="/src/icons/trash.svg"></wa-icon>
								</wa-button>
							</div>
						</div>
						<div class="glossary-searches">${entry.searches.join(', ')}</div>
						<wa-tag size="extra-small" variant="neutral">${entry.category}</wa-tag>
					</div>
				`,
        )}

				<div class="section-divider">Characters</div>
				<div style="padding: 0 var(--wa-space-xs); margin-bottom: var(--wa-space-xs);">
					<wa-button size="small" variant="brand" appearance="accent" style="width:100%;" @click=${() =>
            this.dispatchEvent(new CustomEvent('add-character'))}>
						<wa-icon src="/src/icons/square-plus.svg" slot="prefix"></wa-icon> Add Character
					</wa-button>
				</div>
				${this.characters.map(
          char => html`
					<div class="char-card" @click=${() =>
            this.dispatchEvent(new CustomEvent<Character>('edit-character', { detail: char }))} style="cursor: pointer;">
						<div class="char-header">
							<div class="char-name">${char.name}</div>
							<div class="glossary-actions">
								<wa-button size="extra-small" variant="neutral" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(new CustomEvent<Character>('edit-character', { detail: char }));
                }}>
									<wa-icon src="/src/icons/edit.svg"></wa-icon>
								</wa-button>
								<wa-button size="extra-small" variant="danger" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(
                    new CustomEvent<string>('delete-character', { detail: char.id }),
                  );
                }}>
									<wa-icon src="/src/icons/trash.svg"></wa-icon>
								</wa-button>
							</div>
						</div>
						<div class="char-meta">
							${char.category} ${char.gender ? `| ${char.gender}` : ''}
						</div>
						${
              char.aliases.length > 0
                ? html`<div class="char-aliases">Aliases: ${char.aliases.join(', ')}</div>`
                : ''
            }
					</div>
				`,
        )}
			</div>
		`;
  }
}
