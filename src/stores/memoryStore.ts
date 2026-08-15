import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { TravelMemory } from '../types'
import { loadState, patchState } from '../utils/storage'

export const useMemoryStore = defineStore('memory', () => {
  const memories = ref<TravelMemory[]>([])

  const init = () => {
    const state = loadState()
    memories.value = state.memories
  }

  watch(memories, () => patchState('memories', memories.value), { deep: true })

  const groupedByYear = computed(() => {
    const groups = new Map<string, TravelMemory[]>()
    for (const memory of memories.value) {
      const year = memory.startDate.slice(0, 4)
      const list = groups.get(year) ?? []
      list.push(memory)
      groups.set(year, list)
    }
    return groups
  })

  const addMemory = (memory: TravelMemory) => {
    memories.value.unshift(memory)
  }

  const updateMemory = (memoryId: string, updates: Partial<TravelMemory>) => {
    const idx = memories.value.findIndex(m => m.memoryId === memoryId)
    if (idx !== -1) {
      memories.value[idx] = { ...memories.value[idx], ...updates, updatedAt: new Date().toISOString() }
    }
  }

  const deleteMemory = (memoryId: string) => {
    memories.value = memories.value.filter(m => m.memoryId !== memoryId)
  }

  const getById = (memoryId: string) =>
    memories.value.find(m => m.memoryId === memoryId)

  const getByCity = (cityName: string) =>
    memories.value.filter(m => m.cities.includes(cityName))

  const getByTag = (tag: string) =>
    memories.value.filter(m => m.tags.includes(tag))

  return {
    memories,
    init,
    groupedByYear,
    addMemory,
    updateMemory,
    deleteMemory,
    getById,
    getByCity,
    getByTag,
  }
})
