# AI Agent Architecture & Final Result - RefineWN

RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, etc.) using local LLMs. The result is a high-efficiency 4-column dashboard that provides a unified control center for terminology, file structure, and narrative refinement.

## The Intended Final Result

The workstation is a professional environment for raw MTL (Machine Translation) refinement:

1. **Additive File Management**: A multi-book session environment. Users can "Open" multiple EPUBs to append chapters into a single session, pruning junk content via the "Trash" system.
2. **Terminology Workstation**: A dictionary-style glossary engine supporting "One-to-Many" replacements and Regex patterns. Glossary state is additive and can be exported/imported.
3. **Structured Metadata**: A dedicated **Character Glossary** for tracking aliases, relationships, and categories, alongside a **Project Knowledge Base** for world-building and style guides.
4. **Story Memory**: A narrative historian that maintains plot context across chapters to ensure consistency in long-running series.
5. **Split-Reader & Console**: An immersive split-view experience showing Raw Source vs. Refined Prose with a real-time developer-grade Process Console.
6. **Unified Portability**: A global import/export system for all project context (Glossary, Characters, Memory, PKB).
7. **Configurable AI Orchestration**: Support for any OpenAI-compatible local API (LM Studio, Ollama) with adjustable context limits and temperature.

---

## Agent Roles

### 1. The Story Architect (Consolidated)

**Goal:** Refine prose, normalize terminology, and maintain narrative continuity in a single efficient pass.

- **Workflow:** The primary worker for refinement. In a single turn, it:
  1.  **Refines Prose:** Transforms MTL artifacts into professional English prose (XHTML format).
  2.  **Extracts Terms:** Identifies new entities and suggests standardized names for the glossary.
  3.  **Updates Memory:** Summarizes plot progress, character changes, and items/skills.
- **Context:** Operates on text chunks (splitting large chapters) while referencing the full Glossary, Character Metadata, Project Knowledge Base, and the evolving Story Memory.
- **Output:** A structured response containing the refined text, a list of new glossary terms, and the updated story memory.

### 2. The Content Filter

**Goal:** Automate the "Trash" system via Bidirectional Pruning.

- **Workflow:** Performs **Bidirectional Scans** (Forward from start, Backward from end) on each imported EPUB.
- **Decision Engine:** Analyzes titles and content snippets to identify junk chapters (Covers, TOCs, ads).
- **Output:** Boolean removal decisions with rationale, enabling automatic pruning until valid story content is reached.

---

## Technical Architecture

- **UI:** Lit + WebAwesome + CSS Grid.
- **Processing:** JSZip + Linkedom (Surgical XML/HTML manipulation).
- **Storage:** IndexedDB (`idb-keyval`) for terminology, memory, and config persistence.
- **AI Integration:** Local fetch calls to OpenAI-compatible endpoints with **Auto-Reload** support for LM Studio.
- **Optimization:** Multi-task single-turn AI calls to minimize latency and context-switching overhead.
- **Validation:** Real-time **Unified Diff** for prose verification and visual status tracking in the chapter list.
