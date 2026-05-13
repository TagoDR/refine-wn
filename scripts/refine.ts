import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import * as cliProgress from 'cli-progress';
import * as diff from 'diff';
import { glob } from 'glob';
import JSZip from 'jszip';
import { DOMParser } from 'linkedom';
import { ensureDir, getWriteableDataPath, loadConfig, resolveDataPath, ensureLMStudio } from './utils.js';

/**
 * CLI Refine Tool for Batch EPUB Refinement
 * Automates the RefineWN workflow: Cleanup -> Refine -> Tidy -> Export.
 */

interface RefineState {
  glossary: any[];
  characters: any[];
  memory: string;
  knowledgeBase: string;
  processedChapters: string[];
  skippedChapters: string[];
}

async function main() {
  await ensureLMStudio();
  console.log(chalk.bold.magenta('\n✨ RefineWN Batch Refiner\n'));

  // 1. Load Config
  const config = await loadConfig();
  const aiConfig = config.ai;
  const refineConfig = config.refine;
  const bootstrapConfig = config.bootstrap;

  // 2. Resolve Paths
  const inputDir = await resolveDataPath(refineConfig.inputDir);
  const outputDir = await getWriteableDataPath(refineConfig.outputDir);
  const workingDirBase = refineConfig.workingDir;
  const settingsPath = await getWriteableDataPath(refineConfig.settingsFile);
  const bootstrapPath = await resolveDataPath(bootstrapConfig.settingsFile);
  const instructionsDir = await ensureDir(refineConfig.instructionsDir);

  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  // Ensure base working dir exists
  await resolveDataPath(workingDirBase)
    .then(p => fs.mkdir(p, { recursive: true }))
    .catch(() => {});

  console.log(chalk.gray(`Input:    ${inputDir}`));
  console.log(chalk.gray(`Output:   ${outputDir}`));
  console.log(chalk.gray(`Settings: ${settingsPath}`));

  // 3. Load/Init State
  let projectState: RefineState = {
    glossary: [],
    characters: [],
    memory: '',
    knowledgeBase: '',
    processedChapters: [], // Tracking for resume logic
    skippedChapters: [], // Chapters removed by cleanup
  };

  // Try to load existing progress
  try {
    const existing = await fs.readFile(settingsPath, 'utf-8');
    projectState = JSON.parse(existing);
    console.log(
      chalk.yellow(
        `Resuming: ${projectState.processedChapters.length} chapters refined, ${projectState.skippedChapters.length} chapters skipped.`,
      ),
    );
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
  const refinementPrompt = await fs.readFile(
    path.join(instructionsDir, 'consolidated-refinement.md'),
    'utf-8',
  );
  const filterPrompt = await fs.readFile(path.join(instructionsDir, 'content-filter.md'), 'utf-8');
  const tidierPrompt = await fs.readFile(path.join(instructionsDir, 'glossary-tidier.md'), 'utf-8');

  // 5. Scan EPUBs
  const epubs = (await glob('*.epub', { cwd: inputDir, absolute: true })).sort((a, b) =>
    a.localeCompare(b),
  );
  if (epubs.length === 0) {
    console.log(chalk.red(`\nNo EPUB files found in ${inputDir}. Exiting.`));
    return;
  }

  console.log(chalk.white(`Found ${epubs.length} books to refine.\n`));

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n🛑 Process aborted.'));
    process.exit(0);
  });

  const multiBar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: chalk.magenta('{bar}') + ' {percentage}% | {value}/{total} Chapters | {filename}',
    },
    cliProgress.Presets.shades_grey,
  );

  try {
    let tidyCounter = 0;

    for (const epubPath of epubs) {
      const filename = path.basename(epubPath);
      const exportPath = path.join(outputDir, `Refined_${filename}`);

      // Skip if file already exists in output folder
      try {
        await fs.access(exportPath);
        console.log(chalk.dim(`⏭️ Skipping already processed file: ${filename}`));
        continue;
      } catch {
        // File doesn't exist, proceed
      }

      console.log(chalk.bold(`\n📖 Processing: ${filename}`));

      const buffer = await fs.readFile(epubPath);
      const zip = await JSZip.loadAsync(buffer);

      // Simple Manifest/Spine parsing to get chapters in order
      const containerXml = await zip.file('META-INF/container.xml')!.async('string');
      const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1] || '';
      const opfContent = await zip.file(opfPath)!.async('string');
      const opfDoc = new DOMParser().parseFromString(opfContent, 'text/xml');

      const manifestItems = Array.from(opfDoc.getElementsByTagName('item')).reduce(
        (acc, item) => {
          acc[item.getAttribute('id') || ''] = item.getAttribute('href') || '';
          return acc;
        },
        {} as Record<string, string>,
      );

      const spine = Array.from(opfDoc.getElementsByTagName('itemref'))
        .map(ref => {
          const idref = ref.getAttribute('idref') || '';
          return { id: idref, href: manifestItems[idref] };
        })
        .filter(s => s.href && (s.href.endsWith('.xhtml') || s.href.endsWith('.html')));

      const opfDir = path.dirname(opfPath);

      // 6. Cleanup Pass (AI Filter)
      console.log(chalk.dim(`  🧹 Cleaning up junk from ${filename}...`));
      const beforeCount = projectState.skippedChapters.length;
      const validSpine = await runCleanup(
        zip,
        spine,
        opfDir,
        filterPrompt,
        aiConfig,
        filename,
        projectState,
        settingsPath,
      );
      const afterCount = projectState.skippedChapters.length;
      if (afterCount > beforeCount) {
        console.log(chalk.dim(`    ✅ Updated skipped chapters: ${beforeCount} -> ${afterCount}`));
      }

      // Physical Removal from EPUB and State Persistence
      const junkIds = new Set(spine.filter(s => !validSpine.includes(s)).map(s => s.id));
      if (junkIds.size > 0) {
        for (const item of spine) {
          if (junkIds.has(item.id)) {
            // 1. Remove file from ZIP
            zip.remove(path.posix.join(opfDir, item.href));
            // 2. Remove from OPF DOM
            const manifestItem = opfDoc.querySelector(`item[id="${item.id}"]`);
            const spineItem = opfDoc.querySelector(`itemref[idref="${item.id}"]`);
            manifestItem?.remove();
            spineItem?.remove();
          }
        }
        // 3. Serialize and save updated OPF
        const updatedOpf = opfDoc.toString();
        await zip.file(opfPath, updatedOpf);
        // 4. Persist skippedChapters in settings.json
        await fs.writeFile(settingsPath, JSON.stringify(projectState, null, 2));
        console.log(chalk.dim(`  Removed ${junkIds.size} junk chapters from EPUB manifest.`));
      }

      console.log(chalk.dim(`  Refining: ${validSpine.length} / ${spine.length} items.`));

      // Update progress bar with corrected total
      const progressBar = multiBar.create(validSpine.length, 0, { filename });

      // 7. Refinement Loop
      for (const item of validSpine) {
        const chapterId = `${filename}-${item.id}`;
        const chapterPath = path.posix.join(opfDir, item.href);

        let skipRefinement = false;
        if (projectState.processedChapters.includes(chapterId)) {
          // Load refined content from working file to ensure the final EPUB is correct
          try {
            const workingPath = await resolveDataPath(
              path.join(workingDirBase, filename, `${item.id}.html`),
            );
            const html = await fs.readFile(workingPath, "utf-8");
            const doc = new DOMParser().parseFromString(html, "text/html");
            let refined = doc.getElementById("raw-refined")?.textContent || "";

            // Repair: If working file accidentally stored full HTML tags in the raw area
            if (refined.includes("<html") || refined.includes("<body")) {
              refined = extractBodyContent(refined);
              // Update the working file with the repaired content to prevent future issues
              const original = doc.getElementById("raw-original")?.textContent || "";
              const diffHtml = generateDiffHtml(original, refined);
              const finalHtml = createWorkingHtml(diffHtml, original, refined);
              await fs.writeFile(workingPath, finalHtml);
            }

            if (refined) {
              const validXhtml = wrapInXhtml(refined, `${filename} - ${item.id}`);
              await zip.file(chapterPath, validXhtml);
              skipRefinement = true;
            }
          } catch (e) {
            // If working file is missing, we don't skip; it falls through to refinement
            console.log(chalk.yellow(`\n⚠️ Working file missing for ${chapterId}. Re-refining...`));
          }
        }

        if (skipRefinement) {
          progressBar.increment();
          continue;
        }

        const originalContent = await zip.file(chapterPath)!.async("string");

        // Prune context to only include what's relevant to this chapter
        const relevantCharacters = projectState.characters.filter((c) => {
          const name = (c.name || "").toLowerCase();
          const aliases = (c.aliases || []).map((a: string) => a.toLowerCase());
          const text = originalContent.toLowerCase();
          return name && (text.includes(name) || aliases.some((a: string) => text.includes(a)));
        });

        const relevantGlossary = projectState.glossary.filter((g) => {
          const term = (g.term || "").toLowerCase();
          const searches = (g.searches || []).map((s: string) => s.toLowerCase());
          const text = originalContent.toLowerCase();
          return term && (text.includes(term) || searches.some((s: string) => text.includes(s)));
        });

        const response = await callAi(
          JSON.stringify({
            knowledgeBase: projectState.knowledgeBase,
            glossary: relevantGlossary,
            characters: relevantCharacters,
            storyMemory: projectState.memory,
            chapterContent: originalContent,
          }),
          refinementPrompt,
          aiConfig,
        );

        const result = parseXmlResponse(response);
        if (result) {
          // Update content in ZIP
          if (result.refinedProse) {
            const normalizedProse = extractBodyContent(result.refinedProse);
            const validXhtml = wrapInXhtml(normalizedProse, `${filename} - ${item.id}`);
            await zip.file(chapterPath, validXhtml);

            // Save working file with diff
            const workingPath = await getWriteableDataPath(
              path.join(workingDirBase, filename, `${item.id}.html`),
            );
            const diffHtml = generateDiffHtml(originalContent, normalizedProse);
            const finalHtml = createWorkingHtml(diffHtml, originalContent, normalizedProse);
            await fs.writeFile(workingPath, finalHtml);
          }

          // Update State
          if (result.updatedMemory) projectState.memory = result.updatedMemory.trim();
          if (result.extractedTerms) {
            const terms = result.extractedTerms.filter((t: any) => t.category !== 'Name');
            const chars = result.extractedTerms.filter((t: any) => t.category === 'Name');
            mergeTerms(projectState.glossary, terms);
            mergeCharacters(projectState.characters, chars);
          }

          if (!projectState.processedChapters.includes(chapterId)) {
            projectState.processedChapters.push(chapterId);
          }
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
              knowledgeBase: projectState.knowledgeBase,
            }),
            tidierPrompt,
            aiConfig,
          );
          const tidyData = parseXmlResponse(tidyResponse);
          if (tidyData) applyTidyResult(projectState, tidyData);
        }
      }

      // 9. Export Refined EPUB
      const outBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      await fs.writeFile(exportPath, outBuffer);
      console.log(chalk.green(`\n✅ Saved: ${exportPath}`));
    }
  } catch (err) {
    multiBar.stop();
    throw err;
  } finally {
    multiBar.stop();
  }
  console.log(chalk.bold.green('\n🏁 Batch Refinement Complete!'));
}

async function runCleanup(
  zip: JSZip,
  spine: any[],
  opfDir: string,
  prompt: string,
  ai: any,
  filename: string,
  state: RefineState,
  settingsPath: string,
) {
  const toSkip = new Set<string>();

  // 1. Identify previously skipped chapters for this file
  const knownSkipped = new Set(
    state.skippedChapters
      .filter((id: string) => id.startsWith(`${filename}-`))
      .map((id: string) => id.replace(`${filename}-`, "")),
  );

  console.log(chalk.dim(`    🔍 Scanning for story start...`));
  // 2. Scan from the start (limit to 15 chapters to avoid scanning whole book if AI fails)
  for (let i = 0; i < Math.min(spine.length, 15); i++) {
    const item = spine[i];
    const chapterId = `${filename}-${item.id}`;

    if (knownSkipped.has(item.id)) {
      console.log(chalk.dim(`      ⏭️  Skipping cached junk chapter: ${item.id}`));
      toSkip.add(item.id);
      continue;
    }

    const isJunk = await checkIsJunk(zip, item, opfDir, prompt, ai);
    if (isJunk) {
      console.log(chalk.yellow(`      🗑️  Identified new junk chapter: ${item.id}`));
      toSkip.add(item.id);
      if (!state.skippedChapters.includes(chapterId)) {
        state.skippedChapters.push(chapterId);
        await fs.writeFile(settingsPath, JSON.stringify(state, null, 2));
      }
    } else {
      console.log(chalk.dim(`    📍 Story found at index ${i}: ${item.id}`));
      break; // Found first story chapter
    }
  }

  console.log(chalk.dim(`    🔍 Scanning for story end...`));
  // 3. Scan from the end (limit to 10 chapters)
  for (let i = spine.length - 1; i >= Math.max(0, spine.length - 10); i--) {
    const item = spine[i];
    const chapterId = `${filename}-${item.id}`;

    if (toSkip.has(item.id)) continue;
    if (knownSkipped.has(item.id)) {
      console.log(chalk.dim(`      ⏭️  Skipping cached junk chapter: ${item.id}`));
      toSkip.add(item.id);
      continue;
    }

    const isJunk = await checkIsJunk(zip, item, opfDir, prompt, ai);
    if (isJunk) {
      console.log(chalk.yellow(`      🗑️  Identified new junk chapter: ${item.id}`));
      toSkip.add(item.id);
      if (!state.skippedChapters.includes(chapterId)) {
        state.skippedChapters.push(chapterId);
        await fs.writeFile(settingsPath, JSON.stringify(state, null, 2));
      }
    } else {
      console.log(chalk.dim(`    📍 Story ends at index ${i}: ${item.id}`));
      break; // Found last story chapter
    }
  }

  return spine.filter((s) => !toSkip.has(s.id));
}

async function checkIsJunk(zip: JSZip, item: any, opfDir: string, prompt: string, ai: any) {
  const content = await zip.file(path.posix.join(opfDir, item.href))!.async("string");
  const doc = new DOMParser().parseFromString(content, "text/html");
  const text = (doc.body.textContent || "").trim();

  if (text.length < 50) return true; // Micro-chapters are almost certainly junk

  // Use a slightly larger sample for better context
  const response = await callAi(text.substring(0, 2000), prompt, ai);
  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const json = JSON.parse(match[0]);
      return json.remove === true;
    }
  } catch (e) {
    // Fallback if JSON parsing fails
  }
  
  // Last resort fallback
  return response.toLowerCase().includes('"remove": true') || response.toLowerCase().includes("junk");
}

async function callAi(prompt: string, system: string, ai: any, retries = 3) {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(ai.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          temperature: ai.temperature || 0.1,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI Server returned ${response.status}: ${text}`);
      }

      const data = (await response.json()) as any;
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid AI response format (missing content)');
      }
      return data.choices[0].message.content;
    } catch (err: any) {
      lastError = err;
      if (i < retries - 1) {
        const delay = 1000 * (i + 1); // Simple backoff
        console.log(
          chalk.yellow(
            `\n⚠️ AI call failed: ${err.message}. Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries})`,
          ),
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function parseXmlResponse(text: string) {
  const result: any = {};

  const proseMatch = text.match(/<refined_prose>([\s\S]*?)<\/refined_prose>/);
  if (proseMatch) result.refinedProse = proseMatch[1].trim();

  const memoryMatch = text.match(/<updated_memory>([\s\S]*?)<\/updated_memory>/);
  if (memoryMatch) result.updatedMemory = memoryMatch[1].trim();

  const termsMatch = text.match(/<extracted_terms>([\s\S]*?)<\/extracted_terms>/);
  if (termsMatch) {
    try {
      const jsonStr = termsMatch[1].match(/\[[\s\S]*\]/)?.[0] || '[]';
      result.extractedTerms = JSON.parse(jsonStr);
    } catch {
      result.extractedTerms = [];
    }
  }

  // Fallback: If no tags found, try parsing as raw JSON (for the Tidier or simple responses)
  if (!result.refinedProse && !result.updatedMemory && !result.extractedTerms) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  return result.refinedProse || result.updatedMemory || result.extractedTerms ? result : null;
}

function mergeCharacters(existing: any[], news: any[]) {
  for (const n of news) {
    const name = (n.name || n.term || '').trim();
    if (!name) continue;
    const found = existing.find(e => (e.name || '').toLowerCase() === name.toLowerCase());
    if (found) {
      const aliases = new Set([...(found.aliases || []), ...(n.aliases || n.searches || [])]);
      found.aliases = Array.from(aliases).filter(
        a => a.toLowerCase() !== (found.name || '').toLowerCase(),
      );
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
      found.searches = Array.from(searches).filter(
        s => s.toLowerCase() !== (found.term || '').toLowerCase(),
      );
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

function stripTags(html: string) {
  return html.replace(/<[^>]*>?/gm, '');
}

function extractBodyContent(html: string) {
  if (html.includes('<body')) {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (match) return match[1].trim();
  }
  // Remove any stray html/head tags if body wasn't found but they exist
  return html
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .trim();
}

function wrapInXhtml(content: string, title: string) {
  const bodyContent = extractBodyContent(content);

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${title}</title>
  <meta charset="utf-8" />
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

function generateDiffHtml(oldHtml: string, newHtml: string) {
  const oldText = stripTags(oldHtml);
  const newText = stripTags(newHtml);
  const changes = diff.diffWords(oldText, newText);

  return changes
    .map(part => {
      const color = part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent';
      const decoration = part.removed ? 'text-decoration: line-through;' : '';
      const text = part.value.replace(/\n/g, '<br>');
      return `<span style="background-color: ${color}; ${decoration}">${text}</span>`;
    })
    .join('');
}

function createWorkingHtml(diffHtml: string, original: string, refined: string) {
  return `<!DOCTYPE html>
<html lang="en" class="wa-theme-default wa-dark">
<head>
  <meta charset="UTF-8">
  <title>Refinement Progress</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.6.0/dist-cdn/styles/webawesome.css" integrity="sha256-QwsdSf2i6zC+zFqhcT6Tsos+gY20WuA+i2vUW8vCfvc=" crossorigin="anonymous">
  <script src="https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.6.0/dist/webawesome.loader.min.js"></script>
  <style>
    body { font-family: sans-serif; line-height: 1.6; max-width: 900px; margin: 40px auto; padding: 20px; background: #f6f8fa; color: #24292f; }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #0969da; border-bottom: 1px solid #d0d7de; padding-bottom: 10px; }
    .diff-container { white-space: pre-wrap; word-wrap: break-word; }
    .hidden { display: none; }
    .meta { color: #57606a; font-size: 0.9em; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unified Comparison</h1>
    <div class="meta">HTML tags hidden for clarity. Red = Removed | Green = Added</div>
    <div class="diff-container">${diffHtml}</div>
  </div>
  <div class="hidden" id="raw-original"><pre>${original.replace(/</g, '&lt;')}</pre></div>
  <div class="hidden" id="raw-refined"><pre>${refined.replace(/</g, '&lt;')}</pre></div>
</body>
</html>`;
}

main().catch(err => {
  console.error(chalk.red('\nFatal Error:'), err);
  process.exit(1);
});
