import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Percorsi relativi: l'app funziona anche se pubblicata in una sottocartella o su un altro dominio.
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { target: 'es2022', outDir: 'dist' },
});
