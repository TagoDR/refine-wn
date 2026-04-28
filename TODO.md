# Task Roadmap - NovellaRefine

## Phase 1: Foundation (The Skeleton)

- [x] Clean Up Webstorm default Lit project. Update dependencies, specially typescript to above version 7. (Updated to TS 6.0.3, latest stable available).
- [x] Initialize Vite + Lit + TypeScript project.
- [x] Configure `.biome.json` for strict linting.
- [x] Implement `Layout` component using WebAwesome (Sidebar for chapters, Main area for text).
- [x] Setup `idb-keyval` for persistent storage of project settings.

## Phase 2: The EPUB Engine (I/O)

- [x] Create `EpubService` using `jszip`.
- [x] Task: Parse `META-INF/container.xml` to find the root `.opf` file.
- [x] Task: Extract Chapter list (TOC) and map to XHTML files.
- [x] Task: Build "Save to EPUB" function (reassembling the ZIP). (Implemented in a Web Worker for efficiency).

## Phase 3: The Refinement Pipeline

- [x] Implement `TextCleaner` class:
  - [x] Filter: Remove consecutive blank lines.
  - [x] Filter: Detect and strip specific editor commentary tags.
  - [x] Filter: Normalize scene dividers (`***`, `---`).
- [x] Implement `GlossaryManager`:
  - [x] Import/Export JSON functionality.
  - [x] UI for editing "Original vs Translated vs Phonetic".
- [x] Implement AI-powered "Cleanup" to remove covers, TOC, and source pages.

## Phase 4: Local AI Integration

- [x] Create `AiBridge` for LM Studio/Ollama connectivity (Port 5004).
- [x] Develop "Name Extraction" prompt to pre-fill the glossary.
- [x] Develop "Chapter Refinement" prompt with context injection.
- [x] UI: Progress bar and integrated Process Console for activity logging.

## Phase 5: Polish & UX

- [x] Add "Diff View" to compare raw MTL vs AI-refined text. (Using `wa-split-panel`).
- [x] Implement dark mode theme using WebAwesome design tokens.
- [x] Move global actions to Header for better ergonomics and accessibility.
- [x] Automatic loading of test EPUB for faster development.
- [~] Removed TTS feature to focus on core prose refinement.
- [x] Final optimization for local GPU processing via LM Studio.
