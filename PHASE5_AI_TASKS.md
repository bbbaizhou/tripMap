# Phase 5 AI 旅行助手 —— 前端集成骨架规格（不依赖 API Key 本轮）

> 范围：`/ai` 三大能力（行程规划 / 数据洞察 / 智能整理）的前端骨架 + 统一 AI 客户端。
> 本轮**不接入真实 DeepSeek 调用**（调用留 TODO 骨架并标注激活条件），凭据缺失时优雅降级：零网络请求、零报错、现有功能零影响。

## 0. 全局约束（已核实项目现状）

- Vue 3.4 + `<script setup>` + strict TS（`noUnusedLocals/noUnusedParameters`，未用参数加 `_` 前缀，参考 `geoResolver.ts` 的 `_q`）。
- 新逻辑进 `src/utils/` 或 `src/composables/`；新组件进 `src/components/` 或 `src/views/`。不新增依赖（AI 用原生 `fetch`，不引 axios/OpenAI SDK）。
- Element Plus：已在 `package.json` 但 `main.ts` 未注册、现有视图全部纯 CSS → **本轮 AI 视图不用 EP**，复用 `.form-grid/.fg/.fi/.submit-btn/.form-error/.form-success` scoped 样式语言（与 `DataManageView.vue` 一致）。建议 P2：抽公共表单/卡片样式，评估移除未用 EP 依赖。
- 凭据仅经 `import.meta.env` 注入（构建期静态替换，运行时改 env 无效——验收时"配置态"用注入 cfg 的单测覆盖，见 §2）。降级判定复刻 `src/utils/supabase.ts`：`trim()` 判空 → 返回 null → 不抛错不发请求。
- 不破坏现有 store/API；`localStorage` 的 `travel_footprint_data` 格式不变；`storage.ts`/`syncService.ts` 零改动。
- 测试现状：无 vitest，仓库用 Python Playwright 验收（`tests/acceptance/` 已有 configured/unconfigured 双态范式）→ 本轮验收以**未配置态浏览器测试**为主，聚合纯函数按"可单测"设计（建议 P2 引入 vitest 补单测）。

## 1. 子任务 1：AI 助手入口与路由

**目标**：`/ai` 可直达；桌面导航可见入口；未配置时显示引导卡。
**文件**：`src/router/index.ts`（改）、`src/components/AppHeader.vue`（改）、`src/views/AiHomeView.vue`（新）。

路由（懒加载，插在 `/manage` 之前；不做嵌套 children，保持扁平）：

```ts
{ path: '/ai', name: 'AiHome', component: () => import('../views/AiHomeView.vue'), meta: { title: 'AI 旅行助手 - 旅行足迹' } },
{ path: '/ai/plan', name: 'AiPlan', component: () => import('../views/AiPlanView.vue'), meta: { title: 'AI 行程规划 - 旅行足迹' } },
{ path: '/ai/insights', name: 'AiInsights', component: () => import('../views/AiInsightsView.vue'), meta: { title: '足迹数据洞察 - 旅行足迹' } },
{ path: '/ai/organize', name: 'AiOrganize', component: () => import('../views/AiOrganizeView.vue'), meta: { title: 'AI 智能整理 - 旅行足迹' } },
```

导航决策（记录理由）：
- `AppHeader.vue`：`nav-links` 增加 `<RouterLink to="/ai">AI 助手</RouterLink>`（header 的 nav 在 ≤768px 已 `display:none`，天然仅桌面显示，零改动移动端）。
- `AppNav.vue`（移动端底部栏）：**本轮不加第 6 个 Tab**——60px 高已容 5 个 10px 字号 Tab，再加会挤压可点性。移动端入口经 `AiHomeView` 引导卡内链接（P2 可选：首页快捷入口或把「管理」换「AI」）。

`AiHomeView.vue` 要点：
- 顶部：`isAiConfigured()`（来自 `aiClient`）分支。未配置 → 引导卡（`.ai-guide-card`）：「AI 能力未配置」+ 步骤（复制 `.env.example` → 填 `VITE_AI_API_KEY` → 重启 dev server）；已配置 → 状态徽标。
- 三张入口卡 `.ai-entry-card`（RouterLink）：① 行程规划 → `/ai/plan`；② 足迹数据洞察 → `/ai/insights`；③ 智能整理 → `/ai/organize`。每卡含名称+一句话描述。未配置时**卡片仍可点击**（子页各自降级），保证骨架全程可浏览。
- 合规标注：页脚「AI 生成内容仅供参考」（PRODUCT_RD_PLAN 5.5.4）。

**完成=以下验收可通过**：直接访问 `/ai` 渲染 3 张入口卡；无 `.env` 时显示引导卡且 `navigator` 观察不到任何对外部主机的请求；全程无 console error（复用 `tests/acceptance/common.py` 的错误收集）。

## 2. 子任务 5：统一 AI 客户端 `src/utils/aiClient.ts`（先做，2/3 依赖）

**目标**：集中 env 读取、配置判定、三个生成函数的签名与 TODO 骨架。
**文件**：`src/utils/aiClient.ts`（新）、`.env.example`（改）、`src/vite-env.d.ts`（改）。

`.env.example` 追加（源码严禁出现真实 Key）：

```
# AI 旅行助手配置（可选）。VITE_AI_API_KEY 留空则 AI 页面显示「AI 能力未配置」并优雅降级，不影响任何现有功能。
# 获取：platform.deepseek.com → API Keys。VITE_AI_ENDPOINT 为预留（默认 https://api.deepseek.com/chat/completions，接入后端代理后改）。
VITE_AI_API_KEY=
VITE_AI_ENDPOINT=
```

`vite-env.d.ts` 的 `ImportMetaEnv` 追加：`readonly VITE_AI_API_KEY?: string`、`readonly VITE_AI_ENDPOINT?: string`。

TS 接口（全部导出自 `aiClient.ts`；`YearlyInsightStats` 在 `insightStats.ts` 定义，见 §4）：

```ts
export interface AiConfig { apiKey: string; endpoint: string }
export interface ItineraryRequest { destination: string; days: number; style: string; budget?: string; companions?: string; startDate?: string }
export interface DaySpot { name: string; city: string; level: string; duration: number; tip?: string }
export interface DayPlan { day: number; title: string; spots: DaySpot[]; budget?: string; tips?: string }
export interface InsightsRequest { year: string; stats: YearlyInsightStats }
export interface AutoTagRequest { title: string; content: string; cities: string[] }
```

函数签名与骨架（每个函数第一个动作 `if (!cfg) return null`；`cfg` 可注入便于单测）：

```ts
export function isAiConfigured(): boolean          // trim 后 apiKey 非空即可（endpoint 缺省用默认值）
export function getAiConfig(): AiConfig | null      // 读 import.meta.env，trim 判空；endpoint 缺省 'https://api.deepseek.com/chat/completions'
export async function generateItinerary(input: ItineraryRequest, cfg: AiConfig | null = getAiConfig()): Promise<DayPlan[] | null>
export async function generateInsights(input: InsightsRequest, cfg: AiConfig | null = getAiConfig()): Promise<string[] | null> // 3-5 条洞察文本
export async function autoTag(input: AutoTagRequest, cfg: AiConfig | null = getAiConfig()): Promise<string[] | null>
```

真实调用实现要点（留 TODO 注释，激活条件 = `isAiConfigured()` 为真且 Phase 5.2 接入）：

```
// TODO(Phase 5.2)：fetch(cfg.endpoint) POST，Headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` }
// body: { model: 'deepseek-chat', messages: [{ role: 'system', content: '<角色约束>' }, { role: 'user', content: '<序列化后的 input>' }],
//         response_format: { type: 'json_object' }, temperature: 0.7 }
// 30s 超时用 AbortController；失败返回 null 由调用方降级提示。本轮骨架在 cfg 非空后直接 return null（占位）。
```

调用方契约：**先 `isAiConfigured()` 短路再调用**，未配置时页面根本不触达函数 → 零请求。

**完成=以下验收可通过**：未配置时三函数均 resolve `null`、不 throw、不发起任何 fetch；cfg 注入后函数体仅含 TODO 注释与占位返回（code review 可查）；`npm run build`（vue-tsc strict）通过。

## 3. 子任务 2：AI 行程规划骨架

**目标**：完整输入表单 + 降级提示 + 预置行程卡片流渲染结构。
**文件**：`src/views/AiPlanView.vue`（新）；卡片可拆 `src/components/AiDayPlanCard.vue`（可选，行数允许时拆）。

表单（复用 DataManageView 样式语言）：`destination*`（文本）、`days`（number，1-15，clamp）、`style`（select：自然/人文/美食/亲子/穷游/深度）、`budget`（文本，如「3000」）、`companions`（文本，如「3 人」）、`startDate`（date，可选）。

提交逻辑：
- `isAiConfigured()` 为假 → 提交按钮 `:disabled="!aiConfigured"`，表单下方常显提示块 `.form-hint`：「AI 能力未配置：请在 `.env.example` 中填写 `VITE_AI_API_KEY` 后重启开发服务器」。**不发请求**。
- 为真 → `plans = await generateItinerary({...})`；骨架返回 null → 结果区显示空态「行程生成服务接入中（TODO Phase 5.2）」。
- 测试辅助（可选，强烈建议）：「预览示例行程」次按钮写入硬编码 fixture `DayPlan[]`（2 天示例），使卡片流渲染可无 Key 验收。

结果区：`v-for="plan in plans"` → 日卡片：`第 {{plan.day}} 天 · {{plan.title}}`；spots 列表行渲染 `name / city / level / duration（建议停留小时）` + 可选 `tip`；底部 `budget`、`tips` 区块；卡片角标「AI」。页脚合规标注「内容由 AI 生成，仅供参考」。

**完成=以下验收可通过**：未配置 → 按钮 disabled、提示可见、点按无任何网络请求、无 console error；配置或示例 → 卡片流正确渲染 day/title/spots(含 name/city/level/duration)/budget/tips 全部字段。

## 4. 子任务 3：AI 数据洞察骨架

**目标**：年份选择 + 前端精确聚合 + AI 解读占位 + 分享卡片预留。
**文件**：`src/utils/insightStats.ts`（新，纯函数）、`src/views/AiInsightsView.vue`（新）。

`insightStats.ts`（与 store 解耦，入参为普通数组，可直接单测）：

```ts
export interface InsightSourceData { cities: FootprintCity[]; spots: ScenicSpot[]; memories: TravelMemory[] }
export interface YearlyInsightStats { year: string; cityCount: number; provinceCount: number; spotCount: number;
  memoryCount: number; totalDays: number; totalCost: number; cityList: string[]; provinceList: string[] }
export function daysBetween(startDate: string, endDate: string): number          // 含首尾：end-start+1 天；非法输入返回 0
export function computeYearlyInsights(data: InsightSourceData, year: string): YearlyInsightStats
export function getInsightYears(data: InsightSourceData): string[]               // 降序去重：memories.startDate ∪ cities.firstVisitDate 的年份
```

统计口径（**精确定义，防幻觉——LLM 不参与计算**）：
- `cityCount`：`cities.filter(c => c.firstVisitDate.startsWith(year))` 条数；`provinceCount`：上述城市的 `province` 去重数；`cityList/provinceList` 同步收集。
- `spotCount`：`spots.filter(s => s.status === 'visited' && s.visitDate?.startsWith(year))` 条数。
- `memoryCount`：`memories.filter(m => m.startDate.startsWith(year))` 条数。
- `totalDays`：上述 memories 的 `daysBetween(startDate, endDate)` 之和。
- `totalCost`：上述 memories 的 `(cost ?? 0)` 之和（cost 缺省按 0，口径可单测）。

`AiInsightsView.vue` 要点：
- 年份下拉（`getInsightYears(store 数据)`，无数据年份显示空态提示）→ `computed` 调 `computeYearlyInsights`。
- 统计卡片区：6 项数字卡（城市/省份/景点/回忆/总天数/总花费），纯 CSS `.stat-card`（视觉参考 `FootprintStats.vue`）。
- AI 解读区：未配置 → 占位「配置后生成个性化解读」；已配置 → 调 `generateInsights({ year, stats })`，骨架返回 null →「解读生成接入中」空态。
- 年度报告分享卡片：Canvas 1080×1080 绘制 + PNG 导出**预留**（P2 标注：容器占位 + TODO 注释，本轮不实现）。

**完成=以下验收可通过**：构造固定数组输入，`computeYearlyInsights` 六项数字与手算一致（口径如上）；页面年份切换后统计与 store 数据一致；未配置时解读区占位、零请求。

## 5. 子任务 4：AI 智能整理骨架（可选缩减）

**文件**：`src/views/AiOrganizeView.vue`（新）。
**目标**：三行功能入口的 UI 预留，全部 P1 后置。每行：功能名 + 说明 + 状态徽标「接入中」+ 扩展点注释：
- 坐标兜底解析：复用 `geoResolver.ts` 管线（`AmapGeoResolver` 已预留远程扩展；LLM 兜底 = TODO 仿 `autoTag` 加一个 `resolveCoordsViaLLM`，本轮只留注释）。
- 自动标签：TODO 调 `aiClient.autoTag()`；UI 预留「对回忆批量打标签」入口（未配置禁用 + 提示）。
- 景点信息补全：TODO 生成 `description/type/最佳季节`，产出标注「AI 生成，请核实」（PRODUCT 5.4 原则）。

**完成=以下验收可通过**：页面渲染三行入口、无 console error；不触发任何真实 AI/网络调用（Playwright 请求监听为空）。

## 6. 实施顺序与全局验收

实施顺序：**① 子任务 1（路由+导航+AiHomeView）→ ② 子任务 5（aiClient+.env.example+env 类型，2/3 依赖）→ ③ 子任务 2（行程）→ ④ 子任务 3（洞察）→ ⑤ 子任务 4（整理，可并行/最后）**。

全局验收命令与行为：
1. `npm run build`：`vue-tsc -b` 严格模式零错误（含未用变量检查）。
2. 未配置态 Playwright 冒烟（仿 `tests/acceptance/test_taskA_unconfigured.py`）：`/ai`、`/ai/plan`、`/ai/insights`、`/ai/organize` 四页直接访问 → 无白屏、无 console error、`page.on('request')` 无任何外部主机请求、四页均可见「AI 能力未配置」类降级提示。
3. 配置态：以注入 cfg 的单元级验证（未引入 vitest 前为手测/code review）确认三函数按契约返回；`grep` 确认源码与 `dist/` 无真实 Key。
4. 回归：首页/地图/景点/回忆/管理五模块导航与数据读写不受影响（`localStorage` 格式未变）。

**范围外（标注 P2，本轮不做）**：真实 DeepSeek 调用与后端代理、流式生成、Canvas 分享卡片、智能整理三子功能本体、AI 使用埋点/反馈、内容审核。
