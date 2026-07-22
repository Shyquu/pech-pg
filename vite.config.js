import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // rapier3d-compat ships a wasm blob that must not be pre-bundled
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
