import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { DOMParser } from 'linkedom';
import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { glob } from 'glob';

/**
 * CLI Bootstrap Script for RefineWN
 * Processes all EPUBs in a folder to build narrative context.
 */

const __dropdown = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dropdown, '..');

// --- Configuration ---
const CONFIG_PATH = path.join(ROOT_DIR, 'src/config.json');
const INSTRUCTIONS_DIR = path.join(ROOT_DIR, 'src/instructions');

async function main() {
  console.log(chalk.bold.cyan('\n🚀 RefineWN CLI Bootstrap Tool\n'));

  // 1. Resolve Data Directory
  let dataDir = path.join(ROOT_DIR, 'dist/data');
  try {
    await fs.stat(dataDir);
    const files = await fs.readdir(dataDir);
    if (files.length === 0) throw new Error('Empty');
  } catch {
    dataDir = path.join(ROOT_DIR, 'public/data');
    await fs.mkdir(dataDir, { recursive: true });
  }

  console.log(chalk.gray(`Target directory: ${dataDir}`));

  // 2. Load AI Config
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
  const aiEndpoint = config.ai.endpoint;
  const aiModel = config.ai.model;
  // const maxContext = config.ai.maxContext || 32768;

  // 3. Load Instructions
  const historianPrompt = await fs.readFile(path.join(INSTRUCTIONS_DIR, 'previous-volume-analyzer.md'), 'utf-8');
  const tidierPrompt = await fs.readFile(path.join(INSTRUCTIONS_DIR, 'glossary-tidier.md'), 'utf-8');

  // 4. Load/Init Settings
  const settingsPath = path.join(dataDir, 'bootstrapped_settings.json');
  let projectState = {
    glossary: [],
    characters: [],
    memory: '',
    knowledgeBase: ''
  };

  try {
    const existing = await fs.readFile(settingsPath, 'utf-8');
    projectState = JSON.parse(existing);
    console.log(chalk.yellow(`Updating existing context: ${projectState.glossary.length} terms, ${projectState.characters.length} characters.`));
  } catch {
    console.log(chalk.green('Initializing new context.'));
  }

  // 5. Scan EPUBs
  const epubs = (await glob('*.epub', {cwd: dataDir, absolute: true})).sort((a, b) => a.localeCompare(b));
  if (epubs.length === 0) {
    console.log(chalk.red('\nNo EPUB files found in data folder. Exiting.'));
    return;
  }

  console.log(chalk.white(`Found ${epubs.length} books to process.\n`));

  const multiBar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: chalk.cyan('{bar}') + ' {percentage}% | {value}/{total} Chunks | {eta_formatted} rem | {filename}',
  }, cliProgress.Presets.shades_grey);

  const startTime = Date.now();

  for (const epubPath of epubs) {
    const filename = path.basename(epubPath);
    console.log(chalk.bold(`\n📖 Processing: ${filename}`));
    
    // Parse EPUB
    const buffer = await fs.readFile(epubPath);
    const zip = await JSZip.loadAsync(buffer);
    
    // Find all XHTML/HTML files
    const contentFiles = Object.keys(zip.files).filter(f => f.endsWith('.xhtml') || f.endsWith('.html'));
    let fullText = '';
    
    for (const f of contentFiles) {
      const html = await zip.file(f)!.async('string');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      fullText += (doc.body.textContent || '') + '\n\n---\n\n';
    }

    // Chunk size: ~25,000 tokens (approx 100k chars for 32k context)
    const CHUNK_SIZE = 80000;
    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
      chunks.push(fullText.substring(i, i + CHUNK_SIZE));
    }

    const progressBar = multiBar.create(chunks.length, 0, { filename });

    for (let i = 0; i < chunks.length; i++) {
      const response = await callAi(chunks[i], historianPrompt, aiEndpoint, aiModel);
      const data = parseJsonResponse(response);

      if (data) {
        mergeCharacters(projectState.characters, data.characters || []);
        mergeTerms(projectState.glossary, data.terms || []);
        if (data.knowledgeBase) projectState.knowledgeBase += `\n\n--- ${filename} (pt ${i+1}) ---\n${data.knowledgeBase}`;
        if (data.storyMemory) projectState.memory = data.storyMemory;
      }
      
      progressBar.increment();
    }

    // Tidy after each book
    console.log(chalk.gray(`\n🧹 Tidying glossary for ${filename}...`));
    const tidyResponse = await callAi(
      JSON.stringify({ 
        glossary: projectState.glossary, 
        characters: projectState.characters,
        knowledgeBase: projectState.knowledgeBase 
      }), 
      tidierPrompt, 
      aiEndpoint, 
      aiModel
    );
    const tidyData = parseJsonResponse(tidyResponse);
    if (tidyData) {
       applyTidyResult(projectState, tidyData);
    }

    // Incremental save
    await fs.writeFile(settingsPath, JSON.stringify(projectState, null, 2));
    
    console.log(chalk.dim(`Status: ${projectState.glossary.length} Terms | ${projectState.characters.length} Characters`));
  }

  multiBar.stop();
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(chalk.bold.green(`\n✅ Done! Total processing time: ${elapsed}m`));
  console.log(chalk.cyan(`Settings saved to: ${settingsPath}\n`));
}

async function callAi(prompt: string, system: string, endpoint: string, model: string) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as any;
    return data.choices[0].message.content;
  } catch (err) {
    console.error(chalk.red(`\nAI Call failed: ${err}`));
    return '{}';
  }
}

function parseJsonResponse(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    return null;
  }
  return null;
}

function mergeCharacters(existing: any[], news: any[]) {
  for (const n of news) {
    const name = (n.name || n.term || '').trim();
    if (!name) continue;
    const found = existing.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
    if (found) {
      const aliases = new Set([...(found.aliases || []), ...(n.aliases || n.searches || [])]);
      found.aliases = Array.from(aliases).filter(a => a.toLowerCase() !== found.name.toLowerCase());
    } else {
      existing.push({
        id: crypto.randomUUID(),
        name,
        aliases: (n.aliases || n.searches || []).filter((s: string) => s.toLowerCase() !== name.toLowerCase()),
        category: n.category || 'Supporting',
        gender: n.gender || '',
        affiliation: n.affiliation || '',
        relationships: n.relationships || ''
      });
    }
  }
}

function mergeTerms(existing: any[], news: any[]) {
  for (const n of news) {
    const term = (n.term || '').trim();
    if (!term || n.category === 'Name') continue;
    const found = existing.find(e => (e.term || '').toLowerCase() === term.toLowerCase());
    if (found) {
      const searches = new Set([...(found.searches || []), ...(n.searches || [])]);
      found.searches = Array.from(searches).filter(s => s.toLowerCase() !== term.toLowerCase());
    } else {
      existing.push({
        id: crypto.randomUUID(),
        term,
        searches: (n.searches || []).filter((s: string) => s.toLowerCase() !== term.toLowerCase()),
        category: n.category || 'Other'
      });
    }
  }
}

function applyTidyResult(state: any, result: any) {
  // 1. Moved to Characters
  if (result.movedToCharacters) {
    for (const move of result.movedToCharacters) {
      state.characters.push({ id: crypto.randomUUID(), ...move.suggestedCharacter });
      state.glossary = state.glossary.filter((e: any) => e.id !== move.termId);
    }
  }
  // 2. Merged Terms
  if (result.mergedTerms) {
    for (const merge of result.mergedTerms) {
      state.glossary.push({ id: crypto.randomUUID(), ...merge.finalEntry });
      const ids = new Set(merge.idsToMerge);
      state.glossary = state.glossary.filter((e: any) => !ids.has(e.id));
    }
  }
  // 3. Merged Characters
  if (result.mergedCharacters) {
    for (const merge of result.mergedCharacters) {
      state.characters.push({ id: crypto.randomUUID(), ...merge.finalCharacter });
      const ids = new Set(merge.idsToMerge);
      state.characters = state.characters.filter((e: any) => !ids.has(e.id));
    }
  }
  // 4. Deleted
  if (result.deletedIds) {
    const ids = new Set(result.deletedIds);
    state.glossary = state.glossary.filter((e: any) => !ids.has(e.id));
    state.characters = state.characters.filter((e: any) => !ids.has(e.id));
  }
}

main().catch(err => {
  console.error(chalk.red('\nFatal Error:'), err);
  process.exit(1);
});
