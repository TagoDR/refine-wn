# Task Roadmap - RefineWN (4-Column Layout Overhaul)

This roadmap tracks the transition from a standard sidebar layout to a specialized 4-column workstation for high-efficiency WebNovel refinement.

## Phase 6: 4-Column UI Restructure (The Workstation)

- [x] **Infrastructure: Grid Layout Implementation**
  - [x] Implement `.app-grid` CSS grid (280px | 320px | 1fr | 280px).
  - [x] Ensure full viewport height (100vh) and no global scrolling.
  - [x] Implement independent column scrolling using nested flexbox/overflow rules.
  - [x] Implement flexbox constraints for persistent console visibility.

- [x] **Column 1: File & Chapter Management**
  - [x] Create sticky header with `[Open]`, `[Close]`, and `[Save]` buttons.
  - [x] Implement additive `Open` logic (append chapters from multiple EPUBs).
  - [x] Implement `Close` functionality (clear chapters, metadata, and state).
  - [x] Implement `Save` functionality (export current session as .epub).
  - [x] Refactor Chapter List to include a "Trash" icon per chapter.
  - [x] Implement "Trash" logic (remove from current session array).
  - [x] Integrated custom SVG icons (`file-upload.svg`, `x.svg`, `device-floppy.svg`, `trash.svg`).

- [x] **Column 2: Enhanced Glossary Management**
  - [x] Create sticky header with `[Import]`, `[Export]`, `[Clear]`, and `[Add]` buttons.
  - [x] Implement dictionary-style `importJson` and `exportJson` (`{"term": ["search1", "search2"]}`).
  - [x] Implement additive import logic (merge terms and searches from multiple files).
  - [x] Update `GlossaryEntry` model to support one-to-many searches (`term` + `searches[]`).
  - [x] Implement Glossary Edit Modal (`wa-dialog`):
    - [x] Dynamic search term list (add/remove search strings/regex).
    - [x] Replacement term input.
  - [x] Render glossary list with easy access to edit/delete actions.
  - [x] Integrated custom SVG icons (`file-import.svg`, `file-export.svg`, `square-plus.svg`, `edit.svg`, `trash.svg`).

- [x] **Column 3: Reader & Console**
  - [x] Top: Implement scrollable Reader view for the selected chapter.
  - [x] Bottom: Implement fixed-height (200px) Process Console.
  - [x] Ensure "Diff View" still works within the Reader section.
  - [x] Integrated custom SVG icon (`list-search.svg`).

- [x] **Column 4: Service Orchestration & Progress**
  - [x] List available services (Cleanup, Glossary Extraction, Refinement).
  - [x] Implement "Service Action" buttons with clear descriptions.
  - [x] Create sticky footer for the global progress bar.
  - [x] Update progress bar to show `Analysed: X | Remaining: Y` chapters.

## Phase 7: Service Logic Updates

- [x] **Refinement Pipeline Integration**
  - [x] Update `AiBridge` to utilize the new one-to-many glossary structure.
  - [x] Updated AI prompts to handle the new `term` and `searches` schema.
  - [x] Optimize the "Trash" system in `EpubService` to update manifest/spine during save.
  - [x] Support dynamic manifest additions for appended chapters.

## Phase 8: Final Validation

- [ ] **Cross-Browser testing** (Chrome/Edge/Firefox).
- [ ] **Large File performance** (Testing with 100+ chapters).
- [ ] **Memory Management** (Ensuring Blob/URL objects are revoked).
- [ ] **Glossary Regex validation** (Preventing infinite loops or catastrophic backtracking).
