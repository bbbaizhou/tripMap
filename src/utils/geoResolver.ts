import { findCityCoords } from './cityCoords'

export interface CoordResult {
  lat: number
  lng: number
  source: 'local' | 'remote'
}

export interface GeoQuery {
  cityName: string
  province?: string
}

export interface GeoResolver {
  readonly id: string
  resolve(q: GeoQuery): Promise<CoordResult | null>
}

/** 本地坐标库解析（纯本地、零请求）。 */
export class LocalCityResolver implements GeoResolver {
  readonly id = 'local'
  async resolve(q: GeoQuery): Promise<CoordResult | null> {
    const coord = findCityCoords(q.cityName, q.province)
    if (!coord) return null
    return { lat: coord.lat, lng: coord.lng, source: 'local' }
  }
}

/**
 * 高德地图解析扩展点：本任务不接入真实 Key、不发网络请求。
 * 接入方式（预留）：配置 key 后取消注释，并保留远程失败降级逻辑。
 */
export class AmapGeoResolver implements GeoResolver {
  readonly id = 'amap'
  constructor(private readonly key?: string) {}
  async resolve(_q: GeoQuery): Promise<CoordResult | null> {
    // 预留扩展点：本任务不接入真实 Key、不发网络请求。
    if (!this.key) return null
    // const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(_q.cityName)}&key=${this.key}`
    // const res = await fetch(url)
    // const json = await res.json()
    // if (json?.geocodes?.length) {
    //   const [lng, lat] = String(json.geocodes[0].location).split(',').map(Number)
    //   return { lat, lng, source: 'remote' }
    // }
    return null
  }
}

const localResolver = new LocalCityResolver()
const remoteResolver = new AmapGeoResolver()

/** 解析管线：本地 → 预留远程（当前恒 null）→ null；source 供 UI 标注数据来源。 */
export async function resolveCityCoords(q: GeoQuery): Promise<CoordResult | null> {
  const local = await localResolver.resolve(q)
  if (local) return local
  const remote = await remoteResolver.resolve(q)
  if (remote) return remote
  return null
}
