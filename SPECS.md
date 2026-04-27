# Engineering Specification & Coding Standards

## 1. Tech Stack Standards
- **Runtime:** Browser / Vite (Local-first).
- **Language:** TypeScript 5.x (Strict mode enabled).
- **UI Architecture:** - Lit (Web Components).
  - WebAwesome for standardized UI patterns.
  - Reactive Controllers for state logic with nanostores
- **Linting/Formatting:** - **Biome** is the primary source of truth for formatting and linting.
  - **Prettier** used only as a fallback for files unsupported by Biome.

## 2. Coding Practices
- **Functional Core, Imperative Shell:** Keep parsing logic (EPUB/Text) pure and decoupled from Lit components.
- **Maintenance First:** - Every regex filter must be documented with a comment and a test case.
  - Use `Zod` or similar for runtime validation of EPUB manifests and JSON dictionaries.
- **Web Workers:** All CPU-intensive tasks (EPUB compression, heavy string replacement) must run in a Worker.
- **CSS:** Use Constructable Stylesheets within Lit elements; keep global styles to a minimum.

## 3. Local AI Integration (Gemma 4 / LM Studio)
- **Transport:** Standard `fetch` to `http://localhost:1234/v1/chat/completions`.
- **Error Handling:** Implement robust retry logic for "Server Busy" or "Context Length Exceeded" errors.
- **Caching:** Store processed chapter results in `IndexedDB` to avoid redundant AI calls.