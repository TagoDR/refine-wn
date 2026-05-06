import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Character } from '../types';

@customElement('character-column')
export class CharacterColumn extends LitElement {
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

		.actions {
			display: flex;
			align-items: center;
			gap: var(--wa-space-3xs);
		}
	`;

  @property({ type: Array }) characters: Character[] = [];

  render() {
    return html`
			<div class="sticky-header">
				<div class="header-title">
					<span>CHARACTERS</span>
					<wa-tag size="small" variant="neutral">${this.characters.length}</wa-tag>
				</div>
				<wa-button size="small" variant="brand" appearance="accent" style="width:100%;" @click=${() =>
          this.dispatchEvent(new CustomEvent('add-character'))}>
					<wa-icon src="/icons/square-plus.svg" slot="prefix"></wa-icon> Add Character
				</wa-button>
			</div>
			
			<div class="scroll-content">
				${this.characters.map(
          char => html`
					<div class="char-card" @click=${() =>
            this.dispatchEvent(new CustomEvent<Character>('edit-character', { detail: char }))} style="cursor: pointer;">
						<div class="char-header">
							<div class="char-name">${char.name}</div>
							<div class="actions">
								<wa-button size="extra-small" variant="neutral" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(new CustomEvent<Character>('edit-character', { detail: char }));
                }}>
									<wa-icon src="/icons/edit.svg"></wa-icon>
								</wa-button>
								<wa-button size="extra-small" variant="danger" ghost @click=${(e: Event) => {
                  e.stopPropagation();
                  this.dispatchEvent(
                    new CustomEvent<string>('delete-character', { detail: char.id }),
                  );
                }}>
									<wa-icon src="/icons/trash.svg"></wa-icon>
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
				${
          this.characters.length === 0
            ? html`<div style="text-align:center; padding-top:2rem; color:var(--wa-color-text-quiet);">No characters defined</div>`
            : ''
        }
			</div>
		`;
  }
}
