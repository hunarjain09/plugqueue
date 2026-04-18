import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  envDir: resolve(__dirname, '../../'),
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'PlugQueue',
        short_name: 'PlugQueue',
        description: 'Privacy-first EV charging queue management',
        theme_color: '#0ea5e9',
        background_color: '#f7f9fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Do NOT cache API responses — queue data must always be fresh
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    // Accept *.localhost so portless.sh can front the dev server at
    // https://plugqueue.localhost. Plain http://localhost:5173 keeps working.
    // Tunnel hosts (.loca.lt, .trycloudflare.com, .ngrok.io) allowed for mobile testing.
    allowedHosts: ['.localhost', '.loca.lt', '.trycloudflare.com', '.ngrok.io', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.dev'],
    // When running under portless, its HTTPS proxy terminates at :443 and HMR
    // needs to connect back through it with wss. Opt in via PORTLESS=1.
    hmr: process.env.PORTLESS
      ? { protocol: 'wss', clientPort: 443, host: process.env.PORTLESS_HOST || 'plugqueue.localhost' }
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
