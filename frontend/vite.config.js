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
  },
})
