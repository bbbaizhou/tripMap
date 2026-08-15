const cache = new Map<string, unknown>()

export async function loadGeoJSON(url: string): Promise<unknown> {
  if (cache.has(url)) return cache.get(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GeoJSON fetch failed: ${response.status} ${url}`)
  const data = await response.json()
  cache.set(url, data)
  return data
}
