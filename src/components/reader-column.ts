import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
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

  render() {
    return html`
			<div class="reader-area" style="${this.diffMode ? 'overflow:hidden; display:flex; flex-direction:column;' : ''}">
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
						<wa-split-panel position="50" style="flex:1; min-height:0;">
							<div slot="start" style="padding: var(--wa-space-m); height:100%; overflow:auto;">
								<div style="font-weight:bold; color:var(--wa-color-text-quiet); margin-bottom:1rem;">RAW MTL</div>
								<div class="chapter-content" style="color: var(--wa-color-text-quiet); font-size: 0.9rem;">${unsafeHTML(this.chapter.originalContent || '')}</div>
							</div>
							<div slot="end" style="padding: var(--wa-space-m); height:100%; overflow:auto;">
								<div style="font-weight:bold; color:var(--wa-color-brand-60); margin-bottom:1rem;">REFINED</div>
								<div class="chapter-content">${unsafeHTML(this.chapter.content)}</div>
							</div>
						</wa-split-panel>
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
