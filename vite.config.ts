import { builtinModules } from 'module';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // CLI Production Build
  if (mode === 'cli') {
    return {
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry: {
            refine: resolve(__dirname, 'scripts/refine.ts'),
            bootstrap: resolve(__dirname, 'scripts/bootstrap.ts'),
          },
          formats: ['es'],
          // Ensure stable filenames without hashes
          fileName: (_format, entryName) => `${entryName}.js`,
        },
        rollupOptions: {
          output: {
            // Ensure any shared code has a stable filename instead of a hash
            chunkFileNames: 'cli-shared.js',
          },
          external: [
            ...builtinModules,
            ...builtinModules.map(m => `node:${m}`),
            'jszip',
            'linkedom',
            'chalk',
            'cli-progress',
            'glob',
            'diff',
          ],
        },
        ssr: true,
        target: 'node20',
        minify: false,
      },
    };
  }

  // Default Web Workstation Config
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: true, // Keep dist/cli if it exists
    },
  };
});
