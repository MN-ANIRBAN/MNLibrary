import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    
    // ── Dev Server Headers ──────────────────────────────────────────────────
    server: {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
      proxy: {
        '/api/imgbb': {
          target: 'https://api.imgbb.com',
          changeOrigin: true,
          rewrite: () => `/1/upload?key=${env.IMGBB_API_KEY || ''}`
        },
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: () => `/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY || ''}`
        }
      }
    },
  preview: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },

  // ── Production Build Optimizations ──────────────────────────────────────
  build: {
    minify: true,          // Vite 8 uses rolldown's built-in minifier by default
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    sourcemap: false, // No source maps in production (security)
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) requires manualChunks as a function, not an object
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/'))        return 'vendor-react';
            if (id.includes('framer-motion'))                              return 'vendor-framer';
            if (id.includes('@supabase'))                                  return 'vendor-supabase';
            if (id.includes('@lottiefiles') || id.includes('dotlottie'))  return 'vendor-lottie';
            if (id.includes('recharts'))                                   return 'vendor-charts';
            if (id.includes('@zxing') || id.includes('html5-qrcode'))     return 'vendor-scanner';
            if (id.includes('browser-image-compression') || id.includes('react-image-crop')) return 'vendor-image';
            if (id.includes('lucide-react'))                               return 'vendor-icons';
            // All other node_modules → shared vendor chunk
            return 'vendor';
          }
        }
      },
    },
  },

  // ── Dependency Pre-bundling ──────────────────────────────────────────────
  optimizeDeps: {
    include: [
      'react', 'react-dom',
      '@supabase/supabase-js',
      'framer-motion',
      'lucide-react',
      'react-hot-toast',
      'dompurify',
    ],
    // These are loaded lazily — exclude from pre-bundle
    exclude: ['@zxing/browser', '@zxing/library', 'html5-qrcode'],
  },
  }
})
