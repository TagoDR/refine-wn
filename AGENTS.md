# AI Agent Architecture & Final Result - RefineWN

RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, etc.) using local LLMs. The result is a high-efficiency 4-column dashboard that provides a unified control center for terminology, file structure, and narrative refinement.

## The Intended Final Result

The workstation is a professional environment for raw MTL (Machine Translation) refinement:
1. **Additive File Management**: A multi-book session environment. Users can "Open" multiple EPUBs to append chapters into a single session, pruning junk content via the "Trash" system. The workstation automatically handles EPUB manifest (.opf) updates to ensure valid exports.
2. **Terminology Workstation**: A dictionary-style glossary engine supporting "One-to-Many" replacements. One refined term replaces multiple variations or regex patterns found in the MTL. Glossary state is additive, allowing merging of multiple terminology JSON files.
3. **Split-Reader & Console**: An immersive split-view experience showing Raw Source vs. Refined Prose. Real-time visibility is guaranteed for the **Process Console**, which provides a developer-grade verbose log of all AI interactions.
4. **Service Orchestration**: One-click pipelines for automated cleanup, glossary extraction, and full-book refinement with high-precision progress tracking (Analysed vs. Remaining).

---

## Agent Roles (Running via LM Studio on Port 5004)

### 1. The Glossary Architect
**Goal:** Identify entities and normalize terminology across multiple sources.
- **Workflow:** Analyzes chapters to build a "One-to-Many" dictionary mapping.
- **Output:** JSON glossary objects: `{"term": "Refined Name", "searches": ["MTL 1", "MTL 2"]}`.
- **Additive Logic:** Merges new discoveries into the existing workstation dictionary without duplicating replacement terms.

### 2. The Narrative Polisher
**Goal:** Transform MTL artifacts into high-quality prose.
- **Workflow:** Receives raw text + strictly enforced glossary context.
- **Output:** Refined English prose that adheres to the user's defined dictionary.

### 3. The Content Filter
**Goal:** Automate the "Trash" system.
- **Workflow:** Scans chapter metadata and snippets across the entire session to identify non-story content (Covers, TOCs, Author Notes).
- **Output:** IDs of chapters recommended for removal from the manifest and spine.

### 4. The Manifest Orchestrator (System logic)
**Goal:** Maintain EPUB structural integrity.
- **Logic:** Dynamically updates the `.opf` file during export to include newly appended chapters and exclude trashed ones, ensuring the resulting book is valid across all e-readers.

---

## Technical Stack
- **UI:** Lit + WebAwesome + CSS Grid (Static viewport).
- **Processing:** JSZip + Linkedom (Surgical XML/HTML manipulation).
- **Storage:** IndexedDB (`idb-keyval`) for terminology persistence.
- **AI Integration:** Local fetch calls to port **5004** (OpenAI-compatible).
