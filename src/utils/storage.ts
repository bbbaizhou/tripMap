import type { AppState } from '../types'
import { mockData } from './mockData'

const STORAGE_KEY = 'travel_footprint_data'

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData))
    return mockData
  }

  try {
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.version || !parsed.visitedCities || !parsed.scenicSpots || !parsed.memories) {
      return mockData
    }
    return parsed
  } catch {
    return mockData
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function patchState<K extends keyof AppState>(key: K, value: AppState[K]): void {
  const state = loadState()
  state[key] = value
  saveState(state)
}
