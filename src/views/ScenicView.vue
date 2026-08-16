<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScenicSpotCard from '../components/ScenicSpotCard.vue'
import { useScenicStore } from '../stores/scenicStore'
import { withEnqueueSuppressed } from '../utils/storage'
import type { ScenicSpot } from '../types'

const scenicStore = useScenicStore()

// 筛选状态
const filterProvince = ref<string>('all')
const filterLevel = ref<string>('all')
const filterStatus = ref<string>('all')
const filterKeyword = ref<string>('')

// 打卡 Dialog 状态
const checkInDialogVisible = ref(false)
const checkInSpotId = ref<string>('')
const checkInDate = ref<string>(new Date().toISOString().slice(0, 10))

// 新增景点 Dialog 状态
const addDialogVisible = ref(false)
const newSpot = ref<Partial<ScenicSpot>>({
  spotName: '',
  level: '5A',
  city: '',
  province: '',
  type: '自然风光',
  status: 'wishlist',
  relatedMemoryIds: [],
})

// 初始化：加载基础景点数据（仅加载不在 store 中的）
onMounted(async () => {
  try {
    // 用 BASE_URL（生产 /tripMap/、dev /）拼接，保证 GitHub Pages 子路径下资源不 404
    const res = await fetch(import.meta.env.BASE_URL + 'data/scenic-spots-base.json')
    const base: ScenicSpot[] = await res.json()
    const existingIds = new Set(scenicStore.spots.map(s => s.spotId))
    // 种子合并期间抑制同步入队：公共种子库非用户私有变更，不应进入云同步队列
    withEnqueueSuppressed(() => {
      base.forEach(spot => {
        if (!existingIds.has(spot.spotId)) {
          scenicStore.addSpot(spot)
        }
      })
    })
  } catch {
    // 静默失败，使用 store 现有数据
  }
})

// 可选省份列表
const provinceOptions = computed(() => {
  const provinces = [...new Set(scenicStore.spots.map(s => s.province))].sort()
  return [{ value: 'all', label: '全部省份' }, ...provinces.map(p => ({ value: p, label: p }))]
})

// 筛选后的景点列表
const filteredSpots = computed(() => {
  return scenicStore.spots.filter(spot => {
    if (filterProvince.value !== 'all' && spot.province !== filterProvince.value) return false
    if (filterLevel.value !== 'all' && spot.level !== filterLevel.value) return false
    if (filterStatus.value !== 'all' && spot.status !== filterStatus.value) return false
    if (filterKeyword.value.trim()) {
      const kw = filterKeyword.value.trim().toLowerCase()
      if (!spot.spotName.toLowerCase().includes(kw) && !spot.city.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

// ===== 分页（Web 每页 30 条 / 移动端每页 10 条，断点与 CSS @media 768px 一致）=====
const isMobileView = ref(window.matchMedia('(max-width: 768px)').matches)
const handleViewportChange = () => {
  isMobileView.value = window.matchMedia('(max-width: 768px)').matches
}
window.addEventListener('resize', handleViewportChange)
onBeforeUnmount(() => window.removeEventListener('resize', handleViewportChange))

const currentPage = ref(1)
const pageSize = computed(() => (isMobileView.value ? 10 : 30))

// 筛选变化时重置页码
watch([filterProvince, filterLevel, filterStatus, filterKeyword], () => {
  currentPage.value = 1
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredSpots.value.length / pageSize.value)))
// 越界保护：数据变化后页码超界则回退
watch(totalPages, (tp) => { if (currentPage.value > tp) currentPage.value = tp })

const pagedSpots = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSpots.value.slice(start, start + pageSize.value)
})

// 统计
const visitedCount = computed(() => scenicStore.visitedSpots.length)
const wishlistCount = computed(() => scenicStore.wishlistSpots.length)

// 打卡操作
const openCheckIn = (spotId: string) => {
  checkInSpotId.value = spotId
  checkInDate.value = new Date().toISOString().slice(0, 10)
  checkInDialogVisible.value = true
}

const confirmCheckIn = () => {
  if (!checkInSpotId.value) return
  scenicStore.toggleStatus(checkInSpotId.value, 'visited', checkInDate.value)
  checkInDialogVisible.value = false
  checkInSpotId.value = ''
}

const handleToWishlist = (spotId: string) => {
  scenicStore.toggleStatus(spotId, 'wishlist')
}

// 新增景点
const confirmAddSpot = () => {
  if (!newSpot.value.spotName || !newSpot.value.city || !newSpot.value.province) return
  const spot: ScenicSpot = {
    spotId: `custom-${Date.now()}`,
    spotName: newSpot.value.spotName!,
    level: newSpot.value.level as '4A' | '5A',
    city: newSpot.value.city!,
    province: newSpot.value.province!,
    type: newSpot.value.type || '自然风光',
    status: 'wishlist',
    relatedMemoryIds: [],
    lat: 0,
    lng: 0,
  }
  scenicStore.addSpot(spot)
  addDialogVisible.value = false
  newSpot.value = { spotName: '', level: '5A', city: '', province: '', type: '自然风光', status: 'wishlist', relatedMemoryIds: [] }
}
</script>

<template>
  <section class="scenic-view">
    <!-- 顶部 header -->
    <div class="scenic-header">
      <div>
        <h2>景点打卡</h2>
        <p>管理你的 4A/5A 景点打卡记录</p>
      </div>
      <button class="add-btn" @click="addDialogVisible = true">+ 添加景点</button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card stat-visited">
        <div class="stat-number">{{ visitedCount }}</div>
        <div class="stat-label">已打卡</div>
      </div>
      <div class="stat-card stat-wishlist">
        <div class="stat-number">{{ wishlistCount }}</div>
        <div class="stat-label">心愿单</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ scenicStore.spots.length }}</div>
        <div class="stat-label">总景点</div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <select v-model="filterProvince" class="filter-select">
        <option v-for="opt in provinceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <div class="level-tabs">
        <button :class="['tab-btn', filterLevel === 'all' && 'active']" @click="filterLevel = 'all'">全部</button>
        <button :class="['tab-btn', filterLevel === '5A' && 'active']" @click="filterLevel = '5A'">5A</button>
        <button :class="['tab-btn', filterLevel === '4A' && 'active']" @click="filterLevel = '4A'">4A</button>
      </div>

      <div class="status-tabs">
        <button :class="['tab-btn', filterStatus === 'all' && 'active']" @click="filterStatus = 'all'">全部</button>
        <button :class="['tab-btn', filterStatus === 'visited' && 'active']" @click="filterStatus = 'visited'">已打卡</button>
        <button :class="['tab-btn', filterStatus === 'wishlist' && 'active']" @click="filterStatus = 'wishlist'">心愿单</button>
      </div>

      <input
        v-model="filterKeyword"
        class="search-input"
        placeholder="搜索景点名或城市..."
        type="text"
      />

      <span class="filter-count">{{ filteredSpots.length }} 个结果</span>
    </div>

    <!-- 景点网格 -->
    <div v-if="filteredSpots.length > 0" class="spot-grid">
      <ScenicSpotCard
        v-for="spot in pagedSpots"
        :key="spot.spotId"
        :spot="spot"
        @check-in="openCheckIn"
        @toggle-wishlist="handleToWishlist"
        @unmark="handleToWishlist"
      />
    </div>

    <!-- 分页控件 -->
    <div v-if="filteredSpots.length > pageSize" class="pagination">
      <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }} 页（共 {{ filteredSpots.length }} 条）</span>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">🗺️</div>
      <div class="empty-text">没有找到匹配的景点</div>
      <div class="empty-sub">尝试调整筛选条件</div>
    </div>

    <!-- 打卡 Dialog -->
    <div v-if="checkInDialogVisible" class="dialog-overlay" @click.self="checkInDialogVisible = false">
      <div class="dialog">
        <h3>打卡确认</h3>
        <p>{{ scenicStore.getSpotById(checkInSpotId)?.spotName }}</p>
        <div class="form-group">
          <label>打卡日期</label>
          <input v-model="checkInDate" type="date" class="date-input" />
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="checkInDialogVisible = false">取消</button>
          <button class="btn-confirm" @click="confirmCheckIn">确认打卡</button>
        </div>
      </div>
    </div>

    <!-- 新增景点 Dialog -->
    <div v-if="addDialogVisible" class="dialog-overlay" @click.self="addDialogVisible = false">
      <div class="dialog">
        <h3>添加景点</h3>
        <div class="form-group">
          <label>景点名称 *</label>
          <input v-model="newSpot.spotName" type="text" class="text-input" placeholder="如：黄山风景区" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>城市 *</label>
            <input v-model="newSpot.city" type="text" class="text-input" placeholder="如：黄山市" />
          </div>
          <div class="form-group">
            <label>省份 *</label>
            <input v-model="newSpot.province" type="text" class="text-input" placeholder="如：安徽省" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>等级</label>
            <select v-model="newSpot.level" class="filter-select">
              <option value="5A">5A</option>
              <option value="4A">4A</option>
            </select>
          </div>
          <div class="form-group">
            <label>类型</label>
            <select v-model="newSpot.type" class="filter-select">
              <option>自然风光</option>
              <option>人文景观</option>
              <option>古迹遗址</option>
              <option>宗教人文</option>
              <option>文化创意</option>
            </select>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="addDialogVisible = false; newSpot.spotName = ''; newSpot.city = ''; newSpot.province = ''">取消</button>
          <button class="btn-confirm" @click="confirmAddSpot">添加</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scenic-view { padding: 24px; }

.scenic-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.scenic-header h2 { margin: 0 0 4px; }
.scenic-header p { margin: 0; font-size: 14px; color: #6b7280; }

.add-btn {
  padding: 8px 16px; background: #4caf50; color: #fff; border: none;
  border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;
}
.add-btn:hover { background: #43a047; }

.stats-row { display: flex; gap: 12px; margin-bottom: 20px; }
.stat-card {
  flex: 1; background: #fff; border: 1px solid #e4e7ed; border-radius: 12px;
  padding: 16px; text-align: center;
}
.stat-visited { border-color: #c8e6c9; background: #f9fffe; }
.stat-wishlist { border-color: #bbdefb; background: #f0f7ff; }
.stat-number { font-size: 28px; font-weight: 800; color: #1f2937; }
.stat-label { font-size: 13px; color: #6b7280; margin-top: 4px; }

.filter-bar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  margin-bottom: 20px; padding: 14px 16px;
  background: #fff; border: 1px solid #e4e7ed; border-radius: 12px;
}
.filter-select {
  padding: 7px 10px; border: 1px solid #e4e7ed; border-radius: 8px;
  font-size: 13px; background: #f9fafb; cursor: pointer;
}
.level-tabs, .status-tabs { display: flex; gap: 4px; }
.tab-btn {
  padding: 6px 14px; border: 1px solid #e4e7ed; border-radius: 999px;
  background: #f9fafb; font-size: 13px; cursor: pointer; color: #374151;
  transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
}
.tab-btn.active { background: var(--color-primary-lighter); color: var(--color-primary); border-color: #c8e6c9; font-weight: 600; }
.tab-btn:hover { background: #f0f7f0; }
.search-input {
  padding: 7px 12px; border: 1px solid #e4e7ed; border-radius: 8px;
  font-size: 13px; min-width: 180px; outline: none;
}
.search-input:focus { border-color: #4caf50; }
.filter-count { font-size: 13px; color: #9ca3af; margin-left: auto; }

.spot-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;
}

.empty-state {
  text-align: center; padding: 60px 20px;
  color: #9ca3af;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text { font-size: 16px; font-weight: 600; margin-bottom: 6px; color: #6b7280; }
.empty-sub { font-size: 13px; }

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.page-btn {
  padding: 8px 18px;
  border: 1px solid var(--color-primary-light);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 200ms ease;
}
.page-btn:hover:not(:disabled) { background: var(--color-primary-lighter); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: var(--color-text-secondary); }

/* Dialog */
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.dialog {
  background: #fff; border-radius: 16px; padding: 28px 32px;
  width: 440px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.dialog h3 { margin: 0 0 16px; font-size: 18px; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.form-group label { font-size: 13px; font-weight: 600; color: #374151; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.text-input, .date-input {
  padding: 9px 12px; border: 1px solid #e4e7ed; border-radius: 8px;
  font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
}
.text-input:focus, .date-input:focus { border-color: #4caf50; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
.btn-cancel {
  padding: 9px 20px; border: 1px solid #e4e7ed; border-radius: 8px;
  background: #f9fafb; cursor: pointer; font-size: 14px; color: #374151;
}
.btn-confirm {
  padding: 9px 20px; background: #4caf50; color: #fff; border: none;
  border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
}
.btn-confirm:hover { background: #43a047; }

/* ===== 移动端适配（≤768px / ≤480px）===== */
@media (max-width: 768px) {
  .scenic-view { padding: 16px; }
  .spot-grid { grid-template-columns: 1fr; gap: 12px; }
  .dialog { padding: 20px 16px; }
  /* P2-2：次要按钮触控目标 ≥36px */
  .tab-btn { min-height: 36px; }
  /* P2-3：16px 防 iOS 聚焦缩放 */
  .filter-select { font-size: 16px; }
  /* 分页按钮移动端触控目标 ≥40px */
  .page-btn { min-height: 40px; }
}

@media (max-width: 480px) {
  .form-row { flex-direction: column; }
}
</style>
