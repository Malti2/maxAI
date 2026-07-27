import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split large, independently-cacheable vendors into their own chunks so
        // the initial payload parses faster and updates invalidate less.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('highlight.js')) return 'highlight';
          // Math typesetting is bulky and rarely changes — keep it cacheable on
          // its own (checked before the markdown group, which matches 'rehype').
          if (id.includes('katex')) return 'katex';
          if (
            id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') ||
            id.includes('micromark') || id.includes('mdast') || id.includes('hast') ||
            id.includes('unist') || id.includes('unified') || id.includes('vfile') ||
            id.includes('property-information') || id.includes('character-entities') ||
            id.includes('decode-named-character-reference') || id.includes('trim-lines') ||
            id.includes('space-separated-tokens') || id.includes('comma-separated-tokens')
          ) return 'markdown';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
