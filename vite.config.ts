import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { postgresApiPlugin } from './server/postgres-api.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [postgresApiPlugin(), react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
