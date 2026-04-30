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
  - Use `idb-keyval` for persistent settings and AI result caching.
- **Web Workers:** All CPU-intensive tasks (EPUB parsing/compression) run in a Worker.
- **CSS:** Use WebAwesome tokens (`--wa-color-surface-*`, etc.) to ensure dark mode compatibility.

## 3. Local AI Integration (LM Studio)

- **Transport:** Standard `fetch` to `http://localhost:5004/v1/chat/completions` (OpenAI format) with fallback to `/v1/responses`.
- **Error Handling:** Robust retry logic for "Server Busy".
- **Logging:** Integrated Process Console in the UI for real-time tracking of AI requests and errors.
- **Features:**
  - **Glossary-aware prose refinement:** Context-sensitive terminology replacement.
  - **Per-EPUB Bidirectional Cleanup:** Prunes junk chapters (Covers, TOC, etc.) from start and end of each book until the first valid story prose is identified.
  - **Interactive Refinement Flow:** Pause-able processing with "Resume Next" and "Retry Chapter" (with updated memory) capabilities.
  - **Live Narrative Context:** AI-driven "Story Memory" that updates in real-time and allows manual editing when paused.
  - **Name and entity extraction:** Automated glossary building from chapter snippets.
