import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        claims: resolve(__dirname, 'claims.html'),
        contact: resolve(__dirname, 'contact.html'),
        faq: resolve(__dirname, 'faq.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        quote: resolve(__dirname, 'quote.html'),
        plans: resolve(__dirname, 'plans/index.html'),
        planscompare: resolve(__dirname, 'plans/compare.html'),
        planslongterm: resolve(__dirname, 'plans/long-term.html'),
        plansshortterm: resolve(__dirname, 'plans/short-term.html'),
      }
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      }
    }
  }
})
