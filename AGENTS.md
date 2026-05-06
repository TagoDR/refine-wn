RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, etc.) using local LLMs. The result is a high-efficiency 5-column dashboard that provides a unified control center for terminology, character management, and narrative refinement.

## The Intended Final Result

The workstation is a professional environment for raw MTL (Machine Translation) refinement:

1. **Additive File Management**: A multi-book session environment. Users can "Open" multiple EPUBs to append chapters into a single session.
2. **Specialized Metadata Columns**:
   - **Term Glossary**: Dedicated engine for places, items, and unique techniques.
   - **Character Glossary**: Dedicated repository for people, aliases, relationships, and categories.
3. **Story Memory**: A narrative historian that maintains plot context across chapters.
4. **Intelligent Refinement**: A context-aware pipeline that relies on AI for lenient normalization (nicknames, variations) rather than rigid string replacement.
5. **Unified Portability**: A global import/export system for all project context (Glossary, Characters, Memory, PKB) located in the Services column.

---

## Agent Roles

### 1. The Story Architect (Consolidated)

**Goal:** Refine prose, normalize entities, and maintain narrative continuity in a single efficient pass.

- **Workflow:** The primary worker for refinement. In a single turn, it:
  1.  **Refines Prose:** Transforms MTL artifacts into professional English prose (XHTML format).
  2.  **Identifies Characters:** Discovers new individuals and maps them to the **Character Glossary**.
  3.  **Extracts Terms:** Identifies places, items, and techniques for the **Term Glossary**.
  4.  **Updates Memory:** Summarizes plot progress, character changes, and items/skills.
- **Logic:** Uses **LENIENT** matching. Instead of exact string replacement, it uses the glossaries as context to intelligently normalize names and terms within the flow of natural prose.
- **Context:** Operates on text chunks while referencing all project metadata.
- **Output:** A structured response with refined text, new entities, and updated memory.

### 2. The Content Filter

**Goal:** Automate the "Trash" system via Bidirectional Pruning.

- **Workflow:** Performs **Bidirectional Scans** on each imported EPUB to identify junk chapters (Covers, TOCs, ads).
- **Output:** Boolean removal decisions with rationale.

---

## Technical Architecture

- **UI:** Lit + WebAwesome + CSS Grid (5-Column Layout).
- **Processing:** JSZip + Linkedom (Surgical XML/HTML manipulation).
- **Storage:** IndexedDB (`idb-keyval`) for terminology, memory, and config persistence.
- **AI Integration:** Local fetch calls to OpenAI-compatible endpoints with **Auto-Reload** support for LM Studio.
- **Optimization:** Multi-task single-turn AI calls with context-aware lenient normalization.
- **Validation:** Real-time **Unified Diff** for prose verification and visual status tracking.
