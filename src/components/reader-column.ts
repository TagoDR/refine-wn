import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import * as Diff from 'diff';
import type { Chapter } from '../services/epub-service';
import type { LogEntry } from '../types';

@customElement('reader-column')
export class ReaderColumn extends LitElement {
  static styles = css`
		:host {
			display: flex;
			flex-direction: column;
			height: 100vh;
			min-height: 0;
			overflow: hidden;
			background: var(--wa-color-surface-default);
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

		.diff-added {
			background-color: rgba(40, 167, 69, 0.2);
			color: #28a745;
			text-decoration: none;
		}

		.diff-removed {
			background-color: rgba(220, 53, 69, 0.2);
			color: #dc3545;
			text-decoration: line-through;
		}
	`;

  @property({ type: Object }) chapter: Chapter | null = null;
  @property({ type: Boolean }) diffMode = false;
  @property({ type: Array }) logs: LogEntry[] = [];

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('logs')) {
      const consoleLogs = this.shadowRoot?.querySelector('.console-logs');
      if (consoleLogs) {
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
      }
    }
  }

  private stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    // Replace <p> and <br> with newlines to preserve structure in diff
    const walk = document.createTreeWalker(div, NodeFilter.SHOW_ELEMENT);
    let node: Node | null;
    while ((node = walk.nextNode())) {
      const el = node as HTMLElement;
      if (el.tagName === 'P' || el.tagName === 'BR' || el.tagName === 'DIV' || el.tagName === 'H1' || el.tagName === 'H2') {
        const newline = document.createTextNode('\n');
        el.parentNode?.insertBefore(newline, el.nextSibling);
      }
    }
    return div.textContent || '';
  }

  private renderDiff() {
    if (!this.chapter) return html``;

    const oldText = this.stripHtml(this.chapter.originalContent || '');
    const newText = this.stripHtml(this.chapter.content || '');

    // We diff words for better readability in prose
    const changes = Diff.diffWords(oldText, newText);

    return html`
			<div class="chapter-content" style="white-space: pre-wrap; font-family: var(--wa-font-family-body);">
				${changes.map(part => {
          if (part.added) {
            return html`<span class="diff-added">${part.value}</span>`;
          }
          if (part.removed) {
            return html`<span class="diff-removed">${part.value}</span>`;
          }
          return html`<span>${part.value}</span>`;
        })}
			</div>
		`;
  }

  render() {
    return html`
			<div class="reader-area">
				${
          this.chapter
            ? html`
					<div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-shrink:0;">
						<h1 style="margin:0;">${this.chapter.title}</h1>
						<div style="display:flex; gap: var(--wa-space-xs);">
							<wa-button size="small" variant="neutral" @click=${() => this.dispatchEvent(new CustomEvent('discard-refinement'))} title="Revert to original MTL">
								<wa-icon src="/icons/trash.svg" slot="prefix"></wa-icon>
								Discard
							</wa-button>
							<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('toggle-diff'))}>
								<wa-icon src="/icons/list-search.svg" slot="prefix"></wa-icon>
								${this.diffMode ? 'Refined View' : 'Diff View'}
							</wa-button>
						</div>
					</div>
					
					${
            this.diffMode
              ? html`
						<div style="padding: var(--wa-space-m);">
							<div style="font-weight:bold; color:var(--wa-color-brand-60); margin-bottom:1rem; display:flex; gap: var(--wa-space-m);">
								<span>UNIFIED DIFF</span>
								<div style="display:flex; gap: var(--wa-space-xs); font-size: 0.8rem; font-weight: normal;">
									<span class="diff-added" style="padding: 2px 4px; border-radius: 4px;">Added</span>
									<span class="diff-removed" style="padding: 2px 4px; border-radius: 4px;">Removed</span>
								</div>
							</div>
							${this.renderDiff()}
						</div>
					`
              : html`
						<div class="chapter-content">${unsafeHTML(this.chapter.content)}</div>
					`
          }
				`
            : html`
					<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--wa-color-text-quiet);">
						<wa-icon src="/icons/list-search.svg" style="font-size: 5rem; margin-bottom: 1rem; opacity: 0.2;"></wa-icon>
						<p>Select a chapter to start reading</p>
					</div>
				`
        }
			</div>
			
			<div class="console-area">
				<div class="console-header">PROCESS CONSOLE</div>
				<div class="console-logs">
					${this.logs.map(
            log => html`
						<div class="log-entry log-${log.type}">
							[${log.timestamp}] ${log.message}
						</div>
					`,
          )}
					${this.logs.length === 0 ? html`<div>Waiting for activity...</div>` : ''}
				</div>
			</div>
		`;
  }
}
