# Task Roadmap - RefineWN (4-Column Layout Overhaul)

This roadmap tracks the transition from a standard sidebar layout to a specialized 4-column workstation for high-efficiency WebNovel refinement.

## Phase 6: 4-Column UI Restructure (The Workstation)

- [ ] **Infrastructure: Grid Layout Implementation**
  - [ ] Implement `.app-grid` CSS grid (250px | 300px | 1fr | 250px).
  - [ ] Ensure full viewport height (100vh) and no global scrolling.
  - [ ] Implement responsive column resizing or fixed widths as per plan.

- [ ] **Column 1: File & Chapter Management**
  - [ ] Create sticky header with `[Open]`, `[Close]`, and `[Save]` buttons.
  - [ ] Implement `Close` functionality (clear chapters, metadata, and state).
  - [ ] Implement `Save` functionality (export current session as .epub).
  - [ ] Refactor Chapter List to include a "Trash" icon per chapter.
  - [ ] Implement "Trash" logic (remove from current session array).

- [ ] **Column 2: Enhanced Glossary Management**
  - [ ] Create sticky header with `[Import]`, `[Export]`, and `[Add]` buttons.
  - [ ] Implement `importTxt` and `exportTxt` (JSON structure wrapped in .txt).
  - [ ] Update `GlossaryEntry` model to support one-to-many searches (`term` + `searches[]`).
  - [ ] Implement Glossary Edit Modal (`wa-dialog`):
    - [ ] Dynamic search term list (add/remove search strings/regex).
    - [ ] Replacement term input.
  - [ ] Render glossary list with easy access to edit/delete actions.

- [ ] **Column 3: Reader & Console**
  - [ ] Top: Implement scrollable Reader view for the selected chapter.
  - [ ] Bottom: Implement fixed-height (or resizable) Process Console.
  - [ ] Ensure "Diff View" still works within the Reader section.

- [ ] **Column 4: Service Orchestration & Progress**
  - [ ] List available services (Cleanup, Glossary Extraction, Refinement).
  - [ ] Implement "Service Action" buttons with clear descriptions.
  - [ ] Create sticky footer for the global progress bar.
  - [ ] Update progress bar to show `Analyzed: X / Total: Y` chapters.

## Phase 7: Service Logic Updates

- [ ] **Refinement Pipeline Integration**
  - [ ] Update `AiBridge` to utilize the new one-to-many glossary structure.
  - [ ] Ensure Regex-based replacement logic is integrated into the prompt or pre-processing.
  - [ ] Optimize the "Trash" system to ensure excluded chapters are not processed or saved.

## Phase 8: Final Validation

- [ ] **Cross-Browser testing** (Chrome/Edge/Firefox).
- [ ] **Large File performance** (Testing with 100+ chapters).
- [ ] **Memory Management** (Ensuring Blob/URL objects are revoked).
- [ ] **Glossary Regex validation** (Preventing infinite loops or catastrophic backtracking).
