import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { FootprintCity } from '../types'
import { loadState, patchState } from '../utils/storage'

export const useFootprintStore = defineStore('footprint', () => {
  const visitedCities = ref<FootprintCity[]>([])

  const init = () => {
    const state = loadState()
    visitedCities.value = state.visitedCities
  }

  watch(visitedCities, () => patchState('visitedCities', visitedCities.value), { deep: true })

  const getVisitedProvinces = computed(() => {
    return [...new Set(visitedCities.value.map((city) => city.province))]
  })

  const addCity = (city: FootprintCity) => {
    if (!visitedCities.value.find(c => c.cityId === city.cityId)) {
      visitedCities.value.push(city)
    }
  }

  const removeCity = (cityId: string) => {
    visitedCities.value = visitedCities.value.filter(c => c.cityId !== cityId)
  }

  const updateCity = (cityId: string, updates: Partial<FootprintCity>) => {
    const idx = visitedCities.value.findIndex(c => c.cityId === cityId)
    if (idx !== -1) {
      visitedCities.value[idx] = { ...visitedCities.value[idx], ...updates }
    }
  }

  const getCityById = (cityId: string) =>
    visitedCities.value.find(c => c.cityId === cityId)

  return {
    visitedCities,
    init,
    getVisitedProvinces,
    addCity,
    removeCity,
    updateCity,
    getCityById,
  }
})
