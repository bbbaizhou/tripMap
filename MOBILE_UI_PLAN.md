# 旅行足迹 · 移动端 UI 优化方案（Mobile UI Plan）

> 目标视口：iPhone 13（390×844 CSS px）。断点统一 `@media (max-width: 768px)`（与现有代码一致），480px 仅作微调。
> 约束：仅布局调整，不改筛选/交互逻辑；不引 Element Plus、不新增依赖；优先复用 variables.scss token。
> 结论先行：根因是「双重内边距 + 无媒体查询」，地图 68px 宽是 `.map-body` 行布局（176px 筛选栏）把 `.map-main` 挤没的结果。

## 0. 全局根因（先修，收益覆盖全站）

- **G0-1 双重内边距**：`App.vue:28-30` `.page-container { padding:16px }`，而每个 view 自带 `padding:24px` → 每侧 40px，390 视口可用宽仅 **310px**（地图塌陷的放大器）。
  方案：`.page-container { padding: 0 }`，保留 `App.vue:33-37` 移动端 `padding-bottom: 76px`（底栏避让）；水平留白统一由各 view 的 media 查询收敛为 16px。
  验收：390 视口下内容宽 = 390 − 2×16 = **358px**。
- **G0-2 无横向溢出兜底**：`index.html:5` 已有 viewport meta（无需改），但 `html/body` 无 `overflow-x` 防护。
  方案：App.vue 追加非 scoped `<style> { html, body { overflow-x: hidden; } }`（或新建 `base.scss` 在 `main.ts:3` 引入）。
  验收：`document.documentElement.scrollWidth === 390`。

---

## P0 地图页（最高优先）

### P0-1 `.map-body` 行布局挤压地图（实测 `.leaflet-container` 仅 68px 宽）
- **定位**：`MapView.vue:130-134` `.map-body{display:flex}`；`:136-146` `.filter-panel{width:176px;flex-shrink:0}`；`:188-191` `.map-main{flex:1;min-width:0}`；全文件无媒体查询。390 视口（可用 310px）下 176+16 的筛选栏把地图挤到 68px。
- **方案**（MapView.vue `<style>` 追加）：
```css
@media (max-width: 768px) {
  .map-view { padding: 12px 0; }          /* 水平去内边距，地图全宽 */
  .map-header { padding: 0 12px; }
  .map-body { flex-direction: column; gap: 12px; }
  .filter-panel {                          /* 折叠为横向滚动胶囊条 */
    width: 100%; flex-direction: row; gap: 10px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    padding: 10px 12px; flex-shrink: 0;
  }
  .filter-section { flex: 0 0 auto; min-width: 128px; }
  .filter-result { flex: 0 0 auto; }
  .map-main { width: 100%; flex: none; }
}
```
- **验收**：390 视口 `.leaflet-container` offsetWidth = **390px ≥ 380px**；筛选条可横向滑动，年份/同伴选择互不挤压。

### P0-2 地图高度与 Leaflet 尺寸感知
- **定位**：`MapView.vue:90` 传 `height="calc(100vh - 196px)"`（内联样式优先级高于 CSS）；`ChinaMap.vue:127` 仅 `onMounted` 调一次 `invalidateSize()`，布局变化/旋转后瓦片偏移。
- **方案**：
  - (a) CSS 优先（推荐，零逻辑改动）：`ChinaMap.vue` 追加 `@media (max-width: 768px) { .china-map-wrapper { height: 55vh !important; } }`（`!important` 覆盖内联 prop）。
  - (b) `ChinaMap.vue` `onMounted` 增加 `window` `resize`/`orientationchange` 监听（300ms 防抖调 `map.invalidateSize()`），`onBeforeUnmount` 移除——唯一新增 JS，仅为尺寸重算，不改业务逻辑。
- **验收**：390 视口地图高 ≈ 55vh（约 455px）；旋转/拉伸窗口后瓦片与省份边界不偏移。

### P0-3 页头统计横向溢出
- **定位**：`MapView.vue:102-108` `.map-header` 行布局 + `:121-128` `.map-stats{flex-shrink:0}` 三组数字不换行，390 下与标题挤行。
- **方案**：`@media (max-width:768px){ .map-header{flex-direction:column;align-items:flex-start;gap:10px} .map-stats{flex-wrap:wrap;gap:6px 14px;font-size:13px} }`
- **验收**：390 视口页头无横向滚动，统计自然换行。

---

## P1 全页面响应式规范（统一规则 R1–R4）

- **R1 网格降列**：≥3 列信息卡 → 移动端 1 列；纯数字统计卡 → 2 列。
- **R2 表单降列**：双列 `.form-grid` / `.form-row` → 1 列。
- **R3 留白与字号**：各 view `padding:24px → 16px`；≥28px 标题 → 22px。
- **R4 工具栏/筛选**：`flex-wrap: wrap` + `overflow-x: auto` 兜底。

### P1-1 首页回忆卡 4 列
- **定位**：`HomeView.vue:229-233` `.memory-row{repeat(4,minmax(0,1fr))}` 无 MQ（390 下每卡约 75px 挤压换行）；`:97` padding 24；`:251-256` 已有 MQ 只处理 hero。
- **方案**：`@media (max-width:768px){ .home-view{padding:16px} .memory-row{grid-template-columns:1fr;gap:12px} }`
- **验收**：390 视口卡片宽 = 358px，标题/标签不换行。

### P1-2 首页统计卡（现状已合规，复测）
- **定位**：`FootprintStats.vue:44-48` 4 列；`:112-116` 已有 `@768 → repeat(2,…)`，390 下每卡 ≈171px，已达标。
- **方案**：仅当复测仍挤时加 `@media (max-width:480px){ .stats-grid{gap:10px} .stat-card{padding:14px 12px} .stat-value{font-size:24px} }`
- **验收**：390 视口 2 列、数值无换行。

### P1-3 景点页网格 3 列 + Dialog 表单
- **定位**：`ScenicView.vue:294-296` `.spot-grid{repeat(3,…)}` 无 MQ（390 每卡 ≈106px）；`:246` padding 24；`:318` `.form-row` 双列（Dialog 内城市/省份）；`:311-314` `.dialog` padding 28px 32px。
- **方案**：
```css
@media (max-width: 768px) {
  .scenic-view { padding: 16px; }
  .spot-grid { grid-template-columns: 1fr; gap: 12px; }
  .dialog { padding: 20px 16px; }
}
@media (max-width: 480px) { .form-row { flex-direction: column; } }
```
- **验收**：390 视口景点卡满宽；打卡按钮不挤压；Dialog 内输入单列。

### P1-4 数据管理：表单双列 + 页签
- **定位**：`DataManageView.vue:246` `.form-grid{1fr 1fr}` 无 MQ；`:254` `.full-width{grid-column:span 2}`；`:223` `.tab-bar` 无 wrap，4 个 tab（含"备份与恢复"）在 390 下超宽。
- **方案**：`@media (max-width:768px){ .manage-view{padding:16px} .form-grid{grid-template-columns:1fr;gap:12px} .full-width{grid-column:auto} .tab-bar{flex-wrap:wrap;gap:6px} .tab{padding:8px 14px;font-size:13px} }`
- **验收**：390 视口表单单列、简介不再跨列；4 个 tab 完整可见不溢出。

### P1-5 写回忆/编辑表单
- **定位**：`MemoryFormView.vue:228` `.form-row{display:flex;gap:16px}` 无 MQ（日期/费用双列在 390 各约 163px）；`:198` padding 24；`:247-254` `.form-actions` 右对齐。
- **方案**：`@media (max-width:768px){ .form-view{padding:16px} .form-row{flex-direction:column} .form-actions{flex-direction:column-reverse} .btn-submit{width:100%;padding:12px} .btn-cancel{width:100%} }`
- **验收**：390 视口输入全宽 ≥358px；发布按钮整行可点。

### P1-6 回忆详情图片画廊
- **定位**：`MemoryDetailView.vue:147-155` `.image-gallery{2fr 1fr 1fr}` 无 MQ（390 下第 3 列仅约 80px）；`:139` `.detail-title{28px}`；`:125` padding 24。
- **方案**：`@media (max-width:768px){ .detail-view{padding:16px} .detail-title{font-size:22px} .image-gallery{grid-template-columns:1fr 1fr;max-height:none} .gallery-thumb{height:140px} }`
- **验收**：390 视口每张缩略图宽 ≥170px。

### P1-7 数据导出/导入双列
- **定位**：`DataExportImport.vue:87` `.action-row{1fr 1fr}` 无 MQ。
- **方案**：`@media (max-width:768px){ .action-row{grid-template-columns:1fr} }`
- **验收**：390 视口导出/导入卡片各占整行。

### P1-8 AI 页面（复查：大部分已合规，补 2 处）
- **定位**：已合规——`AiPlanView.vue:592-605`（表单 1 列/操作竖排）、`AiInsightsView.vue:309-317`（统计 3→2 列）、`AiOrganizeView.vue:948-966`（org-row 堆叠）、`AiHomeView.vue:189-197`（入口 1 列）。
  遗留：`AiPlanView.vue:520` `.plan-toolbar`、`:542` `.plan-feedback-bar` 行布局 390 下可能溢出。
- **方案**：`@media (max-width:480px){ .plan-toolbar{flex-wrap:wrap} .plan-feedback-bar{flex-wrap:wrap} }`
- **验收**：390 视口 AI 页面无横向滚动。

### P1-9 顶栏（AppHeader）
- **定位**：`AppHeader.vue:126-130` 移动端隐藏 nav-links（正确，由 `AppNav.vue:77-79` 底栏接管），但 brand + `:96-103` user-email(max-width:180px) + 登录/退出按钮在 390 有溢出风险。
- **方案**：`@media (max-width:768px){ .app-header{padding:12px 16px} }` + `@media (max-width:480px){ .user-email{display:none} .brand{font-size:17px} }`
- **验收**：390 视口 header 单行不溢出。

---

## P2 移动端体验增强（可选）

### P2-1 地图筛选交互（二选一）
- **A. 顶部横向胶囊条（推荐，改动最小）**：P0-1 的横向滚动 `.filter-panel` 即满足；把 `.filter-select` 改胶囊样式 `min-height:40px; font-size:16px`（16px 防 iOS 聚焦缩放），保持原生 select 交互。
- **B. 底部抽屉**：需新增开关按钮 + v-if 抽屉结构，改动大、收益有限，本轮不推荐（P2-1A 验收达标即关闭本项）。
- **验收**：筛选条横向可滚、胶囊 ≥40px 高，筛选行为与桌面一致。

### P2-2 触控目标 ≥44px（次要 ≥36px）
- **定位**：`MemoryListView.vue:93-97` `.tag-chip`（高约 28px）、`ScenicView.vue:280-284` `.tab-btn`（约 31px）、`AiOrganizeView.vue:737-747` `.org-mini-btn`（约 27px）、`ScenicSpotCard.vue:140-148` `.btn`（约 26px）。
- **方案**：`@media (max-width:768px)` 下统一 `min-height:36px`；主操作（`.hero-btn`、`.submit-btn`、`.btn-primary`）`min-height:44px`。
- **验收**：DevTools 设备触控面板实测命中区 ≥ 标注值。

### P2-3 iOS 聚焦缩放防护
- **定位**：`.filter-select`（MapView/ScenicView）、`.fi`（DataManageView）、`.form-input`（MemoryFormView）均 font-size 13–14px。
- **方案**：`@media (max-width:768px){ .filter-select, .fi, .form-input { font-size:16px } }`
- **验收**：聚焦输入框时 iOS 不自动放大页面。

---

## 移动端适配检查清单（编码后逐项验证，390×844）

- [ ] 1. **/map**：`.leaflet-container` 宽度 = 390px ≥ 380px；高度 ≈55vh；筛选条横向可滚；旋转窗口后瓦片正常（invalidateSize 生效）。
- [ ] 2. **全站**：`document.documentElement.scrollWidth === 390`（无横向滚动条）。
- [ ] 3. **首页**：hero 标题 ≤28px；回忆卡 1 列；统计卡 2 列。
- [ ] 4. **景点**：景点卡 1 列；筛选条换行不溢出；Dialog 表单单列。
- [ ] 5. **回忆列表**：标签 chips 换行；年份组单列。
- [ ] 6. **回忆详情**：画廊 2 列；标题 22px；上下篇导航不挤行。
- [ ] 7. **写回忆/编辑**：表单单列；提交按钮整行。
- [ ] 8. **管理**：tab 换行完整可见；城市/景点表单单列；导出导入 1 列。
- [ ] 9. **AI 三页**：表单 1 列、统计 2 列、入口 1 列；工具栏不溢出。
- [ ] 10. **触控**：主按钮 ≥44px、次要按钮 ≥36px。
- [ ] 11. **底栏**：AppNav 固定底栏不遮挡内容（`.page-container` 移动端 `padding-bottom:76px` 保留）。
- [ ] 12. **断点一致性**：新增规则全部落在 `@media (max-width:768px)` 内（480px 微调已注明），桌面 ≥769px 样式零变化。
- [ ] 13. **回归**：桌面（≥1024px）逐页对比无布局变化；筛选/打卡/增删改交互行为与改动前一致。
