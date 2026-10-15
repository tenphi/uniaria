import { defaultClientConditions, defineConfig } from 'vite';

/** Builds the benchmark page for production: React's and Sous's checks off. */
export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ['sous-source', ...defaultClientConditions] },
  build: { outDir: 'dist', emptyOutDir: true },
  logLevel: 'warn',
});
