import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Both 'scripts/' and 'dist/' are one level below the project root.
export const ROOT_DIR = path.resolve(__dirname, '..');

export const CONFIG_PATH = path.join(ROOT_DIR, 'src/config.json');

/**
 * Resolves a path relative to the "Data Root".
 * Checks 'dist/data' first, then 'public/data'.
 */
export async function resolveDataPath(relativeDataPath: string): Promise<string> {
  const distPath = path.join(ROOT_DIR, 'dist/data', relativeDataPath);
  const publicPath = path.join(ROOT_DIR, 'public/data', relativeDataPath);

  try {
    await fs.access(distPath);
    return distPath;
  } catch {
    return publicPath;
  }
}

/**
 * Resolves a path for WRITING data.
 * Prefers 'dist/data' if it exists, otherwise 'public/data'.
 * Ensures the parent directory exists.
 */
export async function getWriteableDataPath(relativeDataPath: string): Promise<string> {
  const distRoot = path.join(ROOT_DIR, 'dist/data');
  let baseDir: string;

  try {
    await fs.access(distRoot);
    baseDir = distRoot;
  } catch {
    baseDir = path.join(ROOT_DIR, 'public/data');
  }

  const finalPath = path.join(baseDir, relativeDataPath);
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  return finalPath;
}

/**
 * Loads the project configuration.
 */
export async function loadConfig() {
  const content = await fs.readFile(CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Ensures a directory exists and returns its absolute path.
 */
export async function ensureDir(relativeOrAbsolutePath: string): Promise<string> {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(ROOT_DIR, relativeOrAbsolutePath);

  await fs.mkdir(absolutePath, { recursive: true });
  return absolutePath;
}
