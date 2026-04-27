import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // Bind to all interfaces so LAN devices can reach the dev server
    host: '0.0.0.0',
    // Proxy /api/* to the backend — LAN clients only need port 5173 open.
    // Vite forwards the request internally to localhost:3001, so Windows
    // Firewall blocking port 3001 from LAN doesn't matter.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
