import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'LifeLink — Organ & Blood Donation Platform',
        short_name: 'LifeLink',
        description: 'Connecting blood and organ donors with recipients, coordinated with hospitals.',
        theme_color: '#1A1F36',
        background_color: '#F9F7F4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache only the built app shell (HTML/JS/CSS/icons) — NOT
        // API responses or the WebSocket connection. /api and
        // /socket.io traffic is intentionally left alone here: this app
        // needs live data (donor/request status, real-time chat), so
        // "installable app shell that loads offline" is the right scope
        // for a first PWA pass, not "fully offline-capable data sync,"
        // which would risk showing stale medical/matching data.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Lets the frontend call /api/... in dev without CORS headaches;
      // production deploys point VITE_API_URL at the real backend origin.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Same reasoning, but for the Socket.io WebSocket upgrade — ws:true
      // is required or the connection silently falls back to failing,
      // since a plain HTTP proxy rule doesn't forward the upgrade.
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
