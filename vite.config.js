import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Pages la app se sirve bajo /videocomprobantes/ (nombre del repo).
// En dev local y en Vercel se sirve en la raíz.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/videocomprobantes/' : '/',
});
