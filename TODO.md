# RefineWN - Project Knowledge Base & Character Glossary

## Current Tasks
- [x] Implement Character Glossary System
    - [x] Define `Character` types in `src/types.ts`
    - [x] Create `src/services/character-service.ts`
    - [x] Add Character UI section in `src/components/glossary-column.ts`
    - [x] Implement Character Edit Dialog in `src/app-root.ts`
- [x] Implement Project Knowledge Base (PKB)
    - [x] Create `src/services/knowledge-base.ts` with default MTL template
    - [x] Implement PKB Edit Dialog in `src/app-root.ts`
- [x] Implement Unified Portability Module
    - [x] Create `src/services/portability-service.ts` (Global Export/Import)
    - [x] Implement auto-load test settings for DEV mode
- [x] AI Integration
    - [x] Update `src/instructions/narrative-polisher.md` with `{{knowledge_base}}` and `{{characters}}`
    - [x] Update `AiBridge` to inject new context variables
    - [x] Update `BatchRefinementService` to fetch and pass new context

## Completed
- [x] Initial 4-column workstation setup
- [x] Multi-EPUB import and additive chapter management
- [x] Basic Glossary engine with Regex support
- [x] Story Memory (Narrative Historian)
- [x] Batch and Single chapter refinement
- [x] Content Cleanup (Bidirectional Pruning)
- [x] Character Glossary metadata and management
- [x] Global project import/export
