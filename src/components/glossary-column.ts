import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { GlossaryEntry } from '../services/glossary-manager';

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

		.glossary-icon-btn {
			--wa-font-size-xs: 0.75rem;
			color: var(--wa-color-text-quiet);
		}
	`;

  @property({ type: Array }) entries: GlossaryEntry[] = [];

  render() {
    return html`
			<div class="sticky-header">
				<div class="header-title">
					<span>GLOSSARY</span>
					<wa-tag size="small" variant="neutral">${this.entries.length}</wa-tag>
				</div>
				<div class="header-actions">
					<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('import-glossary'))}>
						<wa-icon src="/src/icons/file-import.svg"></wa-icon> Import
					</wa-button>
					<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('export-glossary'))} ?disabled=${this.entries.length === 0}>
						<wa-icon src="/src/icons/file-export.svg"></wa-icon> Export
					</wa-button>
					<wa-button size="small" variant="danger" ghost @click=${() => this.dispatchEvent(new CustomEvent('clear-glossary'))} ?disabled=${this.entries.length === 0}>
						<wa-icon src="/src/icons/trash.svg"></wa-icon>
					</wa-button>
					<wa-button size="small" variant="brand" appearance="accent" @click=${() => this.dispatchEvent(new CustomEvent('add-entry'))}>
						<wa-icon src="/src/icons/square-plus.svg"></wa-icon>
					</wa-button>
				</div>
			</div>
			<div class="scroll-content">
				${this.entries.map(
          entry => html`
					<div class="glossary-item" @click=${() => this.dispatchEvent(new CustomEvent('edit-entry', { detail: entry }))} style="cursor: pointer;">
						<div style="display:flex; justify-content:space-between; align-items:flex-start;">
							<div class="glossary-term">${entry.term}</div>
							<div class="glossary-actions">
								<wa-icon-button src="/src/icons/edit.svg" label="Edit" class="glossary-icon-btn"></wa-icon-button>
								<wa-icon-button src="/src/icons/trash.svg" label="Delete" class="glossary-icon-btn" style="color: var(--wa-color-danger-60);" @click=${(
                  e: Event,
                ) => {
                  e.stopPropagation();
                  this.dispatchEvent(new CustomEvent('delete-entry', { detail: entry.id }));
                }}></wa-icon-button>
							</div>
						</div>
						<div class="glossary-searches">${entry.searches.join(', ')}</div>
						<wa-tag size="extra-small" variant="neutral">${entry.category}</wa-tag>
					</div>
				`,
        )}
			</div>
		`;
  }
}
