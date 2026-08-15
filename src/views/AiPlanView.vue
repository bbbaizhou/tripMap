<script setup lang="ts">
import { ref } from 'vue'
import { generateItinerary, isAiConfigured, type DayPlan } from '../utils/aiClient'

// 构建期静态替换：无 .env 时返回 false → 按钮禁用 + 常显提示，零请求。
const aiConfigured = isAiConfigured()

const planForm = ref({
  destination: '',
  days: 3,
  style: '自然',
  budget: '',
  companions: '',
  startDate: '',
})

const formError = ref('')
const generating = ref(false)
const submitted = ref(false)
const plans = ref<DayPlan[] | null>(null)

/** days 合法范围 1-15，越界 clamp（@change 与提交时各执行一次）。 */
const normalizeDays = () => {
  const raw = Number(planForm.value.days)
  planForm.value.days = Number.isFinite(raw) ? Math.min(15, Math.max(1, Math.round(raw))) : 1
}

const submitPlan = async () => {
  formError.value = ''
  if (!planForm.value.destination.trim()) {
    formError.value = '请填写目的地'
    return
  }
  normalizeDays()
  plans.value = null
  submitted.value = true
  if (!aiConfigured) return // 按钮已禁用，此处兜底：未配置时绝不触达生成函数
  generating.value = true
  try {
    // 骨架：当前恒返回 null（占位），Phase 5.2 接入真实调用后此处直接生效。
    plans.value = await generateItinerary({
      destination: planForm.value.destination.trim(),
      days: planForm.value.days,
      style: planForm.value.style,
      budget: planForm.value.budget.trim() || undefined,
      companions: planForm.value.companions.trim() || undefined,
      startDate: planForm.value.startDate || undefined,
    })
  } finally {
    generating.value = false
  }
}

/** 测试辅助：写入硬编码 2 天 fixture，使卡片流渲染可无 Key 验收。 */
const previewSample = () => {
  plans.value = [...SAMPLE_ITINERARY]
  submitted.value = false
}

const SAMPLE_ITINERARY: DayPlan[] = [
  {
    day: 1,
    title: '蓉城初印象：老城文化与烟火美食',
    spots: [
      { name: '宽窄巷子', city: '成都', level: '4A', duration: 3, tip: '建议上午前往，游客相对较少' },
      { name: '武侯祠', city: '成都', level: '4A', duration: 2 },
      { name: '锦里古街', city: '成都', level: '4A', duration: 2, tip: '傍晚灯笼亮起后氛围更佳' },
    ],
    budget: '约 300 元',
    tips: '市区内建议地铁 + 共享单车，餐饮以火锅与小吃为主',
  },
  {
    day: 2,
    title: '都江堰—青城山一日游',
    spots: [
      { name: '都江堰景区', city: '成都', level: '5A', duration: 4, tip: '提前线上预约门票' },
      { name: '青城山', city: '成都', level: '5A', duration: 5 },
    ],
    budget: '约 400 元',
    tips: '青城山建议缆车上行、步行下行，节省体力',
  },
]
</script>

<template>
  <section class="plan-view">
    <div class="plan-header">
      <h2>AI 行程规划</h2>
      <p>输入目的地与偏好，生成每日行程建议</p>
    </div>

    <div class="plan-form-card">
      <div v-if="formError" class="form-error">{{ formError }}</div>
      <div class="form-grid">
        <div class="fg">
          <label>目的地 *</label>
          <input v-model="planForm.destination" class="fi" placeholder="如：成都" />
        </div>
        <div class="fg">
          <label>行程天数</label>
          <input v-model.number="planForm.days" type="number" min="1" max="15" class="fi" @change="normalizeDays" />
        </div>
        <div class="fg">
          <label>旅行风格</label>
          <select v-model="planForm.style" class="fi">
            <option>自然</option>
            <option>人文</option>
            <option>美食</option>
            <option>亲子</option>
            <option>穷游</option>
            <option>深度</option>
          </select>
        </div>
        <div class="fg">
          <label>预算（元）</label>
          <input v-model="planForm.budget" class="fi" placeholder="如：3000" />
        </div>
        <div class="fg">
          <label>同行人</label>
          <input v-model="planForm.companions" class="fi" placeholder="如：3 人" />
        </div>
        <div class="fg">
          <label>出发日期</label>
          <input v-model="planForm.startDate" type="date" class="fi" />
        </div>
      </div>

      <!-- 未配置：常显提示，不发请求 -->
      <div v-if="!aiConfigured" class="form-hint plan-hint">
        AI 能力未配置：请在 <code>.env.example</code> 中填写 <code>VITE_AI_API_KEY</code> 后重启开发服务器
      </div>

      <div class="plan-actions">
        <button class="submit-btn" :disabled="!aiConfigured || generating" @click="submitPlan">
          {{ generating ? '生成中…' : '生成行程' }}
        </button>
        <button class="preview-btn" @click="previewSample">预览示例行程</button>
      </div>
    </div>

    <!-- 已配置但骨架未接入：空态 -->
    <div v-if="submitted && !plans" class="plan-empty">
      <p>行程生成服务接入中（TODO Phase 5.2）</p>
    </div>

    <!-- 日卡片流渲染 -->
    <div v-if="plans && plans.length" class="plan-results">
      <article v-for="plan in plans" :key="plan.day" class="day-card">
        <div class="ai-badge">AI</div>
        <h3 class="day-title">第 {{ plan.day }} 天 · {{ plan.title }}</h3>
        <ul class="spot-list">
          <li v-for="spot in plan.spots" :key="spot.name" class="spot-row">
            <span class="spot-name">{{ spot.name }}</span>
            <span class="spot-meta">{{ spot.city }} · {{ spot.level }} · 建议停留 {{ spot.duration }} 小时</span>
            <span v-if="spot.tip" class="spot-tip">{{ spot.tip }}</span>
          </li>
        </ul>
        <div v-if="plan.budget" class="day-budget">当日预算：{{ plan.budget }}</div>
        <div v-if="plan.tips" class="day-tips">小贴士：{{ plan.tips }}</div>
      </article>
      <p class="ai-compliance-note">内容由 AI 生成，仅供参考</p>
    </div>
  </section>
</template>

<style scoped>
.plan-view {
  padding: var(--space-lg);
  max-width: 860px;
  margin: 0 auto;
}

.plan-header {
  margin-bottom: var(--space-lg);
}

.plan-header h2 {
  margin: 0 0 var(--space-xs);
  color: var(--color-text-primary);
}

.plan-header p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.plan-form-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
}

/* 复用 DataManageView 的 form 样式语言 */
.form-error {
  background: #fef2f2;
  color: #dc2626;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  margin-bottom: 14px;
  font-size: var(--font-size-sm);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 12px;
}

.fg {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.fg label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.fi {
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  outline: none;
  box-sizing: border-box;
  width: 100%;
}

.fi:focus {
  border-color: var(--color-primary-light);
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

.plan-hint code {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.plan-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.submit-btn {
  padding: 10px 28px;
  background: var(--color-primary-light);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary);
}

.submit-btn:disabled {
  background: #c8d6c9;
  cursor: not-allowed;
}

.preview-btn {
  padding: 10px 20px;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.preview-btn:hover {
  background: var(--color-primary-lighter);
}

.plan-empty {
  margin-top: var(--space-lg);
  padding: var(--space-lg);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* 日卡片 */
.plan-results {
  margin-top: var(--space-lg);
}

.day-card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  box-shadow: var(--shadow-card);
}

.ai-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.day-title {
  margin: 0 0 var(--space-md);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.spot-list {
  list-style: none;
  margin: 0 0 var(--space-md);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spot-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.spot-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.spot-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.spot-tip {
  font-size: 12px;
  color: var(--color-primary);
}

.day-budget {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.day-tips {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.ai-compliance-note {
  margin-top: var(--space-md);
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .plan-view {
    padding: var(--space-md);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .plan-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
