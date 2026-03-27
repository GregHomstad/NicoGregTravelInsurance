import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        claims: resolve(__dirname, 'claims.html'),
        contact: resolve(__dirname, 'contact.html'),
        faq: resolve(__dirname, 'faq.html'),
        planfinder: resolve(__dirname, 'plan-finder.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        quote: resolve(__dirname, 'quote.html'),
        whytripkavach: resolve(__dirname, 'why-tripkavach.html'),
        plans: resolve(__dirname, 'plans/index.html'),
        plansannual: resolve(__dirname, 'plans/annual.html'),
        planscompare: resolve(__dirname, 'plans/compare.html'),
        planscorporate: resolve(__dirname, 'plans/corporate.html'),
        plansfamily: resolve(__dirname, 'plans/family.html'),
        planslongterm: resolve(__dirname, 'plans/long-term.html'),
        plansshortterm: resolve(__dirname, 'plans/short-term.html'),
        plansstudent: resolve(__dirname, 'plans/student.html'),
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
