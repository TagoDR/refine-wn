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

		.actions {
			display: flex;
			align-items: center;
			gap: var(--wa-space-3xs);
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
				<wa-button size="small" variant="brand" appearance="accent" style="width:100%;" @click=${() =>
          this.dispatchEvent(new CustomEvent('add-entry'))}>
					<wa-icon src="/icons/square-plus.svg" slot="prefix"></wa-icon> Add Term
				</wa-button>
			</div>
			
			<div class="scroll-content">
				${this.entries.map(
          entry => html`
					<div class="glossary-item" @click=${() =>
            this.dispatchEvent(
              new CustomEvent<GlossaryEntry>('edit-entry', { detail: entry }),
            )} style="cursor: pointer;">
						<div style="display:flex; justify-content:space-between; align-items:flex-start;">
							<div class="glossary-term">${entry.term}</div>
							<div class="actions">
								<wa-button size="extra-small" variant="neutral" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(
                    new CustomEvent<GlossaryEntry>('edit-entry', { detail: entry }),
                  );
                }}>
									<wa-icon src="/icons/edit.svg"></wa-icon>
								</wa-button>
								<wa-button size="extra-small" variant="danger" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(new CustomEvent<string>('delete-entry', { detail: entry.id }));
                }}>
									<wa-icon src="/icons/trash.svg"></wa-icon>
								</wa-button>
							</div>
						</div>
						<div class="glossary-searches">${entry.searches.join(', ')}</div>
						<wa-tag size="extra-small" variant="neutral">${entry.category}</wa-tag>
					</div>
				`,
        )}
				${
          this.entries.length === 0
            ? html`<div style="text-align:center; padding-top:2rem; color:var(--wa-color-text-quiet);">No terms defined</div>`
            : ''
        }
			</div>
		`;
  }
}
