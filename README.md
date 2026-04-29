# RefineWN

RefineWN is a specialized local workstation designed for translating and polishing WebNovels (Xianxia, LitRPG, LitWeb, etc.) using local Large Language Models (LLMs). It provides a professional, unified dashboard for managing terminology, narrative consistency, and prose quality.

## Features

- **Multi-EPUB Session**: Open and append multiple EPUBs into a single working session.
- **Advanced Glossary**: Dictionary-style terminology management with support for Regex patterns and "One-to-Many" replacements.
- **Narrative Memory**: AI-driven "Story Memory" that tracks characters, items, and plot points across chapters to ensure continuity.
- **Surgical Refinement**: Refine the entire book or individual chapters with glossary-aware and memory-aware AI pipelines.
- **Split-View Reader**: Compare raw MTL source with refined prose side-by-side.
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

1. **Import**: Open one or more EPUB files.
2. **Cleanup**: Run the **Content Cleanup** service to automatically remove non-story chapters (Covers, TOCs, etc.).
3. **Glossary**: Run **Glossary Extraction** to identify main terms or manually add your own in the **GLOSSARY** column.
4. **Refine**: Use **Refine All** to process the entire book. The AI will apply the glossary and update the **Story Memory** as it progresses.
5. **Export**: Once satisfied, click **Save** in the **CHAPTERS** column to generate a new, refined EPUB.

## Documentation

- [AI Agent Architecture](./AGENTS.md)
- [Engineering Specification](./SPECS.md)
- [Project Roadmap](./TODO.md)

## License

MIT
