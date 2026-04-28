# AI Agent Architecture - RefineWN Project

This document outlines the roles and system prompts for the specialized AI agents running locally via LM Studio (Gemma 4). All agents communicate over port **5004**.

## 1. The Glossary Architect

**Role:** Entity Extraction and Contextual Translation.
**Implementation:** `AiBridge.extractNames()`
**Input:** Raw MTL text (first 4000 chars).
**Output:** JSON array of objects `{"original": "...", "translated": "...", "category": "...", "phonetic": "..."}`.
**Core Mandate:**

- Focus on Xianxia/Wuxia/LitRPG terminology.
- Identify "Name-Patterns" (e.g., [Surname] [Title], Sect names).
- Suggest "High Fantasy" alternatives for literal MTL translations.

## 2. The Narrative Polisher

**Role:** Prose Refinement and Flow Improvement.
**Implementation:** `AiBridge.refineChapter()`
**Input:** Chapter Text + JSON Glossary Context.
**Output:** Refined chapter prose.
**Core Mandate:**

- Remove MTL artifacts (e.g., "This seat," "The crowd was shocked").
- Apply the provided glossary STRICTLY.
- Maintain a consistent tone (Epic/Serious or LitRPG/System-focused).
- Strip out double chapter titles and editor notes.

## 3. The Content Filter

**Role:** Automated EPUB Cleanup.
**Implementation:** `AiBridge.identifyJunkChapters()`
**Input:** List of Chapter IDs, Titles, and Snippets.
**Output:** JSON array of IDs to be removed.
**Core Mandate:**

- Identify Covers, Table of Contents, Copyright pages, Forewords, Afterwords, Source/Site advertisements, or non-story Author notes.

## 4. The Phonetic Specialist

**Role:** Audio-friendly String Generation for Glossary.
**Implementation:** Integrated into `AiBridge.extractNames()`
**Input:** Translated names and complex terms.
**Output:** Phonetic hints for the `phonetic` field in the glossary.
**Core Mandate:**

- Provide simplified phonetics to ensure external TTS engines (like browser extensions or screen readers) pronounce specialized fantasy names correctly.
- _Example:_ "Xuan" -> "Shwen", "Qi" -> "Chee".

## 5. The Cultural Liaison (Planned)

**Role:** Reference Management and Footnote Generation.
**Input:** Specific cultural idioms or historical references.
**Output:** Meaningful English equivalents or concise annotations.
