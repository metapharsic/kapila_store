import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Required: @huggingface/transformers loads WASM via dynamic imports
  // Excluding it from pre-bundling allows the web worker to load it correctly.
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },

  server: {
    host: "0.0.0.0",
    port: 8008,
    strictPort: true,
    // Required headers for SharedArrayBuffer (used by WASM workers)
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
})

