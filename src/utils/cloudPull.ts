import { pullFromCloud } from './syncService'
import { withEnqueueSuppressed } from './storage'
import { useFootprintStore } from '../stores/footprintStore'
import { useScenicStore } from '../stores/scenicStore'
import { useMemoryStore } from '../stores/memoryStore'

/**
 * 拉取云端并写回 store（自动同步「拉取」方向的编排入口，唯一触碰 store 的入口）。
 *
 * - 拉取（pullFromCloud，纯 utils）→ 有变化才写回：
 *   withEnqueueSuppressed 内三 store reloadFromStorage（loadStateDetailed 后赋值）。
 * - 入队隔离（防循环）：写回全程只走 saveState + reloadFromStorage，且在抑制窗口内 →
 *   不触发 enqueueArrayDiff → 不触发自动同步 → 无循环；自动推送方向只读队列写云端，不写本地 → 单向无环。
 * - 降级零影响：未配置 / 未登录 / 离线 / 表缺失 → pullFromCloud 返回 null（零网络请求或整体放弃），本函数原样返回 null。
 *
 * @returns { changed: boolean } | null —— null 表示守卫拒绝或拉取失败；changed 表示本地数据被云端合并更新。
 */
export async function pullCloudAndApply(): Promise<{ changed: boolean } | null> {
  const result = await pullFromCloud()
  if (result === null) return null
  if (result.changed) {
    withEnqueueSuppressed(() => {
      useFootprintStore().reloadFromStorage()
      useScenicStore().reloadFromStorage()
      useMemoryStore().reloadFromStorage()
    })
  }
  return { changed: result.changed }
}
