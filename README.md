# 旅行足迹 Travel Footprint

一个个人旅行足迹追踪 Web App，记录你走过的每一座城市与景点。

## ✨ 功能特性

- **足迹地图** — 中国省份着色地图，已访省份高亮显示，城市圆点标记，支持年份/同伴筛选
- **景点打卡** — 全国 4A/5A 景点库，支持打卡、加入心愿单、省份/等级/状态筛选
- **旅行回忆** — 图文日记，支持多图灯箱展示、标签筛选、上下篇导航
- **数据管理** — 本地 JSON 备份/恢复，手动添加城市与景点
- **离线可用** — 全量本地化，数据存储在浏览器 localStorage，无需后端

## 🛠 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Vue 3 + `<script setup>` + TypeScript |
| 构建 | Vite 5 |
| 状态管理 | Pinia（含自动 localStorage 持久化） |
| 路由 | Vue Router 4（History 模式） |
| 地图 | Leaflet 1.9 + DataV GeoJSON CDN |
| UI | 纯 CSS 自定义（CSS Variables 设计系统） |

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 构建生产版本
npm run build
```

## 📁 项目结构

```
src/
├── assets/styles/      # CSS 设计 Token（variables.scss）
├── components/         # 可复用组件
│   ├── AppHeader.vue   # 顶部导航
│   ├── AppNav.vue      # 移动端底部导航
│   ├── ChinaMap.vue    # 中国省份地图
│   ├── ImageLightbox.vue  # 图片灯箱
│   ├── MemoryCard.vue  # 回忆卡片
│   └── ScenicSpotCard.vue # 景点卡片
├── stores/             # Pinia 状态管理
│   ├── footprintStore  # 城市足迹
│   ├── scenicStore     # 景点打卡
│   └── memoryStore     # 旅行回忆
├── utils/
│   ├── storage.ts      # localStorage 工具
│   ├── exportImport.ts # 数据导入/导出
│   └── geojsonLoader.ts # GeoJSON CDN 加载器
└── views/              # 页面视图
```

## 💾 数据备份

数据存储于浏览器 **localStorage**，清除浏览器缓存会导致数据丢失。建议定期在「数据管理」页面导出 JSON 备份文件。

- 导出路径：`/manage` → 备份与恢复 → 导出 JSON
- 导入路径：`/manage` → 备份与恢复 → 选择文件

## 🌐 部署到 GitHub Pages

1. 在 GitHub 仓库 Settings → Pages → Source 选择 **GitHub Actions**
2. 推送到 `main` 或 `master` 分支，CI 自动构建部署
3. 访问 `https://<your-username>.github.io/<repo-name>/`

## 📱 移动端

宽度 ≤ 768px 时自动切换为底部 Tab 导航（固定栏），顶部导航链接隐藏。
