import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // The portfolio proxies this app under a stable path. Keeping the base here makes every Vite
  // chunk and public data URL stay inside that path instead of leaking into the portfolio root.
  base: '/projects/token-atlas/demo/',
  plugins: [react()],
  build: {
    // Keep production diagnostics actionable without adding anything to the runtime payload.
    sourcemap: true,
    // The WebGL renderer is a stable, cacheable dependency rather than application code. Keeping
    // it separate means ordinary UI changes do not invalidate Three.js for returning visitors.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three-runtime',
              test: /node_modules[\\/]three[\\/]/,
              priority: 2,
            },
            {
              name: 'react-three-runtime',
              test: /node_modules[\\/]@react-three[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
    // Three's renderer is one tree-shaken source module and cannot be split internally. Its own
    // measured chunk is expected below this boundary; application chunks still stay far smaller.
    chunkSizeWarningLimit: 750,
  },
})
