export type GeoJSONSource = 'local' | 'cdn' | null

export interface GeoJSONLoadResult {
  data: unknown
  source: GeoJSONSource
}

// 相对路径（勿加前导 '/'）：history 路由下 /map 页相对解析到应用根
export const CHINA_PROVINCES_LOCAL_URL = 'data/china-provinces.json'
export const CHINA_PROVINCES_CDN_URL =
  'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'

const cache = new Map<string, unknown>()

/** 通用 fetch + 内存缓存。 */
export async function loadGeoJSON(url: string): Promise<unknown> {
  if (cache.has(url)) return cache.get(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GeoJSON fetch failed: ${response.status} ${url}`)
  const data = await response.json()
  cache.set(url, data)
  return data
}

/** 本地 → CDN 依次尝试，全失败返回 { data: null, source: null }（不 throw，由调用方决定降级展示）。 */
export async function loadChinaProvinces(): Promise<GeoJSONLoadResult> {
  try {
    const data = await loadGeoJSON(CHINA_PROVINCES_LOCAL_URL)
    return { data, source: 'local' }
  } catch {
    try {
      const data = await loadGeoJSON(CHINA_PROVINCES_CDN_URL)
      return { data, source: 'cdn' }
    } catch {
      return { data: null, source: null }
    }
  }
}
