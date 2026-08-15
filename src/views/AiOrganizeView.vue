<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { autoTag, describeSpot, isAiConfigured } from '../utils/aiClient'
import { mergeTags, pickSpotsMissingCoords, pickSpotsMissingDesc, pickUntaggedMemories } from '../utils/aiOrganize'
import { resolveCityCoords } from '../utils/geoResolver'
import { checkContent, checkTexts } from '../utils/contentFilter'
import { trackAiUse } from '../utils/aiTracking'
import { useMemoryStore } from '../stores/memoryStore'
import { useScenicStore } from '../stores/scenicStore'

const aiConfigured = isAiConfigured()
const memoryStore = useMemoryStore()
const scenicStore = useScenicStore()

/** 单批上限（防 token 成本失控；超限提示截取前 20 条）。 */
const BATCH_LIMIT = 20

/** 描述写入时追加的 AI 标注（最小标注方案，无 schema 变更）。 */
const AI_DESC_SUFFIX = '（AI 生成，请核实）'

interface BatchOutcome {
  ok: number
  fail: number
}

/** 串行批量执行：worker 返回成功与否；单条异常记 fail 不中断；每完成一条回调进度。 */
const runSerial = async <T>(
  items: T[],
  worker: (item: T, index: number) => Promise<boolean>,
  onProgress: (done: number, total: number) => void,
): Promise<BatchOutcome> => {
  let ok = 0
  let fail = 0
  const total = items.length
  for (let i = 0; i < total; i++) {
    try {
      if (await worker(items[i], i)) ok++
      else fail++
    } catch (err) {
      console.warn('[AiOrganize] 批量单条执行失败，已跳过', err)
      fail++
    }
    onProgress(i + 1, total)
  }
  return { ok, fail }
}

/** 勾选辅助：切换 id 选中态（数组存储，模板 v-for 友好）。 */
function toggleId(list: Ref<string[]>, id: string): void {
  list.value = list.value.includes(id)
    ? list.value.filter((x) => x !== id)
    : [...list.value, id]
}

// ────────────────────────── 5.6-A 坐标兜底解析（纯本地，零请求，无条件可用） ──────────────────────────
const coordsOpen = ref(false)
const coordsCandidates = computed(() => pickSpotsMissingCoords(scenicStore.spots))
const coordsSelected = ref<string[]>([])
watch(coordsCandidates, (list) => {
  coordsSelected.value = list.map((s) => s.spotId)
}, { immediate: true })

const coordsRunning = ref(false)
const coordsProgress = ref({ done: 0, total: 0 })
const coordsHint = ref('')

interface CoordsPreviewItem {
  spotId: string
  spotName: string
  city: string
  lat: number
  lng: number
  source: string
  status: 'ok' | 'fail'
  confirmed: boolean
  rejected: boolean
}
const coordsPreview = ref<CoordsPreviewItem[]>([])
const coordsSummary = ref('')

const toggleCoordsSelectAll = () => {
  const all = coordsCandidates.value.map((s) => s.spotId)
  coordsSelected.value = coordsSelected.value.length === all.length ? [] : all
}

const runCoords = async () => {
  if (coordsRunning.value) return
  const candidates = coordsCandidates.value.filter((s) => coordsSelected.value.includes(s.spotId))
  if (candidates.length === 0) {
    coordsHint.value = '请先勾选需要解析坐标的景点'
    return
  }
  coordsHint.value = ''
  if (candidates.length > BATCH_LIMIT) {
    coordsHint.value = `共 ${candidates.length} 条，单批最多 ${BATCH_LIMIT} 条，已截取前 ${BATCH_LIMIT} 条`
  }
  const targets = candidates.slice(0, BATCH_LIMIT)
  coordsRunning.value = true
  coordsPreview.value = []
  coordsSummary.value = ''
  coordsProgress.value = { done: 0, total: targets.length }
  const outcome = await runSerial(targets, async (spot) => {
    const result = await resolveCityCoords({ cityName: spot.city, province: spot.province })
    if (!result) {
      coordsPreview.value.push({ spotId: spot.spotId, spotName: spot.spotName, city: spot.city, lat: 0, lng: 0, source: 'local', status: 'fail', confirmed: false, rejected: false })
      return false
    }
    coordsPreview.value.push({ spotId: spot.spotId, spotName: spot.spotName, city: spot.city, lat: result.lat, lng: result.lng, source: result.source, status: 'ok', confirmed: false, rejected: false })
    return true
  }, (done, total) => {
    coordsProgress.value = { done, total }
  })
  coordsRunning.value = false
  // 5.8 埋点：坐标兜底按批量总体成功/失败记一次
  trackAiUse('coords', outcome.ok > 0)
  coordsSummary.value = `解析完成：成功 ${outcome.ok} / 失败 ${outcome.fail}（未命中景点保持 0，0 坐标）`
}

const confirmCoordsItem = (item: CoordsPreviewItem) => {
  if (coordsRunning.value || item.status !== 'ok' || item.confirmed) return
  try {
    scenicStore.updateSpot(item.spotId, { lat: item.lat, lng: item.lng })
    item.confirmed = true
    item.rejected = false
  } catch (err) {
    console.error('[AiOrganize] 坐标写入失败，已跳过', err)
  }
}
const rejectCoordsItem = (item: CoordsPreviewItem) => {
  if (item.confirmed) return
  item.rejected = true
}
const confirmAllCoords = () => {
  coordsPreview.value.filter((i) => i.status === 'ok' && !i.confirmed && !i.rejected).forEach(confirmCoordsItem)
}
const rejectAllCoords = () => {
  coordsPreview.value.forEach((i) => {
    if (!i.confirmed) i.rejected = true
  })
}

// ────────────────────────── 5.6-B 自动标签（需 AI） ──────────────────────────
const tagOpen = ref(false)
const tagScope = ref<'all' | 'untagged'>('untagged')
const tagCandidates = computed(() =>
  tagScope.value === 'untagged' ? pickUntaggedMemories(memoryStore.memories) : memoryStore.memories,
)
const tagSelected = ref<string[]>([])
watch(tagCandidates, (list) => {
  tagSelected.value = list.map((m) => m.memoryId)
}, { immediate: true })

const tagRunning = ref(false)
const tagProgress = ref({ done: 0, total: 0 })
const tagHint = ref('')

interface TagPreviewItem {
  memoryId: string
  title: string
  date: string
  existing: string[]
  suggested: string[]
  unsafeTags: string[]
  safe: boolean
  status: 'ok' | 'fail'
  confirmed: boolean
  rejected: boolean
}
const tagPreview = ref<TagPreviewItem[]>([])
const tagSummary = ref('')

const toggleTagSelectAll = () => {
  const all = tagCandidates.value.map((m) => m.memoryId)
  tagSelected.value = tagSelected.value.length === all.length ? [] : all
}

const runTags = async () => {
  if (tagRunning.value || !aiConfigured) return
  const candidates = tagCandidates.value.filter((m) => tagSelected.value.includes(m.memoryId))
  if (candidates.length === 0) {
    tagHint.value = '请先勾选需要打标签的回忆'
    return
  }
  tagHint.value = ''
  if (candidates.length > BATCH_LIMIT) {
    tagHint.value = `共 ${candidates.length} 条，单批最多 ${BATCH_LIMIT} 条，已截取前 ${BATCH_LIMIT} 条`
  }
  const targets = candidates.slice(0, BATCH_LIMIT)
  tagRunning.value = true
  tagPreview.value = []
  tagSummary.value = ''
  tagProgress.value = { done: 0, total: targets.length }
  const outcome = await runSerial(targets, async (memory) => {
    const tags = await autoTag({ title: memory.title, content: memory.content, cities: memory.cities })
    if (!tags) {
      tagPreview.value.push({ memoryId: memory.memoryId, title: memory.title, date: memory.startDate, existing: memory.tags, suggested: [], unsafeTags: [], safe: true, status: 'fail', confirmed: false, rejected: false })
      return false
    }
    // 5.7 展示前检查：命中敏感词的标签标红（预览）+ 禁止确认（防脏词入库）
    const unsafeTags = tags.filter((t) => !checkContent(t).safe)
    tagPreview.value.push({ memoryId: memory.memoryId, title: memory.title, date: memory.startDate, existing: memory.tags, suggested: tags, unsafeTags, safe: unsafeTags.length === 0, status: 'ok', confirmed: false, rejected: false })
    return true
  }, (done, total) => {
    tagProgress.value = { done, total }
  })
  tagRunning.value = false
  // 5.8 埋点：自动标签按批量总体成功/失败记一次
  trackAiUse('autoTag', outcome.ok > 0)
  tagSummary.value = `打标签完成：成功 ${outcome.ok} / 失败 ${outcome.fail}`
}

const confirmTagItem = (item: TagPreviewItem) => {
  if (tagRunning.value || item.status !== 'ok' || item.confirmed || !item.safe) return
  // 5.7 写入前复查：防止脏词入库
  const recheck = checkTexts(item.suggested)
  if (!recheck.safe) {
    item.safe = false
    item.unsafeTags = recheck.hits
    console.warn('[AiOrganize] 建议标签未通过安全校验，禁止写入', recheck.hits)
    return
  }
  try {
    memoryStore.updateMemory(item.memoryId, { tags: mergeTags(item.existing, item.suggested) })
    item.confirmed = true
    item.rejected = false
  } catch (err) {
    console.error('[AiOrganize] 标签写入失败，已跳过', err)
  }
}
const rejectTagItem = (item: TagPreviewItem) => {
  if (item.confirmed) return
  item.rejected = true
}
const confirmAllTags = () => {
  tagPreview.value.filter((i) => i.status === 'ok' && !i.confirmed && !i.rejected && i.safe).forEach(confirmTagItem)
}
const rejectAllTags = () => {
  tagPreview.value.forEach((i) => {
    if (!i.confirmed) i.rejected = true
  })
}

// ────────────────────────── 5.6-C 景点信息补全（需 AI） ──────────────────────────
const descOpen = ref(false)
const descScope = ref<'all' | 'missing'>('missing')
const descCandidates = computed(() =>
  descScope.value === 'missing' ? pickSpotsMissingDesc(scenicStore.spots) : scenicStore.spots,
)
const descSelected = ref<string[]>([])
watch(descCandidates, (list) => {
  descSelected.value = list.map((s) => s.spotId)
}, { immediate: true })

const descRunning = ref(false)
const descProgress = ref({ done: 0, total: 0 })
const descHint = ref('')

interface DescPreviewItem {
  spotId: string
  spotName: string
  city: string
  generated: string
  unsafe: boolean
  status: 'ok' | 'fail'
  confirmed: boolean
  rejected: boolean
}
const descPreview = ref<DescPreviewItem[]>([])
const descSummary = ref('')

const toggleDescSelectAll = () => {
  const all = descCandidates.value.map((s) => s.spotId)
  descSelected.value = descSelected.value.length === all.length ? [] : all
}

const runDesc = async () => {
  if (descRunning.value || !aiConfigured) return
  const candidates = descCandidates.value.filter((s) => descSelected.value.includes(s.spotId))
  if (candidates.length === 0) {
    descHint.value = '请先勾选需要补全信息的景点'
    return
  }
  descHint.value = ''
  if (candidates.length > BATCH_LIMIT) {
    descHint.value = `共 ${candidates.length} 条，单批最多 ${BATCH_LIMIT} 条，已截取前 ${BATCH_LIMIT} 条`
  }
  const targets = candidates.slice(0, BATCH_LIMIT)
  descRunning.value = true
  descPreview.value = []
  descSummary.value = ''
  descProgress.value = { done: 0, total: targets.length }
  const outcome = await runSerial(targets, async (spot) => {
    const info = await describeSpot({ spotName: spot.spotName, city: spot.city, province: spot.province })
    if (!info) {
      descPreview.value.push({ spotId: spot.spotId, spotName: spot.spotName, city: spot.city, generated: '', unsafe: false, status: 'fail', confirmed: false, rejected: false })
      return false
    }
    // 5.7 展示前检查：命中敏感词标红 + 禁止确认
    const unsafe = !checkContent(info.description).safe
    descPreview.value.push({ spotId: spot.spotId, spotName: spot.spotName, city: spot.city, generated: info.description, unsafe, status: 'ok', confirmed: false, rejected: false })
    return true
  }, (done, total) => {
    descProgress.value = { done, total }
  })
  descRunning.value = false
  // 5.8 埋点：信息补全按批量总体成功/失败记一次
  trackAiUse('spotInfo', outcome.ok > 0)
  descSummary.value = `补全完成：成功 ${outcome.ok} / 失败 ${outcome.fail}（写入值将追加「${AI_DESC_SUFFIX}」）`
}

const confirmDescItem = (item: DescPreviewItem) => {
  if (descRunning.value || item.status !== 'ok' || item.confirmed || item.unsafe) return
  // 5.7 写入前复查
  if (!checkContent(item.generated).safe) {
    item.unsafe = true
    console.warn('[AiOrganize] 生成描述未通过安全校验，禁止写入')
    return
  }
  try {
    scenicStore.updateSpot(item.spotId, { description: `${item.generated.trim()}${AI_DESC_SUFFIX}` })
    item.confirmed = true
    item.rejected = false
  } catch (err) {
    console.error('[AiOrganize] 描述写入失败，已跳过', err)
  }
}
const rejectDescItem = (item: DescPreviewItem) => {
  if (item.confirmed) return
  item.rejected = true
}
const confirmAllDesc = () => {
  descPreview.value.filter((i) => i.status === 'ok' && !i.confirmed && !i.rejected && !i.unsafe).forEach(confirmDescItem)
}
const rejectAllDesc = () => {
  descPreview.value.forEach((i) => {
    if (!i.confirmed) i.rejected = true
  })
}

// 模板中 ref 自动解包，需包装成闭包函数（@change 传参用）
const toggleCoords = (id: string) => toggleId(coordsSelected, id)
const toggleTag = (id: string) => toggleId(tagSelected, id)
const toggleDesc = (id: string) => toggleId(descSelected, id)
</script>

<template>
  <section class="organize-view">
    <div class="organize-header">
      <h2>AI 智能整理</h2>
      <p>坐标兜底解析 · 自动标签 · 景点信息补全</p>
    </div>

    <div class="org-list">
      <!-- 坐标兜底解析（纯本地，零请求，无条件可用） -->
      <div class="org-row">
        <div class="org-main">
          <div class="org-name-row">
            <span class="org-name">坐标兜底解析</span>
            <span class="org-badge">已接入</span>
          </div>
          <p class="org-desc">对 lat/lng 为 0 的景点，用本地坐标库批量解析并回填（断网可用，零请求）</p>
        </div>
        <div class="org-action">
          <button class="org-btn" @click="coordsOpen = !coordsOpen">
            {{ coordsOpen ? '收起面板' : '解析坐标' }}
          </button>
        </div>
      </div>
      <div v-if="coordsOpen" class="org-panel">
        <div class="org-panel-head">
          <span>待解析景点（{{ coordsCandidates.length }} 条，勾选范围，单批 ≤ {{ BATCH_LIMIT }} 条）</span>
          <button class="org-mini-btn" @click="toggleCoordsSelectAll">全选 / 全不选</button>
        </div>
        <div v-if="!coordsCandidates.length" class="org-empty">暂无缺失坐标的景点</div>
        <div v-else class="org-check-list">
          <label v-for="spot in coordsCandidates" :key="spot.spotId" class="org-check-item">
            <input
              type="checkbox"
              :checked="coordsSelected.includes(spot.spotId)"
              @change="toggleCoords(spot.spotId)"
            />
            <span>{{ spot.spotName }}（{{ spot.city }}）</span>
          </label>
        </div>
        <div class="org-actions">
          <button class="org-btn" :disabled="coordsRunning || coordsSelected.length === 0" @click="runCoords">
            {{ coordsRunning ? '解析中…' : '开始解析' }}
          </button>
        </div>
        <div v-if="coordsRunning" class="org-progress">正在解析：第 {{ coordsProgress.done }} / {{ coordsProgress.total }} 条…</div>
        <div v-if="coordsHint" class="form-hint org-hint">{{ coordsHint }}</div>
        <div v-if="coordsSummary" class="org-summary">{{ coordsSummary }}</div>

        <div v-if="coordsPreview.length" class="org-preview">
          <div class="org-preview-head">
            <span>解析结果预览（来源：local）</span>
            <span class="org-preview-btns">
              <button class="org-mini-btn" @click="confirmAllCoords">全部确认</button>
              <button class="org-mini-btn" @click="rejectAllCoords">全部拒绝</button>
            </span>
          </div>
          <div
            v-for="item in coordsPreview"
            :key="item.spotId"
            class="org-preview-item"
            :class="{ 'preview-fail': item.status === 'fail', 'preview-confirmed': item.confirmed, 'preview-rejected': item.rejected }"
          >
            <div class="preview-main">
              <span class="preview-name">{{ item.spotName }}</span>
              <template v-if="item.status === 'ok'">
                <span class="preview-text">提议坐标：{{ item.lat.toFixed(4) }}, {{ item.lng.toFixed(4) }}（来源 {{ item.source }}）</span>
              </template>
              <template v-else>
                <span class="preview-text">本地坐标库未命中，保持 0 坐标（计入失败）</span>
              </template>
            </div>
            <div class="preview-btns">
              <template v-if="item.status === 'ok' && !item.confirmed && !item.rejected">
                <button class="org-mini-btn" @click="confirmCoordsItem(item)">确认</button>
                <button class="org-mini-btn" @click="rejectCoordsItem(item)">拒绝</button>
              </template>
              <span v-else-if="item.confirmed" class="preview-state">已写入</span>
              <span v-else-if="item.rejected" class="preview-state">已拒绝</span>
              <span v-else-if="item.status === 'fail'" class="preview-state">失败</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 自动标签（需 AI 配置） -->
      <div class="org-row">
        <div class="org-main">
          <div class="org-name-row">
            <span class="org-name">自动标签</span>
            <span class="org-badge">已接入</span>
          </div>
          <p class="org-desc">对回忆内容批量生成标签，预览后合并写入（合并保序去重，上限 8 个）</p>
        </div>
        <div class="org-action">
          <button class="org-btn" :disabled="!aiConfigured" @click="tagOpen = !tagOpen">
            {{ tagOpen ? '收起面板' : '对回忆批量打标签' }}
          </button>
        </div>
      </div>
      <div v-if="tagOpen" class="org-panel">
        <div class="org-panel-head">
          <span>打标签范围</span>
          <span class="org-radio-group">
            <label><input v-model="tagScope" type="radio" value="untagged" /> 仅无标签回忆</label>
            <label><input v-model="tagScope" type="radio" value="all" /> 全部回忆</label>
          </span>
          <button class="org-mini-btn" @click="toggleTagSelectAll">全选 / 全不选</button>
        </div>
        <div v-if="!tagCandidates.length" class="org-empty">当前范围暂无回忆</div>
        <div v-else class="org-check-list">
          <label v-for="memory in tagCandidates" :key="memory.memoryId" class="org-check-item">
            <input
              type="checkbox"
              :checked="tagSelected.includes(memory.memoryId)"
              @change="toggleTag(memory.memoryId)"
            />
            <span class="check-main">{{ memory.title }}</span>
            <span class="check-sub">{{ memory.startDate }} · 现有标签：{{ memory.tags.join('、') || '无' }}</span>
          </label>
        </div>
        <div class="org-actions">
          <button class="org-btn" :disabled="tagRunning || tagSelected.length === 0" @click="runTags">
            {{ tagRunning ? '打标签中…' : '开始打标签' }}
          </button>
        </div>
        <div v-if="tagRunning" class="org-progress">正在打标签：第 {{ tagProgress.done }} / {{ tagProgress.total }} 条…</div>
        <div v-if="tagHint" class="form-hint org-hint">{{ tagHint }}</div>
        <div v-if="tagSummary" class="org-summary">{{ tagSummary }}</div>

        <div v-if="tagPreview.length" class="org-preview">
          <div class="org-preview-head">
            <span>标签建议预览（命中敏感词标红且不可确认）</span>
            <span class="org-preview-btns">
              <button class="org-mini-btn" @click="confirmAllTags">全部确认</button>
              <button class="org-mini-btn" @click="rejectAllTags">全部拒绝</button>
            </span>
          </div>
          <div
            v-for="item in tagPreview"
            :key="item.memoryId"
            class="org-preview-item"
            :class="{ 'preview-fail': item.status === 'fail', 'preview-confirmed': item.confirmed, 'preview-rejected': item.rejected, 'preview-unsafe': !item.safe }"
          >
            <div class="preview-main">
              <span class="preview-name">{{ item.title }}</span>
              <template v-if="item.status === 'ok'">
                <span class="preview-text">现有：{{ item.existing.join('、') || '无' }}</span>
                <span class="preview-text">
                  建议：
                  <template v-for="(tag, idx) in item.suggested" :key="idx">
                    <em v-if="item.unsafeTags.includes(tag)" class="tag-unsafe">{{ tag }}</em>
                    <span v-else>{{ tag }}</span>
                    <template v-if="idx < item.suggested.length - 1">、</template>
                  </template>
                </span>
              </template>
              <template v-else>
                <span class="preview-text">AI 生成失败，已跳过（不计入写入）</span>
              </template>
            </div>
            <div class="preview-btns">
              <template v-if="item.status === 'ok' && !item.confirmed && !item.rejected">
                <button class="org-mini-btn" :disabled="!item.safe" @click="confirmTagItem(item)">确认</button>
                <button class="org-mini-btn" @click="rejectTagItem(item)">拒绝</button>
              </template>
              <span v-else-if="item.confirmed" class="preview-state">已写入</span>
              <span v-else-if="item.rejected" class="preview-state">已拒绝</span>
              <span v-else-if="item.status === 'fail'" class="preview-state">失败</span>
              <span v-else-if="!item.safe" class="preview-state preview-state-unsafe">含敏感词，不可确认</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 景点信息补全（需 AI 配置） -->
      <div class="org-row">
        <div class="org-main">
          <div class="org-name-row">
            <span class="org-name">景点信息补全</span>
            <span class="org-badge">已接入</span>
          </div>
          <p class="org-desc">为景点生成简介与最佳季节，写入值标注「AI 生成，请核实」</p>
        </div>
        <div class="org-action">
          <button class="org-btn" :disabled="!aiConfigured" @click="descOpen = !descOpen">
            {{ descOpen ? '收起面板' : '补全景点信息' }}
          </button>
        </div>
      </div>
      <div v-if="descOpen" class="org-panel">
        <div class="org-panel-head">
          <span>补全范围</span>
          <span class="org-radio-group">
            <label><input v-model="descScope" type="radio" value="missing" /> 仅无简介景点</label>
            <label><input v-model="descScope" type="radio" value="all" /> 全部景点</label>
          </span>
          <button class="org-mini-btn" @click="toggleDescSelectAll">全选 / 全不选</button>
        </div>
        <div v-if="!descCandidates.length" class="org-empty">当前范围暂无景点</div>
        <div v-else class="org-check-list">
          <label v-for="spot in descCandidates" :key="spot.spotId" class="org-check-item">
            <input
              type="checkbox"
              :checked="descSelected.includes(spot.spotId)"
              @change="toggleDesc(spot.spotId)"
            />
            <span class="check-main">{{ spot.spotName }}（{{ spot.city }}）</span>
            <span class="check-sub">{{ spot.description ? `现有简介：${spot.description.slice(0, 30)}…` : '暂无简介' }}</span>
          </label>
        </div>
        <div class="org-actions">
          <button class="org-btn" :disabled="descRunning || descSelected.length === 0" @click="runDesc">
            {{ descRunning ? '补全中…' : '开始补全' }}
          </button>
        </div>
        <div v-if="descRunning" class="org-progress">正在补全：第 {{ descProgress.done }} / {{ descProgress.total }} 条…</div>
        <div v-if="descHint" class="form-hint org-hint">{{ descHint }}</div>
        <div v-if="descSummary" class="org-summary">{{ descSummary }}</div>

        <div v-if="descPreview.length" class="org-preview">
          <div class="org-preview-head">
            <span>简介预览（写入时追加「{{ AI_DESC_SUFFIX }}」；命中敏感词标红且不可确认）</span>
            <span class="org-preview-btns">
              <button class="org-mini-btn" @click="confirmAllDesc">全部确认</button>
              <button class="org-mini-btn" @click="rejectAllDesc">全部拒绝</button>
            </span>
          </div>
          <div
            v-for="item in descPreview"
            :key="item.spotId"
            class="org-preview-item"
            :class="{ 'preview-fail': item.status === 'fail', 'preview-confirmed': item.confirmed, 'preview-rejected': item.rejected, 'preview-unsafe': item.unsafe }"
          >
            <div class="preview-main">
              <span class="preview-name">{{ item.spotName }}</span>
              <template v-if="item.status === 'ok'">
                <span class="preview-text" :class="{ 'tag-unsafe': item.unsafe }">{{ item.generated }}</span>
              </template>
              <template v-else>
                <span class="preview-text">AI 生成失败，已跳过（不计入写入）</span>
              </template>
            </div>
            <div class="preview-btns">
              <template v-if="item.status === 'ok' && !item.confirmed && !item.rejected">
                <button class="org-mini-btn" :disabled="item.unsafe" @click="confirmDescItem(item)">确认</button>
                <button class="org-mini-btn" @click="rejectDescItem(item)">拒绝</button>
              </template>
              <span v-else-if="item.confirmed" class="preview-state">已写入</span>
              <span v-else-if="item.rejected" class="preview-state">已拒绝</span>
              <span v-else-if="item.status === 'fail'" class="preview-state">失败</span>
              <span v-else-if="item.unsafe" class="preview-state preview-state-unsafe">含敏感词，不可确认</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 未配置 AI：常显降级标注（自动标签/信息补全按钮禁用；坐标兜底不受限） -->
    <div v-if="!aiConfigured" class="form-hint org-hint">
      AI 能力未配置：请在 <code>.env.example</code> 中填写 <code>VITE_AI_API_KEY</code> 后重启开发服务器，即可启用自动标签与信息补全（坐标兜底为纯本地功能，不受影响）
    </div>

    <p class="ai-compliance-note">AI 生成内容仅供参考，请以实际为准</p>
  </section>
</template>

<style scoped>
.organize-view {
  padding: var(--space-lg);
  max-width: 860px;
  margin: 0 auto;
}

.organize-header {
  margin-bottom: var(--space-lg);
}

.organize-header h2 {
  margin: 0 0 var(--space-xs);
  color: var(--color-text-primary);
}

.organize-header p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.org-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.org-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
}

.org-main {
  flex: 1;
}

.org-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.org-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.org-badge {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.org-desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.org-action {
  flex-shrink: 0;
}

.org-btn {
  padding: 8px 16px;
  background: var(--color-surface);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.org-btn:hover:not(:disabled) {
  background: var(--color-primary-lighter);
}

.org-btn:disabled {
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  cursor: not-allowed;
}

/* 批量面板 */
.org-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  box-shadow: var(--shadow-card);
}

.org-panel-head {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

.org-radio-group {
  display: inline-flex;
  gap: var(--space-md);
  font-weight: 400;
}

.org-mini-btn {
  padding: 4px 10px;
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.org-mini-btn:hover:not(:disabled) {
  background: var(--color-primary-light);
  color: #fff;
}

.org-mini-btn:disabled {
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  background: var(--color-surface);
  cursor: not-allowed;
}

.org-empty {
  padding: var(--space-md);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.org-check-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: var(--space-sm);
}

.org-check-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
}

.org-check-item:hover {
  background: var(--color-primary-lighter);
}

.check-main {
  font-weight: 600;
  flex-shrink: 0;
}

.check-sub {
  color: var(--color-text-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-actions {
  margin: var(--space-sm) 0;
}

.org-progress {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  margin-bottom: var(--space-sm);
}

.org-summary {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

/* 预览区 */
.org-preview {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-sm);
}

.org-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

.org-preview-btns {
  display: inline-flex;
  gap: 8px;
}

.org-preview-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  margin-bottom: 6px;
  background: var(--color-bg);
}

.org-preview-item.preview-fail {
  opacity: 0.65;
}

.org-preview-item.preview-confirmed {
  border-color: #86efac;
  background: #f0fdf4;
}

.org-preview-item.preview-rejected {
  opacity: 0.55;
}

/* 5.7：命中敏感词标红 */
.org-preview-item.preview-unsafe {
  border-color: #fca5a5;
  background: #fef2f2;
}

.preview-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.preview-name {
  font-weight: 700;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.preview-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  word-break: break-all;
}

.tag-unsafe {
  color: #dc2626;
  font-weight: 700;
  font-style: normal;
  text-decoration: underline wavy #f87171;
}

.preview-btns {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.preview-state {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.preview-state-unsafe {
  color: #dc2626;
  font-weight: 600;
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
}

.org-hint {
  margin-top: var(--space-sm);
}

.org-hint code {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.ai-compliance-note {
  margin-top: var(--space-lg);
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .organize-view {
    padding: var(--space-md);
  }

  .org-row {
    flex-direction: column;
    align-items: stretch;
  }

  .org-action {
    align-self: flex-end;
  }

  .org-panel-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
