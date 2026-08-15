# Phase 5 剩余任务详细规格（5.5–5.8）

> 适用范围：旅行足迹（Vue 3.4 + TS + Pinia + Vite 5）。已完成：数据安全、云同步、AI 模块（aiClient 真实 DeepSeek 调用）、AI 行程卡片操作（5.3）、洞察统计（5.4）。
> 统一约束：`<script setup>` + strict TS；新逻辑放 `src/utils/` `src/components/` `src/views/`；不引 Element Plus、不新增依赖；AI 调用前 `isAiConfigured()` 短路（未配置零请求）；不破坏现有 store API 与降级路径；埋点/反馈 localStorage 用独立 key，与 `travel_footprint_data`/`travel_footprint_sync_*` 隔离。验收均以「手动操作 + `npm run build` 通过」为准（无单测基建）。

---

## 任务 5.5：年度报告分享卡片（Canvas 1080×1080 → PNG，P1）

**目标**：在 AiInsightsView 增加「生成分享卡片」区域——纯 Canvas（零图表库）绘制 1080×1080 年度报告卡（品牌标题 / 年份 / 六项统计 / 城市点线装饰 / 品牌页脚），导出 PNG 下载；预览按移动端 CSS 缩放。可选：复制图片到剪贴板。

**文件清单**
- 新增 `src/utils/yearlyCard.ts`：纯绘制逻辑（无 DOM 依赖，可独立验证）
- 新增 `src/components/YearlyShareCard.vue`：canvas 预览 + 下载/复制按钮 + 状态
- 修改 `src/views/AiInsightsView.vue`：把 115–121 行「分享卡片预留容器」替换为 `<YearlyShareCard>`，传入年份与 stats

**接口/数据结构（TS）**
```ts
// src/utils/yearlyCard.ts
export interface YearlyCardInput {
  year: string
  brand: string                       // 品牌名（'旅行足迹'）
  stats: { label: string; value: string }[]   // 6 项，value 已格式化（含 ¥）
  cityPins: { name: string; lat: number; lng: number }[]  // 地图点线装饰数据（取 visitedCities）
  footer: string                      // 页脚（'旅行足迹 · 用脚步丈量世界'）
}
export const CARD_SIZE = 1080
export function drawYearlyCard(canvas: HTMLCanvasElement, input: YearlyCardInput): void
export function cardToPngDataUrl(canvas: HTMLCanvasElement): string
```

**实现要点与注意**
- 布局：顶部品牌+年份标题区 → 中部 2×3 六项统计网格（label 小字 + value 大字）→ 底部装饰区（lat/lng 归一化到画布留白矩形：lng→x、lat→y，画折线连接 + 圆点 + 城市名）→ 底部品牌页脚。主题色用产品绿（`#4caf50` 系），背景浅绿渐变。
- 固定 1080×1080 绘制（`canvas.width = canvas.height = CARD_SIZE`）；预览 CSS `max-width:100%; height:auto` 缩放，移动端不溢出。
- 文字：`ctx.font` 用系统字体栈（如 `'600 96px PingFang SC, Microsoft YaHei, sans-serif'`）；中英文混排值（`¥1234`）正常绘制；长城市名按需截断（≤6 字 + '…'）。
- 导出：`a[download]` 触发，文件名 `travel-footprint-{year}.png`；内容 `canvas.toDataURL('image/png')`。
- 复制图片（可选）：`canvas.toBlob` → `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`，仅 HTTPS/本地安全上下文显示该按钮，失败降级为仅下载。
- 组件状态：`idle | rendering | ready | error`；stats 为 null（无数据年份）时禁用按钮并提示「该年份暂无统计数据」。
- 若卡片加入 AI 生成的「年度寄语」文本：展示前必须过 5.7 `checkContent`（见任务 5.7 调用点）；默认卡片仅含数字+城市名，可不依赖 AI。
- 5.8 埋点：生成成功/失败各记 `trackAiUse('shareCard', ok)`。

**完成=以下验收可通过**
1. 选择有数据的年份 → 点击「生成分享卡片」→ 出现 1080×1080 绘制预览（CSS 自适应，移动端不横向溢出），六项数字与页面 statCards 完全一致。
2. 点击「下载 PNG」→ 浏览器下载 `travel-footprint-2025.png`，图片 1080×1080、含标题/年份/六项统计/点线装饰/品牌页脚。
3. 无数据年份（stats 为 null）→ 按钮禁用 + 明确提示，不报错。
4. 复制图片按钮仅在剪贴板可用环境出现；复制失败降级为下载，页面不崩溃。
5. `npm run build` 通过；断网可用（纯本地绘制，零请求）。

**实施顺序**：1) `yearlyCard.ts` 纯绘制（用假数据手测）→ 2) `YearlyShareCard.vue` 预览+下载 → 3) 接入 AiInsightsView → 4) 复制图片（可选）与移动端缩放验证 → 5) 接 5.7 检查与 5.8 埋点。

---

## 任务 5.6：智能整理三功能（P1）

**目标**：激活 AiOrganizeView 三行功能，均支持「选择范围 → 批量执行 → 进度提示 → 结果预览与确认/拒绝 → 错误降级」。

### 5.6-A 坐标兜底解析（纯本地，零请求，无条件可用）
- 范围：`scenicStore.spots` 中 `lat===0 && lng===0` 的景点；逐个 `resolveCityCoords({ cityName: spot.city, province: spot.province })`。
- 结果预览（景点名 → 提议坐标，标注来源 `local`）→ 确认后写入。
- 需要 `scenicStore` 新增 `updateSpot(spotId, updates: Partial<ScenicSpot>)`（完全仿 memoryStore.updateMemory，属新增 API，不破坏现有）。

### 5.6-B 自动标签
- 范围：全部回忆 / 仅无标签（`!tags.length`）；勾选列表（标题+日期+现有标签）→ 批量 `aiClient.autoTag`（串行，防并发超限）。
- 预览：每条「现有 tags → 建议 tags」→ 确认合并写入 `memoryStore.updateMemory(id, { tags: mergeTags(existing, incoming) })`；拒绝保留原值。

### 5.6-C 景点信息补全（AI，需 isAiConfigured）
- 范围：全部 / 仅 `!description` 的景点；调用 aiClient **新增** `describeSpot`。
- 预览生成的 description → 确认写入 `scenicStore.updateSpot`；写入值末尾追加「（AI 生成，请核实）」（无 schema 变更的最小标注方案）。
- 单条失败（返回 null）跳过并计数，不中断批量。

**文件清单**
- 新增 `src/utils/aiOrganize.ts`：纯筛选/合并函数
- 修改 `src/utils/aiClient.ts`：新增 `describeSpot` + `SpotInfoRequest/SpotInfoResult` + `SPOT_INFO_SYSTEM_PROMPT`，`AiAction` 增加 `'spotInfo'`
- 修改 `supabase/functions/ai-proxy/index.ts`：`SYSTEM_PROMPTS` 分发表同步加 `spotInfo`（**两文件 systemPrompt 原样一致，改动必须双侧同步**，文件头注释已约定）
- 修改 `src/stores/scenicStore.ts`：新增 `updateSpot`
- 修改 `src/views/AiOrganizeView.vue`：三行激活 + 各自批量面板（勾选/进度/预览/确认/拒绝）

**接口/数据结构（TS）**
```ts
// src/utils/aiOrganize.ts
export function pickUntaggedMemories(memories: TravelMemory[]): TravelMemory[]
export function pickSpotsMissingCoords(spots: ScenicSpot[]): ScenicSpot[]
export function pickSpotsMissingDesc(spots: ScenicSpot[]): ScenicSpot[]
export function mergeTags(existing: string[], incoming: string[]): string[]  // trim+去重+保序，上限 8 个

// src/utils/aiClient.ts 新增
export interface SpotInfoRequest { spotName: string; city: string; province?: string }
export interface SpotInfoResult { description: string; bestSeason?: string }
export async function describeSpot(input: SpotInfoRequest, cfg: AiConfig | null = getAiConfig()): Promise<SpotInfoResult | null>
// 形状校验 isSpotInfoResult：description 为非空 string 才通过；bestSeason 可缺省。
```

**实现要点与注意**
- 批量执行统一模式：`for...of` 串行 + `try/catch`（aiClient 本身不 throw，但仍包一层）；进度 `ref({ done, total })` 显示「第 i / N 条」；结果数组 `{ item, payload | null, status: 'ok'|'fail' }`。
- 预览后交互：提供「全部确认 / 全部拒绝」+ 每条独立确认按钮；确认循环调 store 更新，失败项提示「已跳过」。
- 未配置 AI：自动标签与信息补全按钮禁用 + 常显提示（沿用现 `org-hint`）；坐标兜底不受限。
- 勾选上限：单批 ≤ 20 条，防 token 成本失控（超限提示截取前 20）。
- 5.7 检查：AI 标签/描述**展示与写入前**过 `checkContent`（safe=false 标红 + 不允许确认，防止脏词入库）。
- 5.8 埋点：`trackAiUse('autoTag'|'spotInfo'|'coords', ok)`（按批量结果总体成功/失败记一次）。

**完成=以下验收可通过**
1. 坐标兜底：断网状态下，对 lat/lng 为 0 的景点批量解析 → 预览显示提议坐标（来源 local）→ 确认后景点坐标更新并可持久化；未命中景点保持 0 并计入失败数。
2. 自动标签（已配置 AI）：勾选 2 条无标签回忆 → 批量执行显示进度 → 预览建议标签 → 确认后 tags 合并写入并持久化；拒绝不写入。未配置时按钮禁用。
3. 信息补全：对无 description 景点生成描述，写入值含「（AI 生成，请核实）」；单条失败跳过，汇总「成功 N / 失败 M」。
4. 三功能均有「全部确认/全部拒绝/逐条确认」，执行中按钮防重复点击。
5. `npm run build` 通过。

**实施顺序**：1) `scenicStore.updateSpot` + `aiClient.describeSpot` + Edge Function 同步 → 2) `aiOrganize.ts` 纯函数 → 3) 坐标兜底面板（零风险先做）→ 4) 自动标签面板 → 5) 信息补全面板 → 6) 接 5.7/5.8。

---

## 任务 5.7：AI 内容安全过滤（P1）

**目标**：为公开分享（Phase 6）做准备——对 AI 生成内容（行程/解读/标签/描述）与用户回忆做敏感词检查。方案：本地敏感词库先落地（零依赖、零 Key），远程审核 API（阿里云/腾讯）留 P2 扩展点，不引入真实 Key。

**文件清单**
- 新增 `src/utils/contentFilter.ts`：敏感词库 + 检查函数 + 远程审核扩展接口
- 修改 `src/views/AiInsightsView.vue`：AI 解读展示前过滤
- 修改 `src/views/AiPlanView.vue`：行程结果展示前过滤
- 修改 `src/views/AiOrganizeView.vue`：标签/描述预览与写入前过滤
- Phase 6 预留：分享导出前强制 `checkContent`（本任务只留调用点注释/函数，不实现分享）

**接口/数据结构（TS）**
```ts
// src/utils/contentFilter.ts
export interface ContentCheckResult { safe: boolean; hits: string[] }  // hits 去重、保序
export const SENSITIVE_WORDS: string[]   // 公开常识基础词：不当言论/暴力/色情三大类各 10-20 个，注释标注分类与「仅基础库，不可替代合规审核」
export function checkContent(text: string): ContentCheckResult          // 子串匹配（转小写后匹配，防大小写绕过）
export function checkTexts(texts: string[]): ContentCheckResult         // 多段合并检查（行程 days 逐段）
export function maskContent(text: string, hits: string[]): string       // 命中词替换为 *，供展示降级
// P2 扩展点（预留，本任务不实现、不发请求）：
export interface RemoteAuditor { audit(text: string): Promise<ContentCheckResult | null> }
export const remoteAuditor: RemoteAuditor | null = null
```

**实现要点与注意**
- 词库来源：仅从公开常识/公开合规清单构建（不当言论、暴力、色情基础词），每词注释类别；文件头注明「基础本地库，覆盖率有限；公开分享上线前必须接入审核 API（见 PHASE6 6.5）」。
- 调用时机：AI 生成结果**展示前** checkContent → safe=false 时不展示原文，展示「内容未通过安全校验，已隐藏」占位（hits 可 debug 打印）；自动标签/描述预览时命中项标红且确认按钮禁用。
- 用户回忆：`MemoryFormView` 保存时软提示（不阻断保存，仅 warn 级提示，P2 可升级为阻断）——本轮可只留调用点注释。
- `checkContent` 输入容错：null/undefined/空串 → `{ safe: true, hits: [] }`；不做正则、不做分词，纯 includes，避免误杀与性能问题。
- 不引入任何 Key、不发网络请求；`remoteAuditor` 恒 null（P2 接入时替换为真实实现并保留本地兜底）。

**完成=以下验收可通过**
1. `checkContent('正常文本')` → `{ safe: true, hits: [] }`；`checkContent` 含任一敏感词 → `{ safe: false, hits: [命中词] }`，hits 去重。
2. 行程/解读/标签结果中含敏感词时，页面不展示原文，显示「内容未通过安全校验，已隐藏」。
3. 自动标签/信息补全预览中命中词标红，确认按钮禁用（不写入 store）。
4. 空文本/非字符串输入不抛错。
5. `npm run build` 通过；全程零网络请求（DevTools Network 面板无新增请求）。

**实施顺序**：1) `contentFilter.ts` + 词库 → 2) AiInsightsView 解读过滤 → 3) AiPlanView 行程过滤 → 4) AiOrganizeView 预览过滤 → 5) Phase 6 分享入口注释预留。

---

## 任务 5.8：AI 使用埋点 + 反馈（👍/👎，P2）

**目标**：AI 功能使用计数（成功/失败）+ 行程结果 👍/👎 反馈，全部落 localStorage（独立 key，不接外部分析）；提供查看/导出/清空入口。

**文件清单**
- 新增 `src/utils/aiTracking.ts`：埋点与反馈读写（独立 key）
- 新增 `src/components/AiUsagePanel.vue`：统计展示 + 反馈列表 + 导出/清空
- 修改 `src/views/AiPlanView.vue`：结果底部加 👍/👎 反馈条 + 生成成功/失败埋点
- 修改 `src/views/AiInsightsView.vue`、`AiOrganizeView.vue`：各动作成功/失败埋点
- 修改 `src/views/DataManageView.vue`：tab-bar 新增「AI 使用」tab，挂载 AiUsagePanel

**接口/数据结构（TS）**
```ts
// src/utils/aiTracking.ts
export type AiAction = 'itinerary' | 'insights' | 'autoTag' | 'spotInfo' | 'coords' | 'shareCard'
export interface AiFeedbackRecord { action: AiAction; rating: 'up' | 'down'; summary?: string; at: string }
export interface AiUsageSummary { [action: string]: { success: number; fail: number } }
export const AI_USAGE_KEY = 'travel_footprint_ai_usage'        // 独立 key，与数据/同步队列隔离
export const AI_FEEDBACK_KEY = 'travel_footprint_ai_feedback'  // 同上
export function trackAiUse(action: AiAction, ok: boolean): void
export function trackAiFeedback(action: AiAction, rating: 'up' | 'down', summary?: string): void
export function getAiUsage(): AiUsageSummary
export function getAiFeedback(): AiFeedbackRecord[]
export function clearAiUsage(): void
export function exportAiUsage(): string   // JSON 字符串（下载文件用）
```

**实现要点与注意**
- 全部读写包 `try/catch`：localStorage 满/禁用时静默降级，绝不影响主流程；读失败视为空对象。
- 计数结构固定 `{ [action]: { success, fail } }`，无 action 时初始化 `{ success: 0, fail: 0 }`。
- 反馈列表容量上限 100 条（超出丢最旧）；`summary` 截断 ≤ 50 字（如「目的地：成都」）；重复点击 👍/👎 同一结果只记一次（已评状态禁用按钮，刷新后重置）。
- 埋点调用点：AiPlanView 提交后（plans 非 null=success，null=fail）；AiInsightsView 解读生成；AiOrganizeView 三功能批量；YearlyShareCard 生成。坐标兜底成功/失败按批量总体记一次。
- 入口：DataManageView 新增 tab「AI 使用」，面板含「使用次数（按动作、成功/失败）」「反馈列表（动作/👍👎/时间/摘要）」「导出 JSON」「清空」按钮。
- 与同步完全隔离：不经过 patchState/enqueueChange；key 前缀 `travel_footprint_ai_*` 与 `travel_footprint_data`/`travel_footprint_sync_*` 互不相干。

**完成=以下验收可通过**
1. 生成行程成功 → `travel_footprint_ai_usage` 中 `itinerary.success` +1；失败（超时/结构不符）→ `fail` +1。
2. 行程结果底部 👍/👎 可点 → `travel_footprint_ai_feedback` 新增一条（含 action/rating/时间/摘要）；同结果重复点不重复记录。
3. 洞察/自动标签/信息补全/坐标/分享卡各自正确计数成功/失败。
4. 数据管理页「AI 使用」tab 可查看计数与反馈、导出 JSON 文件、一键清空。
5. localStorage 异常（手动塞坏数据）时页面正常、不报错。
6. `npm run build` 通过；AI 埋点 key 不出现在同步队列/导出数据中。

**实施顺序**：1) `aiTracking.ts` → 2) AiPlanView 反馈条 + 埋点（效果最直观）→ 3) AiInsightsView/AiOrganizeView/YearlyShareCard 埋点 → 4) AiUsagePanel + DataManageView tab → 5) 边界（重复点击/坏数据）验证。

---

## 跨任务依赖与总实施顺序

- **5.7 contentFilter 复用关系**：被 5.5（卡片含 AI 寄语时展示前检查，默认卡片不含可不依赖）、5.6（标签/描述预览与写入前检查）、5.7 自身（行程/解读展示）复用；**5.8 不直接依赖 5.7**（反馈只记 👍/👎，不审内容），但建议 5.8 在 5.6 之后做，保证 `AiAction` 全集已确定。
- **5.6 依赖**：`aiClient.autoTag`（已有）复用；`describeSpot`（新增）依赖 aiClient 与 Edge Function 双侧同步（AiAction + 'spotInfo'）；坐标兜底依赖 `geoResolver.resolveCityCoords`/`cityCoords`（已有）+ `scenicStore.updateSpot`（新增）。5.6 不依赖 5.7/5.8，但接入时顺手挂检查与埋点。
- **5.5 依赖**：`insightStats.computeYearlyInsights`（已有）取数；cityPins 从 `footprintStore.visitedCities` 取 lat/lng；可选依赖 5.7。
- **5.8 依赖**：仅各调用点（5.2/5.3 行程、5.4 洞察、5.6 整理、5.5 卡片），自身无前置工具。
- **推荐总顺序**：5.7（小、零风险，先立工具）→ 5.6（坐标 → 标签 → 补全）→ 5.5（卡片）→ 5.8（收尾，计数覆盖全部动作）。5.5/5.6 可并行，但两者在接入展示/写入时都应复用 5.7。
