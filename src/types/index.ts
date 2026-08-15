export interface FootprintCity {
  cityId: string
  cityName: string
  province: string
  country: string
  firstVisitDate: string
  visitCount: number
  totalDays: number
  scenicSpotIds: string[]
  memoryIds: string[]
  lat: number
  lng: number
}

export type SpotLevel = '4A' | '5A'
export type SpotStatus = 'visited' | 'wishlist'

export interface ScenicSpot {
  spotId: string
  spotName: string
  level: SpotLevel
  city: string
  province: string
  type: string
  status: SpotStatus
  visitDate?: string
  relatedMemoryIds: string[]
  lat: number
  lng: number
  description?: string
}

export interface TravelMemory {
  memoryId: string
  title: string
  startDate: string
  endDate: string
  companions: string[]
  tags: string[]
  cost?: number
  content: string
  images: string[]
  videoUrl?: string
  cities: string[]
  spotIds: string[]
  createdAt: string
  updatedAt: string
}

export interface AppState {
  schemaVersion: number // 新增：当前架构版本（= CURRENT_SCHEMA_VERSION）
  version: string // 保留：兼容旧导出文件（'1.0'/'2.0'）
  visitedCities: FootprintCity[]
  scenicSpots: ScenicSpot[]
  memories: TravelMemory[]
}
