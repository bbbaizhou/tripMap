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
        start_url: '/tripMap/',
        scope: '/tripMap/',
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
  // GitHub Pages 子路径部署：用绝对路径 /tripMap/（base:'./' 在 SW navigateFallback 下
  // 会导致 manifest/资源相对解析漂移到域根，破坏移动端「添加到主屏幕」可安装性）
  base: '/tripMap/',
})
