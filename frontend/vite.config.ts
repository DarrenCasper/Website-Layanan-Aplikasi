import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The backend runs on its own origin in development, so every /api request
    // is proxied there and the browser only ever sees one origin. That keeps the
    // backend free of any CORS entry for the dev server. A production build sets
    // VITE_API_URL and skips this proxy entirely.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // The backend mounts its routes at the root (/auth/login, /reset/...),
        // so the /api marker exists only to give the proxy something to match.
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
