import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, testTimeout: 30000, include: ['src/**/*.test.jsx'] },
});
