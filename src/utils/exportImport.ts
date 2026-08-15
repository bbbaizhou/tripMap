import { loadState, saveState } from './storage'
import { runMigrations } from './migrations'

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
      let parsed: unknown
      try {
        parsed = JSON.parse(e.target?.result as string)
      } catch {
        resolve({ success: false, message: 'JSON 解析失败，请确认文件格式正确' })
        return
      }

      const record = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
      if (
        !Array.isArray(record.visitedCities) ||
        !Array.isArray(record.scenicSpots) ||
        !Array.isArray(record.memories)
      ) {
        resolve({
          success: false,
          message: '文件格式不正确，缺少必要字段（visitedCities / scenicSpots / memories）',
        })
        return
      }

      // 旧文件（无 schemaVersion）走迁移管线后再写回
      try {
        const { state, migrated } = runMigrations(parsed)
        saveState(state)
        resolve({
          success: true,
          message: `已成功导入：${state.visitedCities.length} 个城市、${state.scenicSpots.length} 个景点、${state.memories.length} 条回忆${migrated ? '（已自动升级数据版本）' : ''}`,
        })
      } catch {
        resolve({ success: false, message: '数据版本迁移失败，请确认文件来自受支持的版本' })
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
