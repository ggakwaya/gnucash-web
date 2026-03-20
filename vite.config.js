import { defineConfig } from 'vite';

export default defineConfig({
  // Let Vite handle sql.js normally (it will pre-bundle the CJS→ESM conversion)
});
