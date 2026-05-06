import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('service-column')
export class ServiceColumn extends LitElement {
  static styles = css`
		:host {
			display: flex;
			flex-direction: column;
			height: 100vh;
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
		}

		.scroll-content {
			flex: 1;
			overflow-y: auto;
			padding: var(--wa-space-xs);
			min-height: 0;
			display: flex;
			flex-direction: column;
		}

		.service-card {
			margin-bottom: var(--wa-space-s);
		}

		.sticky-footer {
			margin-top: auto;
			padding: var(--wa-space-m);
			background: var(--wa-color-surface-lowered);
			border-top: 1px solid var(--wa-color-surface-border);
			flex-shrink: 0;
		}

		.progress-text {
			display: flex;
			justify-content: space-between;
			font-size: var(--wa-font-size-xs);
			margin-bottom: 4px;
		}
	`;

  @property({ type: Boolean }) isProcessing = false;
  @property({ type: Boolean }) isPaused = false;
  @property({ type: Number }) progress = 0;
  @property({ type: Number }) currentStep = 0;
  @property({ type: Number }) totalSteps = 0;
  @property({ type: String }) statusMessage = '';
  @property({ type: Boolean }) hasChapters = false;
  @property({ type: Boolean }) hasSelectedChapter = false;
  @property({ type: Boolean }) isTidying = false;

  render() {
    return html`
			<div class="sticky-header">
				<div class="header-title">SERVICES</div>
			</div>
			<div class="scroll-content">
				<wa-card class="service-card">
					<div slot="header">Background Workers</div>
					<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Tidy glossaries, merge duplicates, and move people to the Character Glossary.</p>
					<wa-button size="small" variant="brand" outline style="width:100%;" @click=${() =>
            this.dispatchEvent(new CustomEvent('run-tidier'))} ?disabled=${this.isTidying}>
						<wa-icon name="recycle" slot="prefix"></wa-icon> 
						${this.isTidying ? 'Tidying...' : 'Tidy Glossaries'}
					</wa-button>
				</wa-card>

				<wa-card class="service-card">
					<div slot="header">Portability</div>
					<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;">
						<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('import-glossary'))}>
							<wa-icon src="/icons/file-import.svg" slot="prefix"></wa-icon> Import
						</wa-button>
						<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('export-glossary'))}>
							<wa-icon src="/icons/file-export.svg" slot="prefix"></wa-icon> Export
						</wa-button>
					</div>
					<wa-button size="small" variant="danger" ghost style="width:100%;" @click=${() => this.dispatchEvent(new CustomEvent('clear-glossary'))}>
						<wa-icon src="/icons/trash.svg" slot="prefix"></wa-icon> Clear Settings
					</wa-button>
				</wa-card>

				<slot name="extra"></slot>

				<wa-card class="service-card">
					<div slot="header">Local AI Settings</div>
					<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('configure-ai'))} style="width:100%;">
						<wa-icon name="gear" slot="prefix"></wa-icon> Configure AI
					</wa-button>
					<wa-button size="small" variant="neutral" ghost @click=${() => this.dispatchEvent(new CustomEvent('test-ai'))} style="width:100%; margin-top:4px;">
						<wa-icon name="plug-circle-bolt" slot="prefix"></wa-icon> Test Connection
					</wa-button>
				</wa-card>

				<wa-card class="service-card">
					<div slot="header">Narrative Context</div>
					<wa-button size="small" @click=${() => this.dispatchEvent(new CustomEvent('story-memory'))} style="width:100%;">
						<wa-icon name="brain" slot="prefix"></wa-icon> Story Memory
					</wa-button>
				</wa-card>

				<wa-card class="service-card">
					<div slot="header">1. Content Cleanup</div>
					<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Remove non-story pages (Covers, TOC, Copyright).</p>
					<wa-button size="small" variant="brand" style="width:100%;" @click=${() => this.dispatchEvent(new CustomEvent('run-cleanup'))} ?disabled=${this.isProcessing || !this.hasChapters}>
						<wa-icon name="broom" slot="prefix"></wa-icon> Run Cleanup
					</wa-button>
				</wa-card>

				<wa-card class="service-card">
					<div slot="header">2. Individual Refinement</div>
					<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Refine ONLY the currently selected chapter.</p>
					<wa-button size="small" variant="brand" appearance="accent" style="width:100%;" @click=${() => this.dispatchEvent(new CustomEvent('run-single-refinement'))} ?disabled=${this.isProcessing || !this.hasSelectedChapter}>
						<wa-icon name="bullseye" slot="prefix"></wa-icon> Refine Current
					</wa-button>
				</wa-card>

				<wa-card class="service-card">
					<div slot="header">3. Full Refinement</div>
					<p style="font-size: var(--wa-font-size-xs); margin-bottom: var(--wa-space-s);">Polish all chapters using glossary and memory.</p>
					<wa-button size="small" variant="success" style="width:100%;" @click=${() => this.dispatchEvent(new CustomEvent('run-refinement'))} ?disabled=${this.isProcessing || !this.hasChapters}>
						<wa-icon name="sparkles" slot="prefix"></wa-icon> Refine All
					</wa-button>
				</wa-card>
			</div>

			<div class="sticky-footer">
				<div class="progress-text">
					<span>${this.statusMessage || 'System Idle'}</span>
					<span>
						${
              this.totalSteps > 0
                ? html`Analysed: ${this.currentStep} | Remaining: ${this.totalSteps - this.currentStep}`
                : ''
            }
					</span>
				</div>
				<wa-progress-bar value=${this.progress} ?indeterminate=${this.isProcessing && this.progress === 0}></wa-progress-bar>
				
				${
          this.isProcessing || (this.isPaused && this.currentStep > 0)
            ? html`
					<div style="display:flex; flex-direction:column; gap:4px; margin-top:8px;">
						<div style="display:flex; gap:4px;">
							<wa-button size="small" variant="warning" style="flex:1;" @click=${() => this.dispatchEvent(new CustomEvent('toggle-pause'))}>
								<wa-icon name=${this.isPaused ? 'play' : 'pause'} slot="prefix"></wa-icon>
								${this.isPaused ? 'Paused' : 'Stop'}
							</wa-button>
						</div>
						${
              this.isPaused && !this.isProcessing
                ? html`
							<div style="display:flex; gap:4px;">
								<wa-button size="small" variant="success" style="flex:1;" @click=${() => this.dispatchEvent(new CustomEvent('resume-next'))}>
									Resume Next
								</wa-button>
								<wa-button size="small" variant="brand" style="flex:1;" @click=${() => this.dispatchEvent(new CustomEvent('retry-chapter'))}>
									Retry Chapter
								</wa-button>
							</div>
						`
                : ''
            }
					</div>
				`
            : ''
        }
			</div>
		`;
  }
}
