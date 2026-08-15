<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFootprintStore } from '../stores/footprintStore'
import { useScenicStore } from '../stores/scenicStore'
import { useMemoryStore } from '../stores/memoryStore'
import { computeYearlyInsights, getInsightYears } from '../utils/insightStats'
import { generateInsights, isAiConfigured } from '../utils/aiClient'
import { checkContent, UNSAFE_HIDDEN_TEXT } from '../utils/contentFilter'
import { trackAiUse } from '../utils/aiTracking'
import YearlyShareCard from '../components/YearlyShareCard.vue'

const footprintStore = useFootprintStore()
const scenicStore = useScenicStore()
const memoryStore = useMemoryStore()

// 与 store 解耦的普通数组，直接喂给纯函数聚合
const sourceData = computed(() => ({
  cities: footprintStore.visitedCities,
  spots: scenicStore.spots,
  memories: memoryStore.memories,
}))

const years = computed(() => getInsightYears(sourceData.value))
const selectedYear = ref('')

// 默认选中最近年份；数据变更后保持有效年份
watch(years, (list) => {
  if (list.length && (!selectedYear.value || !list.includes(selectedYear.value))) {
    selectedYear.value = list[0]
  }
}, { immediate: true })

const stats = computed(() => {
  if (!selectedYear.value) return null
  return computeYearlyInsights(sourceData.value, selectedYear.value)
})

const statCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: '到访城市', value: String(s.cityCount) },
    { label: '覆盖省份', value: String(s.provinceCount) },
    { label: '打卡景点', value: String(s.spotCount) },
    { label: '回忆篇数', value: String(s.memoryCount) },
    { label: '旅行天数', value: String(s.totalDays) },
    { label: '旅行花费', value: `¥${s.totalCost}` },
  ]
})

// AI 解读：未配置 → 占位；已配置 → 调 generateInsights（骨架返回 null → 接入中空态）
const aiConfigured = isAiConfigured()
const insights = ref<string[] | null>(null)
const insightsLoading = ref(false)

watch(selectedYear, async (year) => {
  insights.value = null
  if (!year || !aiConfigured) return // 未配置：绝不触达生成函数（零请求）
  insightsLoading.value = true
  let result: string[] | null = null
  try {
    result = await generateInsights({ year, stats: computeYearlyInsights(sourceData.value, year) })
    insights.value = result
  } finally {
    insightsLoading.value = false
  }
  // 5.8 埋点：解读生成成功（非空结果）/ 失败（null 或空）
  trackAiUse('insights', Array.isArray(result) && result.length > 0)
  // 5.7 内容安全：AI 解读展示前过滤，命中敏感词时不展示原文（hits 仅 debug 打印）
  if (insights.value && insights.value.length) {
    const unsafeHits = insights.value
      .map((item) => checkContent(item))
      .filter((r) => !r.safe)
    if (unsafeHits.length) {
      console.warn('[AiInsights] 解读含未通过安全校验的内容，已隐藏', unsafeHits)
    }
  }
})

/** 展示用解读列表：每条附带 5.7 安全检查结果（safe=false 显示占位，不展示原文）。 */
const insightChecks = computed(() =>
  (insights.value ?? []).map((item) => {
    const result = checkContent(item)
    return { text: item, safe: result.safe }
  }),
)

// 分享卡片（任务 5.5）：6 项统计（stats null 时传 null → 组件禁用）与足迹城市点线装饰数据
const shareStats = computed(() => (stats.value ? statCards.value : null))
const cityPins = computed(() =>
  footprintStore.visitedCities
    .filter((c) => c.lat !== 0 || c.lng !== 0)
    .map((c) => ({ name: c.cityName, lat: c.lat, lng: c.lng })),
)
</script>

<template>
  <section class="insights-view">
    <div class="insights-header">
      <h2>足迹数据洞察</h2>
      <p>按年份查看足迹统计与 AI 个性化解读</p>
    </div>

    <!-- 未配置：常显降级标注（独立于数据分支，保证任何状态下可见） -->
    <div v-if="!aiConfigured" class="ai-unconfigured-note">
      AI 能力未配置：配置后生成个性化解读
    </div>

    <!-- 无数据空态 -->
    <div v-if="!years.length" class="empty-hint">
      暂无足迹数据：先去「管理」页添加城市足迹，或写一篇旅行回忆吧
    </div>

    <template v-else>
      <div class="year-picker">
        <label for="year-select">统计年份</label>
        <select id="year-select" v-model="selectedYear" class="year-select">
          <option v-for="year in years" :key="year" :value="year">{{ year }} 年</option>
        </select>
      </div>

      <!-- 6 项统计数字卡（视觉参考 FootprintStats.vue） -->
      <div class="stat-grid">
        <article v-for="card in statCards" :key="card.label" class="stat-card">
          <div class="stat-title">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
        </article>
      </div>

      <!-- AI 解读区 -->
      <div class="insight-section">
        <h4>AI 年度解读</h4>
        <div v-if="!aiConfigured" class="insight-placeholder">
          AI 能力未配置：配置后生成个性化解读
        </div>
        <div v-else-if="insightsLoading" class="insight-placeholder">解读生成中…</div>
        <div v-else-if="insightChecks.length" class="insight-list">
          <p
            v-for="(item, index) in insightChecks"
            :key="index"
            class="insight-item"
            :class="{ 'insight-unsafe': !item.safe }"
          >
            {{ item.safe ? item.text : UNSAFE_HIDDEN_TEXT }}
          </p>
          <p class="insight-note">内容由 AI 生成，仅供参考</p>
        </div>
        <div v-else class="insight-placeholder">解读生成失败，请稍后重试</div>
      </div>

      <!-- 年度报告分享卡片（任务 5.5：Canvas 1080×1080 绘制 → PNG 预览/下载/复制） -->
      <YearlyShareCard :year="selectedYear" :stats="shareStats" :city-pins="cityPins" />
    </template>
  </section>
</template>

<style scoped>
.insights-view {
  padding: var(--space-lg);
  max-width: 960px;
  margin: 0 auto;
}

.insights-header {
  margin-bottom: var(--space-lg);
}

.insights-header h2 {
  margin: 0 0 var(--space-xs);
  color: var(--color-text-primary);
}

.insights-header p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.ai-unconfigured-note {
  margin-bottom: var(--space-lg);
  padding: 10px 14px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.empty-hint {
  padding: var(--space-lg);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.year-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-lg);
}

.year-picker label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.year-select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  outline: none;
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.year-select:focus {
  border-color: var(--color-primary-light);
}

/* 统计卡（参考 FootprintStats.vue） */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-card);
}

.stat-title {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.stat-value {
  margin-top: 12px;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

/* AI 解读区 */
.insight-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-card);
}

.insight-section h4 {
  margin: 0 0 var(--space-md);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.insight-placeholder {
  padding: var(--space-md);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.insight-item {
  margin: 0;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.7;
}

/* 5.7：未通过安全校验的解读占位（不展示原文） */
.insight-unsafe {
  color: var(--color-text-secondary);
  font-style: italic;
  background: #fef2f2;
  border: 1px dashed #fca5a5;
}

.insight-note {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: right;
}

@media (max-width: 768px) {
  .insights-view {
    padding: var(--space-md);
  }

  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
