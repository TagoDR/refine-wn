# Task Roadmap - NovellaRefine

## Phase 1: Foundation (The Skeleton)
- [ ] Clean Up Webstorm default Lit project. Update dependencies, specially typescipt to latest.
- [ ] Initialize Vite + Lit + TypeScript project.
- [ ] Configure `.biome.json` for strict linting.
- [ ] Implement `Layout` component using WebAwesome (Sidebar for chapters, Main area for text).
- [ ] Setup `idb-keyval` for persistent storage of project settings.

## Phase 2: The EPUB Engine (I/O)
- [ ] Create `EpubService` using `jszip`.
- [ ] Task: Parse `META-INF/container.xml` to find the root `.opf` file.
- [ ] Task: Extract Chapter list (TOC) and map to XHTML files.
- [ ] Task: Build "Save to EPUB" function (reassembling the ZIP).

## Phase 3: The Refinement Pipeline
- [ ] Implement `TextCleaner` class:
    - [ ] Filter: Remove consecutive blank lines.
    - [ ] Filter: Detect and strip specific editor commentary tags.
    - [ ] Filter: Normalize scene dividers (`***`, `---`).
- [ ] Implement `GlossaryManager`:
    - [ ] Import/Export JSON functionality.
    - [ ] UI for editing "Original vs Translated vs Phonetic".

## Phase 4: Local AI Integration
- [ ] Create `AiBridge` for LM Studio/Ollama connectivity.
- [ ] Develop "Name Extraction" prompt to pre-fill the glossary.
- [ ] Develop "Chapter Refinement" prompt with context injection.
- [ ] UI: Progress bar for batch processing chapters.

## Phase 5: Polish & TTS
- [ ] Implement "TTS Preview" button using the browser's SpeechSynthesis API.
- [ ] Add "Diff View" to compare raw MTL vs AI-refined text.
- [ ] Final optimization for RDNA 4 / local GPU processing.