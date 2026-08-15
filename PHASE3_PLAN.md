# Phase 3 规格文档 — 景点打卡模块

> 文档版本：1.0 | 日期：2026-08-09

---

## 一、现状分析

| 文件 | 当前状态 | Phase 3 目标 |
|---|---|---|
| public/data/scenic-spots-base.json | 已创建，18 条数据，12 省 | 作为首次加载的种子数据 |
| src/components/ScenicSpotCard.vue | 已有基础实现（emit、badge、按钮）| 补全心愿单卡片样式、accent 线 |
| src/views/ScenicView.vue | 仅骨架（h2 + 网格）| 完整实现统计卡、筛选栏、打卡/新增 Dialog |
| src/stores/scenicStore.ts | toggleStatus/addSpot/removeSpot 均已就绪 | 补充 loadBaseData() 首次初始化逻辑 |

---

## 二、数据初始化方案

### 问题

scenic-spots-base.json 位于 public/data/，但 storage.ts 的 loadState() 回退到 mockData。
mockData 仅包含少量景点，18 条基础数据不会被自动加载。

### 方案：scenicStore.init() 增加 fetchBaseData 逻辑



合并规则：以 localStorage 中同 spotId 的记录优先（保留用户的 status/visitDate），
base JSON 中未出现的 spotId 追加进去。

### 涉及改动

- src/stores/scenicStore.ts：init() 改为 async，增加 loadBaseData() 私有函数
- src/main.ts 或 App.vue：确保 await scenicStore.init()

---

## 三、ScenicSpotCard.vue 改造规格

### 3.1 现有实现（保留）

- emit：check-in / toggle-wishlist / unmark（已正确定义）
- 等级徽章：4A 绿色 / 5A 橙色（已实现）
- 状态标签：已打卡绿 / 心愿单蓝（已实现）
- 按钮条件渲染三种操作（已实现）
- hover：translateY(-2px) + box-shadow（已实现）

### 3.2 需补充

| 项目 | 说明 |
|---|---|
| 已打卡卡片 | 在现有 border-color:#c8e6c9 基础上增加左侧 3px 绿色 accent 线 |
| 心愿单卡片 | 增加 .is-wishlist 的 border-color:#bfdbfe; background:#f0f7ff |
| 无状态防御 | spot.status 为空时隐藏 status-tag（防御性处理）|

---

## 四、ScenicView.vue 完整实现规格

### 4.1 模板结构（概要）



### 4.2 筛选逻辑（computed: filteredSpots）



### 4.3 省份选项动态生成



### 4.4 空状态（EmptyState 内联）

- 有筛选条件（hasActiveFilter = true）：「暂无符合条件的景点，试试调整筛选条件」+ 重置按钮
- 无筛选条件（数据未加载）：「景点数据加载中…」

---

## 五、CheckInDialog 规格

### 触发链路



### UI 内容



### 确认逻辑



实现方式：原生 div overlay + Teleport to body + v-if，不引入 Element Plus 等第三方 UI 库。

---

## 六、AddSpotDialog 规格

### 表单字段

| 字段 | 类型 | 必填 | 备注 |
|---|---|---|---|
| spotName | text | 是 | 景点名称 |
| level | select（4A/5A）| 是 | 等级 |
| city | text | 是 | 所在城市 |
| province | text/select | 是 | 可下拉已有省份或手动输入 |
| type | text | 否 | 如「自然风光」「古迹遗址」|
| description | textarea | 否 | 简介（max 100字）|
| status | select（visited/wishlist）| 是 | 初始状态 |
| visitDate | date | 条件 | status=visited 时显示 |

### 提交逻辑



### 表单验证

必填字段为空时：对应 input 显示红色边框 + 提示文字，阻止 confirm 提交。

---

## 七、状态流转



注：SpotStatus = 'visited' | 'wishlist'，不新增状态，符合现有类型定义。

---

## 八、逐条验收对照

| # | 验收标准 | 实现位置 |
|---|---|---|
| 1 | 页面加载显示 18 个景点 | scenicStore.init() 中 loadBaseData() 合并逻辑 |
| 2 | 四维筛选实时生效 | filteredSpots computed |
| 3 | 打卡弹出日期选择，确认后变 visited | CheckInDialog + handleCheckIn |
| 4 | 加心愿单切换 wishlist 状态 | handleToggleWishlist → toggleStatus(id, 'wishlist') |
| 5 | 取消打卡退回心愿单，visitDate 清空 | handleUnmark → toggleStatus(id, 'wishlist') |
| 6 | 添加景点 Dialog 可新增自定义景点 | AddSpotDialog + handleAddSpot |
| 7 | 统计数字实时更新 | StatCard 绑定 visitedSpots.length / wishlistSpots.length |
| 8 | 空状态有友好提示 | EmptyState 条件渲染 |

---

## 九、实施顺序

1. **scenicStore.ts** — init() 增加 loadBaseData() async 逻辑（最高优先级）
2. **ScenicSpotCard.vue** — 补全 .is-wishlist 样式和 accent 线
3. **ScenicView.vue** — 按模板结构完整重写，内联 StatCard + EmptyState
4. **CheckInDialog.vue**（新建）— 打卡日期选择弹窗
5. **AddSpotDialog.vue**（新建）— 新增景点表单弹窗
6. **联调验收** — 按第八节逐条检验

---

## 十、关键依赖说明

- 无新增外部库，Dialog 使用原生实现，保持项目风格一致
- spotId 命名：自定义景点用 custom-{timestamp}，避免与 base JSON 冲突
- 数据持久化：依赖现有 watch(spots, () => patchState(...)) 自动写入 localStorage
- SpotStatus 不扩展，不新增 none 状态

---

### Critical Files for Implementation

- e:/vscodeProject/tripMap/src/stores/scenicStore.ts
- e:/vscodeProject/tripMap/src/views/ScenicView.vue
- e:/vscodeProject/tripMap/src/components/ScenicSpotCard.vue
- e:/vscodeProject/tripMap/src/components/CheckInDialog.vue
- e:/vscodeProject/tripMap/src/components/AddSpotDialog.vue

---

Planner: Claude Code | 2026-08-09
