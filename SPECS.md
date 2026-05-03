# Engineering Specification & Coding Standards

## 1. Tech Stack Standards

- **Runtime:** Browser / Vite (Local-first).
- **Language:** TypeScript 5.x (Strict mode enabled).
- **UI Architecture:**
  - Lit (Web Components).
  - Modular Column-based Components:
    - `ChapterColumn`: File/Chapter management.
    - `GlossaryColumn`: Terminology management.
    - `ReaderColumn`: Content display and Process Console.
    - `ServiceColumn`: Global orchestration and progress.
  - WebAwesome for standardized UI patterns (Theming with design tokens).
  - Reactive properties for component state.
- **Linting/Formatting:**
  - **Biome** is the primary source of truth for formatting and linting.

## 2. Coding Practices

- **Functional Core, Imperative Shell:** Keep parsing logic (EPUB/Text) pure and decoupled from Lit components.
- **Maintenance First:**
  - Use `idb-keyval` for persistent settings, story memory, and terminology.
  - `BatchRefinementService`: Centralized orchestrator for the refinement pipeline, handling text cleaning, sequential chunking, and state synchronization.
- **Web Workers:** All CPU-intensive tasks (EPUB parsing/compression) run in a Worker to maintain UI responsiveness.
- **CSS:** Use WebAwesome tokens (`--wa-color-surface-*`, etc.) for robust dark mode support.

## 3. Local AI Integration (LM Studio)

- **Transport:** Standard `fetch` to OpenAI-compatible endpoints.
- **Dynamic Context**: Sequential processing of chapter chunks allows updating the Story Memory and Glossary *mid-chapter*, ensuring the AI learns from the beginning of a chapter before processing the end.
- **Safety & Control:**
  - Automatic pausing on AI errors or manual context updates.
  - "Discard" functionality to revert chapters to original MTL.
  - Strict Glossary Validation: Redundant or empty entries are discarded.
- **Logging:** Autoscrolling Process Console for real-time developer-grade tracking.

## 4. Asset Management (Images)

- **Extraction**: `EpubService` identifies and extracts all binary assets (images, fonts, styles) from the EPUB container.
- **Live Serving**: Temporary **Object URLs** are generated for assets during a session, allowing images to render correctly in the reader.
- **Path Resolution**: Internal EPUB paths (e.g., `../images/cover.jpg`) are mapped to Object URLs on import and **restored to internal paths** on export.
- **Persistence**: Refined EPUBs maintain the original folder structure and all non-text assets from the source file.
