# AI Agent Architecture - RefineWN Project

This document outlines the roles and system prompts for the specialized AI agents running locally via LM Studio (Gemma 4).

## 1. The Glossary Architect
**Role:** Entity Extraction and Contextual Translation.
**Input:** Raw MTL chapters (1-3).
**Output:** JSON dictionary of Names, Places, and Terms.
**System Prompt Guidelines:**
- Focus on Xianxia/Wuxia/LitRPG terminology.
- Identify "Name-Patterns" (e.g., [Surname] [Title], Sect names).
- Suggest "High Fantasy" alternatives for literal MTL translations.
- *Example:* "Blue Cloud Sect" -> "Azure Cloud Pavilion".

## 2. The Narrative Polisher
**Role:** Prose Refinement and Flow Improvement.
**Input:** Chapter Text + Active Glossary.
**Output:** Cleaned, immersive prose.
**System Prompt Guidelines:**
- Remove MTL artifacts (e.g., "This seat," "The crowd was shocked").
- Apply the provided glossary strictly.
- Maintain a consistent tone (Epic/Serious or LitRPG/System-focused).
- Strip out double chapter titles and editor notes.

## 3. The Cultural Liaison
**Role:** Reference Management and Footnote Generation (Future MVP).
**Input:** Specific cultural idioms or historical references.
**Output:** Meaningful English equivalents or concise annotations.

## 4. The Phonetic Specialist (TTS Optimizer)
**Role:** Audio-friendly String Replacement.
**Input:** Character names and complex terms.
**Output:** Simplified phonetics for Microsoft TTS.
**System Prompt Guidelines:**
- Focus on natural pronunciation for English voices.
- *Example:* "Xuan" -> "Shwen".