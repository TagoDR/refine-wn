# Engineering Specification & Coding Standards

## 1. Tech Stack Standards
- **Runtime:** Browser / Vite (Local-first).
- **Language:** TypeScript 5.x (Strict mode enabled).
- **UI Architecture:** 
  - Lit (Web Components).
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
  - Glossary-aware prose refinement.
  - Automated junk chapter identification and cleanup.
  - Name and entity extraction for glossary building.
