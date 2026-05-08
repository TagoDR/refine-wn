import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from 'linkedom';
import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import { glob } from 'glob';
import { loadConfig, resolveDataPath, getWriteableDataPath, ensureDir } from './utils.js';

/**
 * CLI Orchestrator for Batch EPUB Refinement
 * Automates the RefineWN workflow: Cleanup -> Refine -> Tidy -> Export.
 */

async function main() {
  console.log(chalk.bold.magenta('\n✨ RefineWN Batch Orchestrator\n'));

  // 1. Load Config
  const config = await loadConfig();
  const aiConfig = config.ai;
  const refineConfig = config.refine;
  const bootstrapConfig = config.bootstrap;

  // 2. Resolve Paths
  const inputDir = await resolveDataPath(refineConfig.inputDir);
  const outputDir = await getWriteableDataPath(refineConfig.outputDir);
  const settingsPath = await getWriteableDataPath(refineConfig.settingsFile);
  const bootstrapPath = await resolveDataPath(bootstrapConfig.settingsFile);
  const instructionsDir = await ensureDir(refineConfig.instructionsDir);

  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  console.log(chalk.gray(`Input:    ${inputDir}`));
  console.log(chalk.gray(`Output:   ${outputDir}`));
  console.log(chalk.gray(`Settings: ${settingsPath}`));

  // 3. Load/Init State
  let projectState = {
    glossary: [],
    characters: [],
    memory: '',
    knowledgeBase: '',
    processedChapters: [] // Tracking for resume logic
  };

  // Try to load existing progress
  try {
    const existing = await fs.readFile(settingsPath, 'utf-8');
    projectState = JSON.parse(existing);
    console.log(chalk.yellow(`Resuming: ${projectState.processedChapters.length} chapters processed.`));
  } catch {
    // Try to load bootstrap if no progress exists
    try {
      const bootstrap = await fs.readFile(bootstrapPath, 'utf-8');
      const bData = JSON.parse(bootstrap);
      projectState.glossary = bData.glossary || [];
      projectState.characters = bData.characters || [];
      projectState.memory = bData.memory || '';
      projectState.knowledgeBase = bData.knowledgeBase || '';
      console.log(chalk.cyan('Imported context from bootstrap settings.'));
    } catch {
      console.log(chalk.dim('No existing settings or bootstrap found. Starting fresh.'));
    }
  }

  // 4. Load Prompts
  const refinementPrompt = await fs.readFile(path.join(instructionsDir, 'consolidated-refinement.md'), 'utf-8');
  const filterPrompt = await fs.readFile(path.join(instructionsDir, 'content-filter.md'), 'utf-8');
  const tidierPrompt = await fs.readFile(path.join(instructionsDir, 'glossary-tidier.md'), 'utf-8');

  // 5. Scan EPUBs
  const epubs = (await glob('*.epub', { cwd: inputDir, absolute: true })).sort((a, b) => a.localeCompare(b));
  if (epubs.length === 0) {
    console.log(chalk.red(`\nNo EPUB files found in ${inputDir}. Exiting.`));
    return;
  }

  console.log(chalk.white(`Found ${epubs.length} books to refine.\n`));

  const multiBar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: chalk.magenta('{bar}') + ' {percentage}% | {value}/{total} Chapters | {filename}',
  }, cliProgress.Presets.shades_grey);

  let tidyCounter = 0;

  for (const epubPath of epubs) {
    const filename = path.basename(epubPath);
    console.log(chalk.bold(`\n📖 Processing: ${filename}`));

    const buffer = await fs.readFile(epubPath);
    const zip = await JSZip.loadAsync(buffer);
    
    // Simple Manifest/Spine parsing to get chapters in order
    const containerXml = await zip.file('META-INF/container.xml')!.async('string');
    const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] || '';
    const opfContent = await zip.file(opfPath)!.async('string');
    const opfDoc = new DOMParser().parseFromString(opfContent, 'text/xml');
    
    const manifestItems = Array.from(opfDoc.getElementsByTagName('item')).reduce((acc, item) => {
      acc[item.getAttribute('id') || ''] = item.getAttribute('href') || '';
      return acc;
    }, {} as Record<string, string>);

    const spine = Array.from(opfDoc.getElementsByTagName('itemref')).map(ref => {
      const idref = ref.getAttribute('idref') || '';
      return { id: idref, href: manifestItems[idref] };
    }).filter(s => s.href.endsWith('.xhtml') || s.href.endsWith('.html'));

    const progressBar = multiBar.create(spine.length, 0, { filename });
    const opfDir = path.dirname(opfPath);

    // 6. Cleanup Pass (AI Filter)
    console.log(chalk.dim(`  🧹 Cleaning up junk from ${filename}...`));
    const validSpine = await runCleanup(zip, spine, opfDir, filterPrompt, aiConfig);
    console.log(chalk.dim(`  Keep: ${validSpine.length} / ${spine.length} items.`));

    // 7. Refinement Loop
    for (const item of validSpine) {
      const chapterId = `${filename}-${item.id}`;
      
      if (projectState.processedChapters.includes(chapterId)) {
        progressBar.increment();
        continue;
      }

      const chapterPath = path.posix.join(opfDir, item.href);
      const content = await zip.file(chapterPath)!.async('string');
      
      const response = await callAi(
        JSON.stringify({
          knowledgeBase: projectState.knowledgeBase,
          glossary: projectState.glossary,
          characters: projectState.characters,
          storyMemory: projectState.memory,
          chapterContent: content
        }),
        refinementPrompt,
        aiConfig
      );

      const result = parseJsonResponse(response);
      if (result) {
        // Update content in ZIP
        if (result.refinedContent) {
          await zip.file(chapterPath, result.refinedContent);
        }
        
        // Update State
        if (result.storyMemory) projectState.memory = result.storyMemory;
        if (result.newCharacters) mergeCharacters(projectState.characters, result.newCharacters);
        if (result.newTerms) mergeTerms(projectState.glossary, result.newTerms);
        
        projectState.processedChapters.push(chapterId);
        await fs.writeFile(settingsPath, JSON.stringify(projectState, null, 2));
      }

      progressBar.increment();
      tidyCounter++;

      // 8. Tidy Periodically
      if (tidyCounter >= 5) {
        tidyCounter = 0;
        const tidyResponse = await callAi(
          JSON.stringify({
            glossary: projectState.glossary,
            characters: projectState.characters,
            knowledgeBase: projectState.knowledgeBase
          }),
          tidierPrompt,
          aiConfig
        );
        const tidyData = parseJsonResponse(tidyResponse);
        if (tidyData) applyTidyResult(projectState, tidyData);
      }
    }

    // 9. Export Refined EPUB
    const exportPath = path.join(outputDir, `Refined_${filename}`);
    const outBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(exportPath, outBuffer);
    console.log(chalk.green(`\n✅ Saved: ${exportPath}`));
  }

  multiBar.stop();
  console.log(chalk.bold.green('\n🏁 Batch Refinement Complete!'));
}

async function runCleanup(zip: JSZip, spine: any[], opfDir: string, prompt: string, ai: any) {
  // Simple logic: Scan first 5 and last 5 items
  const startCheck = spine.slice(0, 5);
  const endCheck = spine.slice(-5);
  const toSkip = new Set<string>();

  for (const item of [...startCheck, ...endCheck]) {
    const content = await zip.file(path.posix.join(opfDir, item.href))!.async('string');
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const text = doc.body.textContent || '';
    
    const response = await callAi(text.substring(0, 2000), prompt, ai);
    if (response.toLowerCase().includes('junk')) {
      toSkip.add(item.id);
    }
  }

  return spine.filter(s => !toSkip.has(s.id));
}

async function callAi(prompt: string, system: string, ai: any) {
  try {
    const response = await fetch(ai.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: ai.temperature || 0.1,
      })
    });
    if (!response.ok) return '{}';
    const data = await response.json() as any;
    return data.choices[0].message.content;
  } catch {
    return '{}';
  }
}

function parseJsonResponse(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
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
      found.aliases = Array.from(aliases).filter(a => a.toLowerCase() !== (found.name || '').toLowerCase());
    } else {
      existing.push({ id: crypto.randomUUID(), name, ...n });
    }
  }
}

function mergeTerms(existing: any[], news: any[]) {
  for (const n of news) {
    const term = (n.term || '').trim();
    if (!term) continue;
    const found = existing.find(e => (e.term || '').toLowerCase() === term.toLowerCase());
    if (found) {
      const searches = new Set([...(found.searches || []), ...(n.searches || [])]);
      found.searches = Array.from(searches).filter(s => s.toLowerCase() !== (found.term || '').toLowerCase());
    } else {
      existing.push({ id: crypto.randomUUID(), term, ...n });
    }
  }
}

function applyTidyResult(state: any, result: any) {
  if (result.deletedIds) {
    const ids = new Set(result.deletedIds);
    state.glossary = state.glossary.filter((e: any) => !ids.has(e.id));
    state.characters = state.characters.filter((e: any) => !ids.has(e.id));
  }
  // Simplified merge for CLI
  if (result.mergedTerms) {
    for (const merge of result.mergedTerms) {
      state.glossary.push({ id: crypto.randomUUID(), ...merge.finalEntry });
      const ids = new Set(merge.idsToMerge);
      state.glossary = state.glossary.filter((e: any) => !ids.has(e.id));
    }
  }
}

main().catch(err => {
  console.error(chalk.red('\nFatal Error:'), err);
  process.exit(1);
});
