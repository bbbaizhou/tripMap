import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { ScenicSpot, SpotStatus } from '../types'
import { loadState, patchState } from '../utils/storage'

export const useScenicStore = defineStore('scenic', () => {
  const spots = ref<ScenicSpot[]>([])

  const init = () => {
    const state = loadState()
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
    visitedSpots,
    wishlistSpots,
    addSpot,
    removeSpot,
    toggleStatus,
    getSpotById,
    getSpotsByProvince,
  }
})
