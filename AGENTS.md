# AI Agent Architecture & Final Result - RefineWN

RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, etc.) using local LLMs. The intended final result is a high-efficiency 4-column dashboard that puts all tools (File Management, Glossary Control, Reading, and Service Status) in a single, static view.

## The Intended Final Result

The workstation provides a professional interface for raw MTL (Machine Translation) refinement:
1. **File Management**: Direct control over the EPUB structure, allowing users to prune junk chapters and export polished results instantly.
2. **Dynamic Glossary**: A one-to-many replacement engine where one refined term replaces multiple variations or regex patterns found in the MTL.
3. **Immersive Reader**: A split-view reading experience that shows the raw source vs. the refined prose side-by-side.
4. **Process Console**: A developer-grade log of all AI interactions and service status.
5. **Service Orchestration**: One-click pipelines for automated cleanup, glossary extraction, and full-book refinement.

---

## Agent Roles (Running via LM Studio on Port 5004)

### 1. The Glossary Architect
**Goal:** Identify entities and normalize terminology.
- **Workflow:** Analyzes early chapters to build a "One-to-Many" mapping.
- **Output:** JSON glossary entries where one `term` maps to multiple `searches` (e.g., "Great Elder" replaces ["Elder Wang", "Senior Wang", "Wang the Old"]).

### 2. The Narrative Polisher
**Goal:** Transform MTL artifacts into high-quality prose.
- **Workflow:** Receives raw text + Glossary context.
- **Output:** Flowing English prose that respects the user's defined terminology strictly.

### 3. The Content Filter
**Goal:** Automate the "Trash" system.
- **Workflow:** Scans chapter metadata and snippets to identify non-story content.
- **Output:** IDs of chapters that should be excluded from the final export.

### 4. The Phonetic Specialist
**Goal:** Optimize for future TTS (Text-to-Speech) integration.
- **Workflow:** Generates phonetic hints for translated names.
- **Output:** Simplified spellings (e.g., "Xuan" -> "Shwen") stored within the glossary.

---

## Technical Stack
- **UI:** Lit + WebAwesome + CSS Grid.
- **Processing:** JSZip + Linkedom (for EPUB manipulation).
- **Storage:** IndexedDB (`idb-keyval`) for local persistence.
- **AI Integration:** Local fetch calls to OpenAI-compatible endpoints (LM Studio).
