import type { AppState } from '../types'
import { loadState, saveState } from './storage'

export function exportToJson(): void {
  const state = loadState()
  const json = JSON.stringify(state, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  a.download = `travel-footprint-backup-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importFromJson(file: File): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text) as AppState
        if (
          !parsed.version ||
          !Array.isArray(parsed.visitedCities) ||
          !Array.isArray(parsed.scenicSpots) ||
          !Array.isArray(parsed.memories)
        ) {
          resolve({ success: false, message: '文件格式不正确，缺少必要字段（version / visitedCities / scenicSpots / memories）' })
          return
        }
        saveState(parsed)
        resolve({
          success: true,
          message: `已成功导入：${parsed.visitedCities.length} 个城市、${parsed.scenicSpots.length} 个景点、${parsed.memories.length} 条回忆`,
        })
      } catch {
        resolve({ success: false, message: 'JSON 解析失败，请确认文件格式正确' })
      }
    }
    reader.readAsText(file, 'utf-8')
  })
}

export function getStorageSize(): string {
  try {
    const raw = localStorage.getItem('travel_footprint_data') ?? ''
    const bytes = new TextEncoder().encode(raw).length
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  } catch {
    return '未知'
  }
}
