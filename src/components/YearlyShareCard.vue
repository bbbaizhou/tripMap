<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CARD_SIZE, cardToPngDataUrl, drawYearlyCard, type YearlyCardInput } from '../utils/yearlyCard'
import { trackAiUse } from '../utils/aiTracking'

const props = withDefaults(
  defineProps<{
    year: string
    stats: { label: string; value: string }[] | null // 6 项，value 已格式化（含 ¥）；null=无数据年份
    cityPins: { name: string; lat: number; lng: number }[]
    brand?: string
    footer?: string
  }>(),
  {
    brand: '旅行足迹',
    footer: '旅行足迹 · 用脚步丈量世界',
  },
)

/** 组件状态：idle | rendering | ready | error（规格 5.5）。 */
type CardStatus = 'idle' | 'rendering' | 'ready' | 'error'
const status = ref<CardStatus>('idle')
const copyHint = ref('')

const canvasRef = ref<HTMLCanvasElement | null>(null)

/** 剪贴板可用性：仅安全上下文（HTTPS/localhost）+ 支持 ClipboardItem 才显示「复制图片」。 */
const copySupported = computed(
  () =>
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function',
)

/** 年份或数据变化 → 回到 idle（原卡片失效，需重新生成）。 */
watch(
  () => [props.year, props.stats],
  () => {
    status.value = 'idle'
    copyHint.value = ''
  },
)

const buildInput = (): YearlyCardInput => ({
  year: props.year,
  brand: props.brand,
  stats: props.stats ?? [],
  cityPins: props.cityPins,
  footer: props.footer,
})

const generate = () => {
  if (!props.stats) return // 无数据年份：按钮已禁用 + 提示
  const canvas = canvasRef.value
  if (!canvas) {
    status.value = 'error'
    return
  }
  status.value = 'rendering'
  try {
    // Phase 6 预留：若卡片加入 AI 生成「年度寄语」，此处展示前必须过 checkContent（5.7）——
    // safe=false 时不展示原文，显示「内容未通过安全校验，已隐藏」；本任务默认卡片仅数字+城市名，不依赖 AI。
    drawYearlyCard(canvas, buildInput())
    status.value = 'ready'
    copyHint.value = ''
    // 5.8 埋点：生成成功
    trackAiUse('shareCard', true)
  } catch (err) {
    console.error('[YearlyShareCard] 绘制失败', err)
    status.value = 'error'
    // 5.8 埋点：生成失败
    trackAiUse('shareCard', false)
  }
}

/** 下载 PNG：a[download] 触发，文件名 travel-footprint-{year}.png。 */
const download = () => {
  const canvas = canvasRef.value
  if (!canvas || status.value !== 'ready') return
  try {
    const url = cardToPngDataUrl(canvas)
    const a = document.createElement('a')
    a.href = url
    a.download = `travel-footprint-${props.year}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (err) {
    console.error('[YearlyShareCard] 下载失败', err)
    status.value = 'error'
  }
}

/** 复制图片：canvas.toBlob → ClipboardItem；仅安全上下文可用；失败降级为下载。 */
const copyImage = async () => {
  const canvas = canvasRef.value
  if (!canvas || status.value !== 'ready') return
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('toBlob 返回 null')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    copyHint.value = '已复制图片到剪贴板'
  } catch (err) {
    console.warn('[YearlyShareCard] 复制图片失败，降级为下载', err)
    copyHint.value = '复制失败，已改为下载'
    download()
  }
}
</script>

<template>
  <div class="share-card">
    <div class="share-card-title">年度报告分享卡片</div>
    <p class="share-placeholder">Canvas 1080×1080 绘制年度足迹报告，可下载 PNG 或复制图片</p>

    <!-- 无数据年份：禁用 + 明确提示，不报错 -->
    <div v-if="!stats" class="share-hint">该年份暂无统计数据</div>
    <button class="share-btn" :disabled="!stats || status === 'rendering'" @click="generate">
      {{ status === 'rendering' ? '绘制中…' : '生成分享卡片' }}
    </button>

    <div v-if="status === 'error'" class="share-hint share-error">卡片生成失败，请重试</div>

    <!-- canvas 常驻 DOM（v-show 隐藏），供 drawYearlyCard 直接绘制；预览 CSS 缩放，移动端不溢出 -->
    <div v-show="status === 'ready'" class="card-preview-wrap">
      <canvas ref="canvasRef" class="card-canvas" :width="CARD_SIZE" :height="CARD_SIZE"></canvas>
    </div>

    <div v-if="status === 'ready'" class="card-actions">
      <button class="share-btn" @click="download">下载 PNG</button>
      <button v-if="copySupported" class="share-btn" @click="copyImage">复制图片</button>
    </div>
    <p v-if="copyHint" class="share-hint">{{ copyHint }}</p>
  </div>
</template>

<style scoped>
.share-card {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-align: center;
}

.share-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

.share-placeholder {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.share-btn {
  padding: 8px 20px;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  margin: 0 4px;
}

.share-btn:hover:not(:disabled) {
  background: var(--color-primary-lighter);
}

.share-btn:disabled {
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  cursor: not-allowed;
}

.share-hint {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.share-error {
  color: #dc2626;
}

/* 预览：CSS 缩放（max-width:100%; height:auto），移动端不横向溢出 */
.card-preview-wrap {
  margin-top: var(--space-md);
}

.card-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  margin: 0 auto;
}

.card-actions {
  margin-top: var(--space-md);
}
</style>
