# AI Agent Architecture & Final Result - RefineWN

RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, etc.) using local LLMs. The result is a high-efficiency 4-column dashboard that provides a unified control center for terminology, file structure, and narrative refinement.

## The Intended Final Result

The workstation is a professional environment for raw MTL (Machine Translation) refinement:

1. **Additive File Management**: A multi-book session environment. Users can "Open" multiple EPUBs to append chapters into a single session, pruning junk content via the "Trash" system.
2. **Terminology Workstation**: A dictionary-style glossary engine supporting "One-to-Many" replacements and Regex patterns. Glossary state is additive and can be exported/imported.
3. **Story Memory**: A narrative historian that maintains context across chapters, tracking characters, items, and plot developments to ensure consistency in long-running series.
4. **Split-Reader & Console**: An immersive split-view experience showing Raw Source vs. Refined Prose with a real-time developer-grade Process Console.
5. **Configurable AI Orchestration**: Support for any OpenAI-compatible local API (LM Studio, Ollama) with adjustable context limits and temperature.

---

## Agent Roles (Configurable via UI)

### 1. The Glossary Architect

**Goal:** Identify entities and normalize terminology across the entire book.

- **Workflow:** Analyzes chapters to build a "One-to-Many" dictionary mapping.
- **Output:** JSON glossary objects: `{"term": "Refined Name", "searches": ["MTL 1", "MTL 2"]}`.

### 2. The Narrative Polisher

**Goal:** Transform MTL artifacts into high-quality prose using Glossary and Memory.

- **Workflow:** Receives raw text + Glossary Context + Story Memory.
- **Output:** Refined English prose that adheres to the user's defined dictionary and current story state.

### 3. The Memory Historian

**Goal:** Maintain narrative continuity.

- **Workflow:** Scans newly refined chapters to update the Story Memory.
- **Output:** Updated summary of characters, skills, items, and plot progress.

### 4. The Content Filter

**Goal:** Automate the "Trash" system.

- **Workflow:** Scans chapter metadata to identify non-story content (Covers, TOCs, Ads).
- **Output:** IDs of chapters recommended for removal.

---

## Technical Stack

- **UI:** Lit + WebAwesome + CSS Grid.
- **Processing:** JSZip + Linkedom (Surgical XML/HTML manipulation).
- **Storage:** IndexedDB (`idb-keyval`) for terminology, memory, and config persistence.
- **AI Integration:** Local fetch calls to OpenAI-compatible endpoints.
- **Utilities:** Sentence-aware text splitting for context management.
