# 旅行足迹 · National Geographic 风格 UI 优化方案

> 纯设计规格（不修改代码）｜Vue 3 + TS｜基线：绿色主色 `#2e7d32` + NatGeo 黄 `#FFCC00` 强调
> 原则：大图驱动、衬线排版、黄色唯一强调、编辑式卡片、克制动效；不引外部字体/库，不新增依赖，断点维持 768px。

---

## 0. 设计原则（5 条）

1. **绿是品牌，黄是声音**：绿色承担身份/状态/常规操作；黄色只做"唯一强调"——眉题、主 CTA、激活指示、hover 边框、装饰线。黄色视觉占比 ≤5%。
2. **衬线讲标题，无衬线讲内容**：`--font-display`（Georgia/宋体系）用于标题/数字/眉题区，正文保持 PingFang SC。
3. **大图在前，文字克制叠图**：卡片与 Hero 一律图像驱动，文字置于图下或图上深色遮罩层。
4. **眉题（eyebrow）是 NatGeo 语汇**：每个章节标题上方放 11–13px 大写（英文）+ 黄分隔线。
5. **动效只做两件事**：hover 图片 `scale(1.03)` + 150–200ms 平滑过渡；禁止弹跳/位移动画堆叠。

---

## 1. P0-1 设计 Token 扩展（`src/assets/styles/variables.scss`，现第 2–49 行）

**现状**：绿系色板（L2–7）、中性色（L10–14）、单一无衬线字体（L22）、字号 scale 到 40px（L28）。

**方案**：在 `:root` 追加以下 Token（不改动现有绿系值，保持向后兼容）：

```scss
// 品牌强调（NatGeo 黄）
--color-natgeo: #FFCC00;
--color-natgeo-ink: #7a5c00;          // 浅底上的黄文字（AA 达标）
--color-natgeo-soft: rgba(255, 204, 0, 0.15); // 浅黄填充（激活/徽标底）
--color-natgeo-glow: rgba(255, 204, 0, 0.35); // 深底装饰线/轨迹

// 深色摄影系（Hero 用）
--color-forest-900: #0b1f14;          // 深绿黑
--color-forest-700: #123a22;
--color-forest-500: #1b5e20;

// 字体族（纯系统栈，无外部加载）
--font-display: 'Playfair Display', Georgia, 'Times New Roman',
                'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
--font-body: 'PingFang SC', 'Microsoft YaHei', sans-serif;  // 由 --font-family 迁移

// 排版 scale 追加
--font-size-hero: 72px;      // 桌面 Hero 标题（移动 40px 用媒体查询覆盖）
--font-size-section: 32px;   // 章节标题（移动 24px）
--font-size-eyebrow: 12px;   // 眉题
--letter-spacing-eyebrow: 3px;
--line-height-display: 1.15;
```

**验收**：`variables.scss` 新增 ≥12 个 Token 且无删除旧值；全站引用 `--color-primary` 的组件零改动仍可编译；`--font-display` 在 Chrome/Edge（Windows）回退 Georgia + 宋体、macOS 回退 Georgia + Songti SC，均不产生网络请求。

---

## 2. P0-2 主页 Hero 重设计（`src/views/HomeView.vue`，结构 L23–63 / 样式 L99–204）

**现状**：绿色渐变背景（L100 `linear-gradient(135deg,#1b5e20,#2e7d32,#388e3c)`）、白色轨迹 SVG（L26–38）、`hero-title` 36px 无衬线（L162）、白色半透明胶囊统计（L180–191）、白底主按钮（L199）。

**方案（由内向外逐层替换）**：

| 元素 | NatGeo 方案（具体 CSS 值） |
|---|---|
| 背景 | `background: radial-gradient(1100px 520px at 82% -12%, var(--color-natgeo-glow), transparent 62%), radial-gradient(860px 480px at 8% 112%, rgba(76,175,80,.28), transparent 58%), linear-gradient(162deg, var(--color-forest-900) 0%, var(--color-forest-700) 48%, var(--color-forest-500) 100%)` |
| 噪点/光晕 | `.hero::before` 改为：`background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`（内联 SVG，无外部请求）；原 L108–123 两个白色圆形光晕删除 |
| 眉题 `.hero-label` | `color: var(--color-natgeo); font-size: 13px; font-weight: 700; letter-spacing: var(--letter-spacing-eyebrow); text-transform: uppercase; opacity: 1`；前置黄色短横线：`&::before { content:''; display:inline-block; width:24px; height:2px; background:var(--color-natgeo); vertical-align:middle; margin-right:10px; }` |
| 标题 `.hero-title` | `font-family: var(--font-display); font-size: var(--font-size-hero); font-weight: 600; line-height: var(--line-height-display); letter-spacing: .5px;` 去 `font-weight:800`（衬线靠字形而非字重显分量） |
| 副题 `.hero-tagline` | 保持正文栈，`font-size: 18px; letter-spacing: 1px; opacity: .8` |
| 轨迹 `.hero-trail` | 折线 `stroke: var(--color-natgeo-glow)`，圆点 `fill: rgba(255,204,0,.5)`，终点 `fill: var(--color-natgeo)`；`filter: drop-shadow(0 0 6px rgba(255,204,0,.35))` |
| 统计胶囊 `.stat-pill` | `background: rgba(255,255,255,.06); border: 1px solid var(--color-natgeo-glow); border-radius: 999px;` 文字白；`strong` 改用 `font-family: var(--font-display); font-size: 22px; color: var(--color-natgeo);` |
| 主按钮 `.hero-btn.primary` | **改为黄底黑字（NatGeo 招牌 CTA）**：`background: var(--color-natgeo); color: var(--color-forest-900); border-radius: 2px;`（编辑风直角）；hover `translateY(-2px)` 保留 |
| 次按钮 `.hero-btn.secondary/.outline` | 白字 + `border: 1px solid rgba(255,255,255,.55)`，hover 黄描边 `border-color: var(--color-natgeo)`；圆角统一 2px（编辑风） |

**按钮决策（专家裁定）**：主 CTA 用黄底黑字——黄=唯一"下一步"动作（查看足迹地图/写回忆）；绿保留为常规/状态色（页内 `btn-confirm`、`add-btn`、`new-btn` 维持绿底）。这样黄绿分层：**黄=召唤行动，绿=品牌身份**，避免全站泛黄。

**移动端（≤768px，现 L251–260）**：`hero-title` → `font-size: 40px`（保证衬线可读，勿低于 34px）；`.hero-label` 13px；`.hero` padding `32px 20px`；`hero-btn` 维持 `min-height:44px`（L259 保留）。

**验收**：DevTools 计算样式 `hero-title` 桌面 72px / 移动 40px；轨迹 SVG 无 `#fff` stroke；`#FFCC00` 上 `#0b1f14` 文字对比度 ≈ 14:1（≥4.5:1 AA）；页面 Network 面板无新增字体请求；768px 断点下 Hero 高度 ≤ 480px 无横向滚动。

---

## 3. P1-1 导航（`AppHeader.vue` L41–131 + `AppNav.vue` L34–83）

**现状**：顶栏品牌"🌏 个人旅行足迹"黑体（L50–57）；链接绿色胶囊激活态（L83–88）；底部 Tab 绿色顶条（`AppNav.vue` L60–74）。

**方案——顶栏（编辑风杂志导航）**：
- 容器（L41–48）：维持白底 + `border-bottom: 1px solid var(--color-border)`。
- 品牌（L50–57）：`.brand` → `font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: 1px;` 文字「旅行足迹」（保留 🌏 icon）；右缘加 2px 黄竖条：`border-right: 2px solid var(--color-natgeo); padding-right: 12px;`。
- 链接（L64–88）：**去胶囊**——`padding: 8px 14px; border-radius: 0; background: transparent; color: var(--color-text-primary);`；hover：`color: var(--color-primary);` + `border-bottom: 2px solid var(--color-natgeo-glow)`；激活（L83–88）：`color: #1f2937; font-weight: 700; background: transparent; border-bottom: 2px solid var(--color-natgeo);`（黄下划线替代绿胶囊）。
- 登录按钮（L105–119）：保持绿色（身份/常规操作不抢 CTA）。

**方案——底部 Tab（AppNav.vue）**：激活指示条 L64–74 由 `background: var(--color-primary)` 改 `background: var(--color-natgeo)`、高度 4px 改 3px；文字激活色 `var(--color-primary)` 保留（绿=品牌，黄=指示）；`.nav-item` 保持 `padding: 8px 0`（高度 60px，触控达标）。

**验收**：激活路由下顶栏链接仅显示一条 2px 黄下划线、无胶囊背景；底部导航激活项顶条为 `rgb(255,204,0)`；断点 768px 顶栏链接隐藏、底部导航显示（逻辑不变）。

---

## 4. P1-2 章节标题（编辑式眉题统一模式）

**现状**：HomeView `.section-title` 绿色左竖条（L206–224）；MapView/ScenicView/MemoryListView 的 `h2` 为默认黑体（MapView L110–113、ScenicView L289、MemoryListView L80）。

**方案**：在 `variables.scss` 定义全局模式（放 `:root` 后或新建 `src/assets/styles/global.scss`，仅样式不改结构）：

```scss
.section-head { margin: 0 0 20px; }
.section-head .eyebrow {           // 眉题
  font-size: var(--font-size-eyebrow);
  font-weight: 700; letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase; color: var(--color-natgeo-ink);
  margin-bottom: 6px;
}
.section-head h2 {
  font-family: var(--font-display);
  font-size: var(--font-size-section); font-weight: 600;
  line-height: var(--line-height-display); margin: 0;
}
.section-head::after {             // 底部细分隔线：40px 黄 + 全宽 hairline
  content: ''; display: block; width: 40px; height: 2px;
  background: var(--color-natgeo); margin-top: 12px;
}
```

- HomeView `.section-title`（L206–224）：删除绿竖条 `::before`，改用上述结构；「旅行数据」→ 眉题「DATA · 数据」。
- MapView `.map-header h2`（L110）→ `.section-head` 模式；`p` 副题保持 14px 灰。
- ScenicView `.scenic-header h2`（L289）→ 同；MemoryListView `.list-header h2`（L80）→ 同。
- MemoryListView `.year-label`（L104–108）：`font-family: var(--font-display); font-size: 22px;` 下边框改 `border-bottom: 2px solid var(--color-natgeo-soft)`，前置 24px 黄短线。

**验收**：全站章节标题均为衬线 + 黄色眉题/分隔线，无残留绿色左竖条；桌面 32px / 移动 24px（移动覆盖见 §7）；h2 数量与改动前一致（结构未变）。

---

## 5. P1-3 卡片（`MemoryCard.vue` L53–90 / `ScenicSpotCard.vue` L49–71）

**现状**：MemoryCard 纯文字白卡（无图）；ScenicSpotCard 信息卡 + 绿/蓝状态边框。

**方案——MemoryCard（图像式杂志卡）**：
- 结构（不引入新组件，仅加装饰块）：`memory-card` 顶部增加封面层：`aspect-ratio: 16 / 10; border-radius: 8px 8px 0 0; overflow: hidden;` 有图时 `img { width:100%; height:100%; object-fit: cover; }`（取 `memory.images[0]`，无图时用 `linear-gradient(135deg, var(--color-forest-700), var(--color-forest-500))` 底 + 居中 🌏 水印）。
- 标题（L60–63）：`font-family: var(--font-display); font-size: 20px; font-weight: 600; line-height: 1.3;`
- 日期（L65–69）：眉题化 `font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--color-text-secondary);`
- 标签（L78–84）：底色 `var(--color-primary-lighter)` 保留（绿=状态），hover 卡整体：`border: 1px solid var(--color-natgeo)`（黄边框）+ 封面 `img { transform: scale(1.03); transition: transform 400ms ease; }`；`box-shadow: none` 换细边框 `border: 1px solid var(--color-border)`（L53–58 改）。

**方案——ScenicSpotCard（纯信息卡）**：白底 + 细边框保持；hover 边框转黄 `border-color: var(--color-natgeo)`（替换 L60–63 阴影位移，位移可保留 1px）；`5A` 徽标（L92）→ `background: var(--color-natgeo-soft); color: var(--color-natgeo-ink);`；景点名（L79–84）→ 衬线 16px/600；状态标签（L131–132）绿/蓝保留（语义色不替换）。

**验收**：MemoryCard 桌面 4 列网格（HomeView L229–233）下图片比例恒为 16:10（`aspect-ratio` 生效）；hover 后 `border-color` 计算值 `rgb(255,204,0)`；无图卡片不破版（占位渐变）；触控目标维持 `btn-primary` ≥44px（L157）。

---

## 6. P1-4 统计卡（`FootprintStats.vue` L44–116 + `ScenicView.vue` L299–306）

**现状**：白卡 + 阴影 + hover 时绿色顶条显现（L58–76）；数字 28px 无衬线（L98–103）。

**方案**：
- `.stat-card`（L50–57）：`box-shadow: none; border: 1px solid var(--color-border);` 编辑风平卡。
- 顶条（L58–69）：常显 3px：`background: var(--color-natgeo); opacity: 1;`（黄 accent 线替代 hover 才出现的绿条）。
- `.stat-value`（L98–103）：`font-family: var(--font-display); font-size: 40px; font-weight: 600; color: #1f2937;`；`.unit` 保持 14px 灰。
- `.stat-icon`（L84–91）：底色改 `var(--color-natgeo-soft)`。
- ScenicView `.stat-number`（L305）：同衬线化 32px；`stat-visited` 顶条加 2px 黄（`border-top: 2px solid var(--color-natgeo)`）。

**验收**：桌面数字 40px 衬线；黄顶条无需 hover 恒可见；4 列网格（L44–48）与移动 2 列（L112–116）不变。

---

## 7. 移动端适配汇总（≤768px，结构性断点均沿用现有）

| 区域 | 现有锚点 | 追加规格 |
|---|---|---|
| Hero | HomeView L251–260 | 标题 40px、眉题 13px、胶囊换黄描边、按钮 ≥44px |
| 卡片 | 各卡 `@media` | 单列（已有）；MemoryCard 封面保持 16:10（`aspect-ratio` 自适应宽度） |
| 统计 | FootprintStats L112–116 | 2 列不变；数字 32px |
| 底部导航 | AppNav L81–83 | 激活顶条黄（§3） |
| 章节标题 | — | `--font-size-section: 24px`；眉题 11px |
| 触控 | 各文件 P2-2 注释 | 主操作 ≥44px、次要 ≥36px、Tab 60px 全高（均已实现，勿回退） |
| 表单/筛选 | MapView L243–246、ScenicView L406、MemoryListView L121 | 单列/横滚胶囊不变；input font-size 16px 防 iOS 聚焦缩放不变 |

**验收**：在 390px 宽 DevTools 下逐页检查无横向溢出（`overflow-x: hidden` 兜底在 `App.vue` L42–46，保留）；所有可点元素命中 `min-height ≥36px`。

---

## 8. P2 细节（低风险微调，可后置）

1. **回忆详情页**（`MemoryDetailView.vue`）：`.detail-title`（L139）→ `font-family: var(--font-display); font-size: 32px; font-weight: 600;`；移动 24px（L196）；日期 meta（L141）眉题化 12px 灰 + 黄 `::before` 短线；正文（L170–171）保持 16px 正文栈。
2. **按钮统一**：页内确认按钮（ScenicView `.btn-confirm` L392–396、MemoryListView `.new-btn` L82–86）维持绿底（决策见 §2）；统一 `border-radius: 8px → 2px` 可选（低风险批量替换，注意 Dialog 内按钮可保留圆角 8px 以区分层级）。
3. **MapView 细节**：`.filter-select:focus`（L172–174）绿 → `border-color: var(--color-natgeo)`；`.map-stats`（L121–128）数字衬线化（`.map-stats span` 前缀数字）。
4. **ScenicView 筛选**：`.tab-btn.active`（L323）→ `background: var(--color-natgeo-soft); color: var(--color-natgeo-ink); border-color: var(--color-natgeo);`；`.add-btn`（L292–296）保持绿。
5. **空状态/引导**（HomeView L235–249、MemoryListView L111–117）：图标下方加黄 40px 短线；文案不动。

---

## 9. 黄 × 绿 搭配策略（全案核心规则）

1. **色职分离**：绿 = 品牌/状态/常规按钮/已读信息；黄 = 唯一强调/主 CTA/眉题/激活指示/hover 反馈/装饰线。任一页面视图中，黄不可同时出现在 3 个以上功能点。
2. **明度配对**：深色底（Hero、封面）上黄做**发光强调**（文字 `#FFCC00`、描边 `rgba(255,204,0,.35)`）；浅色底（卡片、导航）上黄只做**细线/小块**（2–3px 线、`--color-natgeo-soft` 填充），文字用 `--color-natgeo-ink: #7a5c00` 保对比度 ≥4.5:1。
3. **禁用组合**：禁止黄底黄字、黄底绿字（对比不足）、黄绿大面积并置（≤1:4 面积比）；黄永远不与红色 `--color-accent:#ff6b6b` 相邻使用。
4. **比例自检**：每页截图后目测，黄元素面积占比目标 1–5%（眉题+一条线+一个 CTA≈达标）；超过 5% 即回撤次级强调。

---

## 10. 渐进式落地顺序（收益/风险）

**第一批（P0，半天内，纯 Token+单页，零功能风险）**
1. `variables.scss` 加 Token（§1）——全案地基，改完即生效且无回归。
2. HomeView Hero 重设计（§2）——最大视觉收益，全部改动收敛在 scoped 样式内。
3. AppHeader 导航（§3 顶栏）——低风险、全站可见。

**第二批（P1，1–2 天）**
4. 章节标题模式 + 三个列表页接入（§4）。
5. MemoryCard / ScenicSpotCard 卡片化（§5）——注意 MemoryCard 需验证无图占位。
6. FootprintStats / ScenicView 统计数字衬线化（§6）。

**第三批（P2，按需）**
7. 详情页、按钮圆角、MapView/ScenicView 细节（§8）——纯微调，可随时中断。

**风险提示**：唯一结构性改动是 MemoryCard 封面层（§5），实施时先跑 `pnpm build` 确认类型与 `memory.images` 存在性（`types/index.ts` TravelMemory.images 已定义）；其余全部为 CSS 值替换，可逐条 git 提交回滚。

---

## 11. 总验收清单（全部可测量）

- [ ] `grep -c 'natgeo' variables.scss ≥ 5`；`--font-display` 存在且无 `@font-face`/`url(` 外链
- [ ] Hero 标题桌面 72px / 移动 40px；轨迹无白色 stroke；主按钮计算色 `rgb(255,204,0)`
- [ ] 顶栏激活链接仅有 2px 黄下划线（无胶囊）；底部 Tab 顶条黄色
- [ ] 章节标题衬线 32/24px + 黄眉题 + 40px 黄分隔线
- [ ] MemoryCard 封面 `aspect-ratio: 16/10`；hover 边框黄色
- [ ] 统计数字衬线 40/32px；黄顶条常显
- [ ] 768px 断点全部行为与现状一致（导航切换、栅格列数、触控尺寸）
- [ ] `pnpm build` 通过；Network 无新增外部资源请求
