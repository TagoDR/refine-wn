# RefineWN

RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, LitWeb, etc.) using local Large Language Models (LLMs). It provides a professional, unified dashboard for managing terminology, narrative consistency, and prose quality.

## Features

- **Multi-EPUB Session**: Open and append multiple EPUBs into a single working session.
- **5-Column Workstation**: A specialized layout for maximum efficiency:
  - **Chapters**: Manage file structure and track processing status.
  - **Glossary**: Dedicated management for places, items, and techniques.
  - **Characters**: A structured metadata repository for people, aliases, and relationships.
  - **Reader**: Immersive view with Unified Diff highlighting.
  - **Services**: Control center for AI configuration, portability, and process execution.
- **Advanced Glossary**: Dictionary-style terminology management with support for Regex patterns.
- **Character Glossary**: Structured metadata for characters, including aliases, relationships, and categories (Main, Supporting, etc.).
- **Narrative Memory**: AI-driven "Story Memory" that tracks plot progress across chapters to ensure continuity.
- **Optimized Refinement**: High-efficiency consolidated AI pass that refines prose, identifies characters, and updates story memory in a single turn.
- **Unified Diff View**: Clear, color-coded comparison of prose changes (Additions vs. Deletions) with HTML tags hidden for readability.
- **Visual Progress Tracking**: Real-time status indicators (Spinner/Checkmark) in the chapter list to monitor refinement progress.
- **Background Glossary Tidier**: A concurrent background worker that reviews, merges, and tidies terminology and characters without interrupting refinement.
- **AI Auto-Reload**: Support for LM Studio's Model Management API to automatically reload models if they are unloaded during long sessions.
- **Local AI Integration**: Compatible with any OpenAI-compliant API (LM Studio, Ollama, etc.).
- **Process Console**: Real-time logging of all AI interactions and system processes.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A local LLM server (e.g., [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.com/)) running an OpenAI-compatible API.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/refine-wn.git
   cd refine-wn
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`.

### Configuration

1. In the **SERVICES** column (right side), click on **Configure AI**.
2. Set your **Endpoint URL** (default: `http://localhost:5004/v1/chat/completions` for LM Studio).
3. Specify the **Model Name** as it appears in your local provider.
4. Set the **Max Context** (tokens) according to your model's capabilities (e.g., 8192).
5. Click **Test Connection** to verify settings.

## Workflow

1. **Import**: Open one or more EPUB files. Source tracking ensures books are managed correctly.
2. **Cleanup**: Run **Content Cleanup** to prune covers and TOCs from the beginning and end of each EPUB.
3. **Setup Context**:
   - **Knowledge Base**: Define your style guide and world-building rules.
   - **Character Glossary**: Add main characters with their metadata.
   - **Glossary**: Manually add or extract terminology.
4. **Refinement**:
   - Run **Refine All**.
   - **Stop** at any time to fix hallucinations.
   - Edit **Story Memory** or **Character Glossary** to provide the AI with missing plot context.
   - Click **Retry Chapter** to re-process with the corrected facts.
5. **Portability**: Click **Export** in the Glossary column to save your entire project context to a single JSON file for later use.
6. **Export**: Click **Save** in the Chapter column to generate the refined EPUB(s).

## Documentation

- [AI Agent Architecture](./AGENTS.md)
- [Engineering Specification](./SPECS.md)
- [Project Roadmap](./TODO.md)

## License

MIT
