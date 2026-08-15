import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { ScenicSpot, SpotStatus } from '../types'
import { loadState, loadStateDetailed, patchState } from '../utils/storage'

export const useScenicStore = defineStore('scenic', () => {
  const spots = ref<ScenicSpot[]>([])

  const init = () => {
    const state = loadState()
    spots.value = state.scenicSpots
  }

  /** 从 localStorage 重载本数组（拉取写回用）：内容相同 diff 零入队；内容不同由抑制标志兜底，杜绝回推。 */
  const reloadFromStorage = () => {
    const { state } = loadStateDetailed()
    spots.value = state.scenicSpots
  }

  watch(spots, () => patchState('scenicSpots', spots.value), { deep: true })

  const visitedSpots = computed(() => spots.value.filter((spot) => spot.status === 'visited'))
  const wishlistSpots = computed(() => spots.value.filter((spot) => spot.status === 'wishlist'))

  const addSpot = (spot: ScenicSpot) => {
    if (!spots.value.find(s => s.spotId === spot.spotId)) {
      spots.value.push(spot)
    }
  }

  const removeSpot = (spotId: string) => {
    spots.value = spots.value.filter(s => s.spotId !== spotId)
  }

  /** 部分更新单个景点（仿 memoryStore.updateMemory；任务 5.6 坐标兜底/信息补全写入用）。 */
  const updateSpot = (spotId: string, updates: Partial<ScenicSpot>) => {
    const idx = spots.value.findIndex(s => s.spotId === spotId)
    if (idx !== -1) {
      spots.value[idx] = { ...spots.value[idx], ...updates }
    }
  }

  const toggleStatus = (spotId: string, status: SpotStatus, visitDate?: string) => {
    const spot = spots.value.find(s => s.spotId === spotId)
    if (spot) {
      spot.status = status
      if (status === 'visited' && visitDate) {
        spot.visitDate = visitDate
      } else if (status !== 'visited') {
        spot.visitDate = undefined
      }
    }
  }

  const getSpotById = (spotId: string) =>
    spots.value.find(s => s.spotId === spotId)

  const getSpotsByProvince = (province: string) =>
    spots.value.filter(s => s.province === province)

  return {
    spots,
    init,
    reloadFromStorage,
    visitedSpots,
    wishlistSpots,
    addSpot,
    removeSpot,
    updateSpot,
    toggleStatus,
    getSpotById,
    getSpotsByProvince,
  }
})
