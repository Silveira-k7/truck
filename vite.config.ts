import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localSqliteApiPlugin } from './server/local-sqlite-api.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [localSqliteApiPlugin(), react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
