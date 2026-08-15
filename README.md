# 旅行足迹 Travel Footprint

一个个人旅行足迹追踪 Web App，记录你走过的每一座城市与景点。

## ✨ 功能特性

- **足迹地图** — 中国省份着色地图，已访省份高亮显示，城市圆点标记，支持年份/同伴筛选；省份边界数据本地化存储，CDN 断连自动降级，永不白屏
- **景点打卡** — 全国 4A/5A 景点库，支持打卡、加入心愿单、省份/等级/状态筛选、自定义景点
- **旅行回忆** — 图文日记，支持多图灯箱展示、标签筛选、上下篇导航
- **坐标自动解析** — 输入城市名自动填充经纬度与省份（内置 330+ 城市坐标库，纯本地零请求）
- **数据安全** — 版本化数据迁移（schemaVersion 升级自动迁移）、损坏数据自动隔离保留现场、JSON 备份/恢复
- **PWA 离线可用** — 可安装到主屏、Service Worker 预缓存、离线仍可查看地图与记录数据
- **云同步（可选）** — Supabase 云备份/多设备同步，未配置时自动降级为纯本地模式，现有功能零影响

## 🛠 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Vue 3 + `<script setup>` + TypeScript |
| 构建 | Vite 5 |
| 状态管理 | Pinia（含自动 localStorage 持久化） |
| 路由 | Vue Router 4（History 模式） |
| 地图 | Leaflet 1.9 + 本地 GeoJSON（DataV CDN 兜底） |
| PWA | vite-plugin-pwa（Workbox 预缓存 + 运行时缓存） |
| 云同步 | @supabase/supabase-js（可选，local-first 同步队列） |
| UI | 纯 CSS 自定义（CSS Variables 设计系统） |

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 构建生产版本
npm run build

# 本地预览生产构建（PWA 功能需在预览/部署环境验证）
npm run preview
```

## 📁 项目结构

```
src/
├── assets/styles/        # CSS 设计 Token（variables.scss）
├── components/           # 可复用组件
│   ├── AppHeader.vue     # 顶部导航
│   ├── AppNav.vue        # 移动端底部导航
│   ├── ChinaMap.vue      # 中国省份地图
│   ├── CloudSyncPanel.vue # 云同步状态面板
│   ├── InstallPrompt.vue # PWA 安装横幅
│   ├── ImageLightbox.vue # 图片灯箱
│   ├── MemoryCard.vue    # 回忆卡片
│   └── ScenicSpotCard.vue # 景点卡片
├── composables/
│   └── usePwaInstall.ts  # PWA 安装状态（beforeinstallprompt 等）
├── stores/               # Pinia 状态管理
│   ├── footprintStore    # 城市足迹
│   ├── scenicStore       # 景点打卡
│   └── memoryStore       # 旅行回忆
├── utils/
│   ├── storage.ts        # localStorage 工具（版本迁移/损坏隔离）
│   ├── migrations.ts     # 数据版本迁移管线（v1→v2）
│   ├── exportImport.ts   # 数据导入/导出
│   ├── geojsonLoader.ts  # GeoJSON 多源加载（本地→CDN→降级）
│   ├── cityCoords.ts     # 内置城市坐标库（330+ 城市）
│   ├── geoResolver.ts    # 坐标解析管线（本地 + 高德扩展点）
│   ├── supabase.ts       # Supabase 客户端封装（凭据缺失返回 null）
│   └── syncService.ts    # local-first 同步队列（合并/上限/容错）
├── types/                # 类型定义（AppState 含 schemaVersion）
└── views/                # 页面视图
```

## 💾 数据安全

- **自动迁移**：数据带 `schemaVersion` 版本号，升级时自动执行迁移管线（v1→v2 补齐 country、回填坐标），数据一条不丢
- **损坏隔离**：本地数据 JSON 损坏时自动隔离到 `travel_footprint_data_corrupted`（保留最近 5 份原始现场），应用以内置示例数据正常启动，绝不静默覆盖
- **备份导出**：`/manage` → 备份与恢复 → 导出 JSON（定期备份建议）

## ☁️ 云同步（Supabase，可选）

未配置时应用完全本地模式，不影响任何功能。配置后可将足迹数据备份到云端、多设备访问同一份数据。

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 获取凭据：supabase.com → New project → Project Settings → API
#    VITE_SUPABASE_URL=你的 Project URL（如 https://xxx.supabase.co）
#    VITE_SUPABASE_ANON_KEY=你的 anon/public key

# 3. 重启开发服务器
npm run dev
```

> ⚠️ `.env` 含本地凭据，已被 .gitignore 忽略，切勿提交；`.env.example` 为占位模板可提交。
> 数据写操作（城市/景点/回忆增删改）会自动进入本地同步队列，凭据配置后由「立即同步」推送到云端。

## 🌐 部署到 GitHub Pages

1. 在 GitHub 仓库 Settings → Pages → Source 选择 **GitHub Actions**
2. 推送到 `main` 或 `master` 分支，CI 自动构建部署（`npm run build` + 上传 dist）
3. 访问 `https://<your-username>.github.io/<repo-name>/`

> PWA 在部署环境自动生效（`npm run build` 产出 `sw.js` + manifest），首次访问后可安装到主屏、离线使用。

## 🧪 测试

项目包含 Playwright 验收脚本（Python，可复跑回归）：

```bash
# 需要 .venv（含 playwright + chromium）
.\.venv\Scripts\python.exe tests\test_48_migration.py   # 数据迁移验收
.\.venv\Scripts\python.exe tests\test_44_coords.py      # 坐标解析验收
.\.venv\Scripts\python.exe tests\test_45_geojson.py     # GeoJSON 本地化验收
.\.venv\Scripts\python.exe tests\test_46_pwa.py         # PWA 验收
.\.venv\Scripts\python.exe tests\acceptance\test_taskB.py  # 同步队列入队验收
```

## 📱 移动端

宽度 ≤ 768px 时自动切换为底部 Tab 导航（固定栏），顶部导航链接隐藏；支持 PWA 安装横幅（iOS 提供手动「添加到主屏幕」指引）。
