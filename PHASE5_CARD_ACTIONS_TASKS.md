# 任务 5.3 规格：AI 行程卡片操作（加入心愿单 / 存回忆草稿 / 复制 Markdown）

> 范围：把 `/ai/plan`（AiPlanView.vue）已生成的 `DayPlan[]` 卡片流与 scenicStore / memoryStore 打通。
> 状态：规划 Agent 输出，未改动任何代码。前置阅读已核对（AiPlanView、aiClient、scenicStore、memoryStore、cityCoords、DataManageView、types、router）。

## 0. 组件拆分决策（规划 Agent 决定）

- **新增 `AiDayPlanCard.vue`**（纯展示 + 事件上抛）：渲染单张日卡片（日标题/spot 行/预算/Tips），spot 行尾提供「加入心愿单」小按钮。**不直接操作 store**，只读状态由父组件注入 props（`addedSpotIds: string[]`），点击仅 `emit('add-to-wishlist', spot: DaySpot)`。
- **页面级操作栏留在 `AiPlanView.vue`**：底部操作栏（存为回忆草稿 / 复制 Markdown）需要 `planForm`（目的地/天数/风格/同伴/出发日期）、完整 `plans`、router 跳转与全局反馈条，天然属于父组件；三个操作的 store 写入**统一收敛在父组件**（唯一写入口，便于 try/catch 与提示）。
- **纯逻辑全部放 `src/utils/aiPlanActions.ts`**：id 生成、level 归一、DaySpot→ScenicSpot 映射、草稿构造、Markdown 格式化。组件保持薄，函数可独立验证，日后补单测无需渲染。

## 1. 目标与验收标准（每条操作独立，可测试）

### 操作 1：加入心愿单（scenicStore）
- A1-1 生成行程（真机或「预览示例行程」fixture）后，每张日卡片内每个 spot 行尾显示「加入心愿单」小按钮。
- A1-2 点击后：`scenicStore.spots` 新增 1 条 ScenicSpot，字段满足 §3 构造示例；按钮变为「已加入」且 `disabled`。
- A1-3 去重：同一行程重复点击已加入按钮无效（disabled）；重新生成同名行程后按钮直接为「已加入」；`scenicStore.spots` 中该 `spotId` 只有 1 条（`addSpot` 已有按 spotId 去重，双保险）。
- A1-4 确定性：`spotId === 'ai-' + city.trim() + '-' + name.trim()`，同景点跨次生成 id 相同。
- A1-5 level 兜底：AI 返回 `'必游'`/`'世界遗产'`/空串 等非 4A/5A 值时，落库 `level === '5A'`（原值可拼入 description 备注，见 §3）。
- A1-6 坐标兜底：`findCityCoords(spot.city)` 命中则写入其 lat/lng/province；未命中则 `lat:0,lng:0`、`province:''`（不抛错）。
- A1-7 跳转 `/scenic` 心愿单视图可见该景点（ScenicSpotCard 展示 `city · province` 与 type「AI 推荐」）。
- A1-8 异常：`addSpot` 抛错（如存储异常）→ 显示 `.form-error` 提示，页面不崩溃。

### 操作 2：存回忆草稿（memoryStore）
- A2-1 点击「存为回忆草稿」→ `memoryStore.addMemory` 新增 1 条 TravelMemory，字段满足 §3；`memoryStore.memories` 长度 +1。
- A2-2 `title === '{destination} {days}日行程（AI 生成）'`；`startDate/endDate` 基于表单出发日期（无则今天）推算，`endDate = startDate + (days-1)` 天。
- A2-3 `content` 为完整可读文本：按天分段，含景点（名称/城市/时长/tip）、当日预算、当日 Tips，可被 MemoryFormView 直接编辑。
- A2-4 `tags === [style, 'AI 行程']`（去重后）；`cities` 为行程中出现的城市按出现顺序去重；`companions` 为表单同伴文本按 `[,，、]` 拆分；`spotIds` 为**已加入心愿单**的 spotId 列表（保存时经 scenicStore 反查，见 §3）。
- A2-5 成功后显示 `.form-success` 提示（含「内容由 AI 生成，请核实」）+ 「前往查看」入口 → `router.push('/memories')`；新草稿在列表可见，进 `/memory/:id/edit` 可编辑成正式回忆。
- A2-6 重复点击每次新增一条草稿（草稿语义，不幂等；如后续需要防重再评估）。
- A2-7 异常：`addMemory` 抛错 → `.form-error`，不崩溃。

### 操作 3：复制 Markdown
- A3-1 点击「复制 Markdown」→ 优先 `navigator.clipboard.writeText`；成功显示 `.form-success`「已复制 Markdown（内容由 AI 生成，请核实）」。
- A3-2 产物可直接粘贴到任意 Markdown 编辑器：以 `# {destination} {days}日行程（AI 生成）` 开头，含 `## 第 X 天 · {title}`、`- 景点（城市 · 建议停留 N 小时）`、当日预算、Tips（格式见 §3）。
- A3-3 降级：非安全上下文或 clipboard API 抛错 → `document.execCommand('copy')` 兜底（临时 textarea + select）；成功同样提示「已复制」。
- A3-4 双路径均失败 → `.form-error`「复制失败，请手动复制」，不崩溃。

### 跨操作统一
- A-C1 三个操作均在 AiPlanView 内以 try/catch 包裹 store/剪贴板调用；反馈统一走页面顶部单条提示条（`.form-success`/`.form-error`），约 3s 自动消失（组件卸载时 clearTimeout）。
- A-C2 AI 内容操作成功的提示均附注「内容由 AI 生成，请核实」。
- A-C3 未引入任何新依赖；未改 store/aiClient/router/types API；`isAiConfigured` 短路与 `previewSample` 降级路径不受影响（fixture 同样可执行三操作）。
- A-C4 `npm run build`（`vue-tsc -b`）通过，无 TS 错误。

## 2. 文件清单（精确路径）

| 动作 | 路径 | 内容 |
|---|---|---|
| 新增 | `src/utils/aiPlanActions.ts` | 纯函数：`toSpotId`、`normalizeSpotLevel`、`toScenicSpot`、`splitCompanions`、`buildMemoryDraft`、`plansToMarkdown` |
| 新增 | `src/views/AiDayPlanCard.vue` | 单日卡片展示组件（props: `plan: DayPlan`, `addedSpotIds: string[]`；emit: `add-to-wishlist`） |
| 修改 | `src/views/AiPlanView.vue` | 三操作接线、底部操作栏、全局反馈条、`.form-success` 样式（从 DataManageView 复制）、日卡片替换为 AiDayPlanCard |

不改：`src/stores/*`、`src/utils/aiClient.ts`、`src/types/index.ts`、`src/router/index.ts`；零新依赖（clipboard 用原生 API）。

## 3. 接口 / 数据结构（构造示例）

```ts
// utils/aiPlanActions.ts 导出的纯函数契约（types 复用 aiClient.ts / types/index.ts）
export function toSpotId(spot: DaySpot): string                       // `ai-${spot.city.trim()}-${spot.name.trim()}`
export function normalizeSpotLevel(level: string): SpotLevel          // 精确 '4A'/'5A' → 自身；包含 '5A'→'5A'；包含 '4A'→'4A'；其余兜底 '5A'
export function toScenicSpot(spot: DaySpot): ScenicSpot
export function splitCompanions(raw: string): string[]                // split(/[,，、]/).map(trim).filter(Boolean)
export function buildMemoryDraft(input: ItineraryRequest, plans: DayPlan[], linkedSpotIds: string[]): TravelMemory
export function plansToMarkdown(input: ItineraryRequest, plans: DayPlan[]): string

// ScenicSpot 构造（操作 1）
{
  spotId: `ai-${spot.city.trim()}-${spot.name.trim()}`, // 确定性，防重复
  spotName: spot.name.trim(),
  level: normalizeSpotLevel(spot.level),                // 非 4A/5A → '5A'（兜底）
  city: spot.city.trim(),
  province: findCityCoords(spot.city)?.province ?? '',  // 本地坐标库兜底
  type: 'AI 推荐',                                      // 与手动 '自然风光' 等区分，ScenicView 可辨识
  status: 'wishlist',
  relatedMemoryIds: [],
  lat: findCityCoords(spot.city)?.lat ?? 0,             // 未命中 → 0，不抛错
  lng: findCityCoords(spot.city)?.lng ?? 0,
  description: spot.tip?.trim() || undefined,           // AI tip 作简介；level 兜底时拼 `【AI 标记：${原值}】`
}

// TravelMemory 构造（操作 2）
{
  memoryId: `m${Date.now()}`,                 // 与 MemoryFormView 一致
  title: `${input.destination} ${input.days}日行程（AI 生成）`,
  startDate: input.startDate ?? 今天(YYYY-MM-DD),
  endDate: startDate 本地日期 + (days - 1) 天, // 用 setDate 本地算术，避免 UTC 偏移
  companions: splitCompanions(input.companions ?? ''),
  tags: [...new Set([input.style, 'AI 行程'])],   // 去重防御
  cost: undefined,                            // AI 预算为文本，不强行转 number（防脏数据）
  content: plansToText(input, plans),         // 见下「content 结构」，完整可读
  images: [],
  cities: 全行程 spot.city 按出现顺序去重,
  spotIds: linkedSpotIds,                     // = plans 全部 spots 中 scenicStore.getSpotById(toSpotId(s)) 命中的 spotId（保存时反查）
  createdAt: now, updatedAt: now,             // new Date().toISOString()
}

// content 结构（操作 2，逐天完整文本）
【{destination} {days}日行程】 风格：{style}；预算：{budget||未指定}；同行：{companions||未指定}

第 1 天 · {title}
- {name}（{city} · 建议停留 {duration} 小时）
  {tip}
当日预算：{budget}
小贴士：{tips}
…（每天一段）
（内容由 AI 生成，仅供参考，出行前请核实）

// Markdown 产物（操作 3）
# {destination} {days}日行程（AI 生成）
> 风格：{style} · 预算：{budget||未指定} · 同行人：{companions||未指定}

## 第 1 天 · {title}
- {name}（{city} · 建议停留 {duration} 小时）
  - {tip}
- 当日预算：{budget}
- 小贴士：{tips}

---
*内容由 AI 生成，仅供参考*
```

## 4. 实现要点与注意

- **写入收敛**：AiDayPlanCard 只发事件；AiPlanView 统一调用 `scenicStore.addSpot` / `memoryStore.addMemory` / 剪贴板，全部 try/catch；`scenicStore.addSpot` 已按 spotId 去重（scenicStore.ts:26），无需改 store。
- **「已加入」状态**：AiPlanView 用 `computed` 得 `addedSpotIds = plans.flatMap(p=>p.spots).map(toSpotId).filter(id=>scenicStore.getSpotById(id))`，作 prop 传入卡片；spot 按钮 `:disabled="addedSpotIds.includes(toSpotId(spot))"`，文案「加入心愿单」↔「已加入」。
- **level 边界**：AI 可能返回 '必游'、'世界遗产'、带空格大小写变体；`normalizeSpotLevel` 先 `trim()` 再精确匹配，否则按包含关系降级，最终兜底 '5A'，并把原值备注进 description（不丢失信息）。
- **确定性 id 边界**：同 (city, name) 同 id 防重；AI 改景点名会产生新 id（属可接受行为，不在本任务去重范围）。注意 spotId 会进 syncService 队列实体 id，保持纯字符串即可。
- **日期推算**：`startDate` 为 `YYYY-MM-DD` 字符串；endDate 用 `new Date(start)` + `setDate(getDate()+days-1)` 本地算术后 `toISOString().slice(0,10)`（或手动格式化为本地日期），避免时区偏移一天。
- **反馈样式**：`.form-success`（`#f0fdf4`/`#15803d`）从 DataManageView.vue:237 复制到 AiPlanView scoped 样式，不新建公共样式；提示条 `setTimeout` 3s 自动清除，`onUnmounted` 清理。
- **复制降级**：先 `navigator.clipboard?.writeText`；抛错或 undefined → 临时 `<textarea>`（`position:fixed;opacity:0`）`select()` + `document.execCommand('copy')`；再失败 → error 提示。execCommand 虽废弃但为唯一非安全上下文兜底，本任务接受。
- **不破坏现有路径**：`isAiConfigured` 短路、空态、`.ai-compliance-note`、`previewSample` 全部保留；新逻辑仅挂在 `plans` 非空分支。
- **无单测基建**（package.json 无 test script）：验收以「手动 + `npm run build`」为准；纯函数放 utils 便于日后补测。
- 组件 CSS 只用现有变量（`--color-*`/`--radius-*`/`--space-*`/`--font-size-*`/`--shadow-card`），不引 Element Plus。

## 5. 「完成 = 以下验收可通过」清单

- [ ] A1-1～A1-8 全过（spot 按钮加入 → 已加入禁用 → 去重 → level/坐标兜底 → /scenic 可见 → 异常提示）
- [ ] A2-1～A2-7 全过（草稿字段正确 → content 完整可读 → 可跳 /memories 并 /edit 继续编辑 → 异常提示）
- [ ] A3-1～A3-4 全过（clipboard 主路径 → execCommand 降级 → 双失败提示）
- [ ] A-C1～A-C4 全过（单条反馈条 + 3s 自动清除；AI 内容提示注明；零新依赖；`npm run build` 通过）
- [ ] `previewSample` fixture 与真实生成两条路径均能执行三操作（降级路径未破坏）

## 6. 实施顺序

1. `src/utils/aiPlanActions.ts`：先 `toSpotId`/`normalizeSpotLevel`/`toScenicSpot`，再 `buildMemoryDraft`，再 `plansToMarkdown`（纯函数，互不依赖，可并行推敲）。
2. `src/views/AiDayPlanCard.vue`：展示 + 事件 + added 态，独立可验收（父组件临时 props 即可跑通）。
3. `src/views/AiPlanView.vue` 接线：操作 1（按钮/去重/提示）→ 操作 2（草稿/跳转）→ 操作 3（复制/降级）→ 反馈条 + `.form-success` 样式。
4. 自测：`previewSample` 走全三操作；https 环境验证 clipboard；`npm run build` 过 TS。
5. 按 §5 清单逐条勾验，向 PRODUCT_RD_PLAN.md 5.6 节验收项回写。
