import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Chapter } from '../services/epub-service';

@customElement('chapter-column')
export class ChapterColumn extends LitElement {
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
	`;

  @property({ type: Array }) chapters: Chapter[] = [];
  @property({ type: Number }) selectedIndex = -1;
  @property({ type: Boolean }) disabled = false;

  render() {
    return html`
			<div class="sticky-header">
				<div class="header-title">
					<span>CHAPTERS</span>
					<wa-tag size="small" variant="neutral">${this.chapters.length}</wa-tag>
				</div>
				<div class="header-actions">
					<wa-button size="small" variant="brand" @click=${() => this.dispatchEvent(new CustomEvent('open-epub'))}>
						<wa-icon src="/icons/file-upload.svg"></wa-icon> Open
					</wa-button>
					<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('close-project'))} ?disabled=${this.chapters.length === 0}>
						<wa-icon src="/icons/x.svg"></wa-icon> Close
					</wa-button>
					<wa-button size="small" variant="success" @click=${() => this.dispatchEvent(new CustomEvent('save-epub'))} ?disabled=${this.chapters.length === 0}>
						<wa-icon src="/icons/device-floppy.svg"></wa-icon> Save
					</wa-button>
				</div>
			</div>
			<div class="scroll-content">
				${this.chapters.map(
          (ch, i) => html`
					<div class="chapter-item ${this.selectedIndex === i ? 'selected' : ''}" @click=${() => this.dispatchEvent(new CustomEvent<number>('select-chapter', { detail: i }))}>
						<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
							${ch.title || `Chapter ${i + 1}`}
						</span>
						<div style="display:flex; gap:2px;">
							<wa-button class="trash-btn" size="extra-small" variant="danger" ghost @click=${(
                e: Event,
              ) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent<number>('trash-chapter', { detail: i }));
              }}>
								<wa-icon src="/icons/trash.svg"></wa-icon>
							</wa-button>
						</div>
					</div>
				`,
        )}
				${this.chapters.length === 0 ? html`<div style="text-align:center; padding-top:2rem; color:var(--wa-color-text-quiet);">No book loaded</div>` : ''}
			</div>
		`;
  }
}
