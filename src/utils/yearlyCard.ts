/**
 * 年度报告分享卡片绘制（任务 5.5）
 * 纯 Canvas 绘制逻辑（零图表库、零网络请求、无 DOM 依赖，可独立验证）：
 * 1080×1080 固定画布 → 品牌+年份标题 → 2×3 统计网格 → lat/lng 归一化点线装饰 → 品牌页脚。
 *
 * Phase 6 预留：分享导出前强制 checkContent（见 PHASE6 6.5）。本任务默认卡片仅含
 * 数字 + 城市名（不含 AI 文本），可不依赖内容过滤；若后续加入 AI 年度寄语，展示前必须过
 * checkContent（5.7）——调用点在 YearlyShareCard.vue 生成/导出路径。
 */

/** 分享卡片输入：stats 为 6 项（value 已格式化，含 ¥）；cityPins 为足迹城市点线装饰数据。 */
export interface YearlyCardInput {
  year: string
  brand: string // 品牌名（'旅行足迹'）
  stats: { label: string; value: string }[] // 6 项
  cityPins: { name: string; lat: number; lng: number }[] // 取 visitedCities
  footer: string // 页脚（'旅行足迹 · 用脚步丈量世界'）
}

/** 固定画布尺寸（1080×1080，导出 PNG 用；预览端 CSS 缩放）。 */
export const CARD_SIZE = 1080

/** 系统字体栈：优先 PingFang/Microsoft YaHei，中英文混排（¥1234）正常绘制。 */
const FONT_STACK = 'PingFang SC, Microsoft YaHei, sans-serif'

/** 主题色（产品绿 #4caf50 系）。 */
const GREEN = '#4caf50'
const GREEN_DARK = '#2e7d32'
const GREEN_LIGHT = '#e8f5e9'
const TEXT_DARK = '#1f2937'
const TEXT_GRAY = '#6b7280'

/** 城市名截断：≤ 6 字 + '…'（长城市名不溢出）。 */
export function truncateCityName(name: string, max = 6): string {
  const trimmed = name.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

/** 绘制主入口：清空画布并按固定布局绘制（可重复调用）。 */
export function drawYearlyCard(canvas: HTMLCanvasElement, input: YearlyCardInput): void {
  canvas.width = CARD_SIZE
  canvas.height = CARD_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // ── 背景：浅绿渐变 ──
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_SIZE)
  bg.addColorStop(0, '#f4fbf5')
  bg.addColorStop(1, '#e0f2e4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  // ── 顶部：品牌 + 年份标题 ──
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = GREEN_DARK
  ctx.font = `600 44px ${FONT_STACK}`
  ctx.fillText(input.brand, CARD_SIZE / 2, 150)

  ctx.fillStyle = TEXT_DARK
  ctx.font = `700 96px ${FONT_STACK}`
  ctx.fillText(`${input.year} 年度旅行报告`, CARD_SIZE / 2, 280)

  // 标题下装饰线
  ctx.strokeStyle = GREEN
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(CARD_SIZE / 2 - 160, 350)
  ctx.lineTo(CARD_SIZE / 2 + 160, 350)
  ctx.stroke()

  // ── 中部：2×3 六项统计网格 ──
  const grid = {
    cols: 2,
    rows: 3,
    cellW: 430,
    cellH: 120,
    gapX: 40,
    gapY: 28,
    startX: (CARD_SIZE - (430 * 2 + 40)) / 2,
    startY: 430,
  }
  const stats = input.stats.slice(0, 6)
  stats.forEach((stat, index) => {
    const col = index % grid.cols
    const row = Math.floor(index / grid.cols)
    const x = grid.startX + col * (grid.cellW + grid.gapX)
    const y = grid.startY + row * (grid.cellH + grid.gapY)

    // 圆角卡底
    roundRect(ctx, x, y, grid.cellW, grid.cellH, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fill()
    ctx.strokeStyle = GREEN_LIGHT
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = TEXT_GRAY
    ctx.font = `500 30px ${FONT_STACK}`
    ctx.fillText(stat.label, x + grid.cellW / 2, y + 40)

    ctx.fillStyle = GREEN_DARK
    ctx.font = `700 48px ${FONT_STACK}`
    ctx.fillText(stat.value, x + grid.cellW / 2, y + 88)
  })

  // ── 底部装饰区：lat/lng 归一化点线 + 城市名 ──
  const deco = { x: 90, y: 850, w: 900, h: 130 }
  ctx.font = `500 26px ${FONT_STACK}`
  ctx.fillStyle = TEXT_GRAY
  ctx.textAlign = 'center'
  const pins = input.cityPins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  if (pins.length > 1) {
    const lngs = pins.map((p) => p.lng)
    const lats = pins.map((p) => p.lat)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const pad = 30
    const spanX = maxLng - minLng || 1
    const spanY = maxLat - minLat || 1

    // 折线连接（lng→x，lat→y，lat 向上增大）
    ctx.strokeStyle = 'rgba(76, 175, 80, 0.55)'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pins.forEach((p, i) => {
      const x = deco.x + pad + ((p.lng - minLng) / spanX) * (deco.w - pad * 2)
      const y = deco.y + deco.h - pad - ((p.lat - minLat) / spanY) * (deco.h - pad * 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // 圆点 + 城市名
    pins.forEach((p) => {
      const x = deco.x + pad + ((p.lng - minLng) / spanX) * (deco.w - pad * 2)
      const y = deco.y + deco.h - pad - ((p.lat - minLat) / spanY) * (deco.h - pad * 2)
      ctx.beginPath()
      ctx.fillStyle = GREEN
      ctx.arc(x, y, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = TEXT_DARK
      ctx.font = `500 24px ${FONT_STACK}`
      ctx.fillText(truncateCityName(p.name), x, y - 22)
    })
  } else if (pins.length === 1) {
    const p = pins[0]
    const x = deco.x + deco.w / 2
    const y = deco.y + deco.h / 2
    ctx.beginPath()
    ctx.fillStyle = GREEN
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = TEXT_DARK
    ctx.font = `500 24px ${FONT_STACK}`
    ctx.fillText(truncateCityName(p.name), x, y - 22)
  } else {
    ctx.fillStyle = TEXT_GRAY
    ctx.fillText('暂无足迹城市数据', deco.x + deco.w / 2, deco.y + deco.h / 2)
  }

  // ── 底部：品牌页脚 ──
  ctx.fillStyle = GREEN_DARK
  ctx.font = `500 30px ${FONT_STACK}`
  ctx.fillText(input.footer, CARD_SIZE / 2, 1010)
}

/** 圆角矩形路径辅助（纯绘制，无 DOM 依赖）。 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** 导出 PNG dataURL（下载/复制共用）。 */
export function cardToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}
