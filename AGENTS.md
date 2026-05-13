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
- **Robust Execution:**
  - **Retry Mechanism:** Automatically retries failed AI calls (up to 3 times) with exponential backoff to handle temporary server outages.
  - **Content Normalization:** Automatically extracts and repairs body content, ensuring working files and final EPUBs are consistently formatted regardless of AI output variations.
  - **Verified Resume:** Verifies the integrity of intermediate working files before skipping chapters during a resume, ensuring no data is lost.
- **Logic:** Uses **LENIENT** matching. Instead of exact string replacement, it uses the glossaries as context to intelligently normalize names and terms within the flow of natural prose.
- **Context:** Operates on text chunks while referencing all project metadata.
- **Output:** A structured response with refined text, new entities, and updated memory.

### 2. The Content Filter

**Goal:** Automate the "Trash" system via Bidirectional Pruning.

- **Workflow:** Performs **Bidirectional Scans** on each imported EPUB to identify junk chapters (Covers, TOCs, ads).
- **Sequential Story Discovery:** Scans sequentially from both the beginning and end of the file until the first/last piece of actual story text is found.
- **Persistent Cache:** Results are immediately persisted to `settings.json`, ensuring the cleanup phase is only run once per chapter even if the process is interrupted.
- **Output:** Boolean removal decisions with rationale. JSON-based decision engine with heuristic pre-filtering for empty chapters.

### 3. The Glossary Tidier (Background Worker)

**Goal:** Maintain the integrity and organization of project metadata concurrently.

- **Workflow:** Runs in the background (concurrently with refinement) or as part of the **CLI Bootstrap** process. It:
  1.  **Deduplicates:** Identifies and merges redundant terms or characters.
  2.  **Reorganizes:** Moves misplaced people from the Term Glossary to the Character Glossary.
  3.  **Standardizes:** Updates entities to match the Project Knowledge Base.
- **Concurrency:** Designed to use a second AI processing slot, ensuring refinement remains uninterrupted while metadata is polished.

### 4. The Project Historian (Bootstrapper)

**Goal:** Rapidly initialize narrative context from a full-length previous volume.

- **Workflow:** Analyzes a provided EPUB in high-volume chunks (up to 32k context). Available via the **Workstation UI** or the **Standalone CLI Script**. It:
  1.  **Bootstraps Lore:** Identifies characters, unique terms, and world rules from the previous volume.
  2.  **Summarizes State:** Provides a "State of the World" summary for the Story Memory.
- **Efficiency:** Bypasses individual chapter processing by analyzing the book as a continuous text pool, allowing for a complete context build in minutes rather than hours.

---

## Technical Architecture

- **UI:** Lit + WebAwesome + CSS Grid (5-Column Layout).
- **CLI:** Node.js script using `tsx` for high-performance batch context analysis.
- **Processing:** JSZip + Linkedom (Surgical XML/HTML manipulation).
- **Storage:** IndexedDB (`idb-keyval`) for terminology, memory, and config persistence.
- **AI Integration:** Local fetch calls with support for **2+ Concurrent Requests**, **Auto-Reload** for LM Studio, and **High-Volume Context Analysis** (32k+).
- **Optimization:** Multi-task single-turn AI calls with background metadata management.
- **Validation:** Real-time **Unified Diff** for prose verification and visual status tracking.
