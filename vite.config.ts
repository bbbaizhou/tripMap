import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: '旅行足迹',
        short_name: '旅行足迹',
        lang: 'zh-CN',
        description: '记录你去过的每一座城市与景点',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f7fa',
        theme_color: '#2e7d32',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // json 用于预缓存本地 GeoJSON
        globPatterns: ['**/*.{js,css,html,json,svg,png,ico}'],
        // history 路由离线深链兜底
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/geo\.datav\.aliyun\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'datav-geojson' },
          },
        ],
      },
    }),
  ],
  base: './',
})
