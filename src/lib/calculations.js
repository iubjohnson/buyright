const OVERSTOCK_MIN_WEEKS = 8
const SEASONAL_WATCH_MIN_PEAK_VELOCITY = 2
const MONTH_NAMES_BREAKDOWN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function getSeasonName(monthIdx) {
  if (monthIdx >= 2 && monthIdx <= 4) return 'Spring'
  if (monthIdx >= 5 && monthIdx <= 7) return 'Summer'
  if (monthIdx >= 8 && monthIdx <= 10) return 'Fall'
  return 'Winter'
}

export function getCurrentSeasonName() {
  return getSeasonName(new Date().getMonth())
}

function peakMonthFromBreakdown(monthlyBreakdown) {
  const velocities = MONTH_NAMES_BREAKDOWN.map(m => monthlyBreakdown[m] || 0)
  let bestStart = 0, bestAvg = 0
  for (let m = 0; m < 12; m++) {
    const avg = (velocities[m] + velocities[(m + 1) % 12]) / 2
    if (avg > bestAvg) { bestAvg = avg; bestStart = m }
  }
  return bestStart
}

export function computeSeasonalWatch(baseResults) {
  return baseResults
    .filter(r => !r.noSales && r.isSeasonallyAdjusted && r.monthlyBreakdown && r.peakVelocity >= SEASONAL_WATCH_MIN_PEAK_VELOCITY)
    .map(r => ({ ...r, peakSeasonName: getSeasonName(peakMonthFromBreakdown(r.monthlyBreakdown)) }))
}

export function computeOverstocked(baseResults) {
  return baseResults
    .filter(r => !r.noSales && r.suggestedMax !== null && r.onHand > r.suggestedMax)
    .sort((a, b) => (b.onHand / b.suggestedMax) - (a.onHand / a.suggestedMax))
}

export function detectStockouts(salesRows, receiptRows, baseResults) {
  const productRows = baseResults
  const movesByProduct = new Map()

  for (const s of salesRows) {
    if (!movesByProduct.has(s.sku)) movesByProduct.set(s.sku, [])
    movesByProduct.get(s.sku).push({ date: s.date, qty: -s.qty, type: 'sale' })
  }
  for (const r of receiptRows) {
    if (!movesByProduct.has(r.sku)) movesByProduct.set(r.sku, [])
    movesByProduct.get(r.sku).push({ date: r.date, qty: r.qty, type: 'receipt' })
  }

  const results = []

  for (const product of productRows) {
    const { sku, onHand, productName, vendor, weeklyVelocity, peakVelocity,
            isSeasonallyAdjusted, monthlyBreakdown, peakSeasonName,
            currentMin, currentMax, suggestedMin, suggestedMax } = product
    const moves = (movesByProduct.get(sku) || []).sort((a, b) => a.date - b.date)

    const receipts = moves.filter(m => m.type === 'receipt')
    if (receipts.length === 0) continue

    // Reconstruct opening balance at date_from by working backwards from today
    const totalSalesQty = moves.filter(m => m.type === 'sale').reduce((sum, m) => sum + (-m.qty), 0)
    const totalReceiptQty = receipts.reduce((sum, m) => sum + m.qty, 0)
    let balance = Math.max(0, onHand + totalSalesQty - totalReceiptQty)

    let stockoutStart = null
    const stockoutEvents = []

    for (const move of moves) {
      balance += move.qty

      if (balance <= 0) {
        if (stockoutStart === null) stockoutStart = move.date
        balance = 0
      } else if (stockoutStart !== null && move.type === 'receipt') {
        stockoutEvents.push({
          outDate: stockoutStart,
          restockDate: move.date,
          daysOut: Math.round((move.date - stockoutStart) / (1000 * 60 * 60 * 24)),
        })
        stockoutStart = null
      }
    }

    if (stockoutEvents.length > 0) {
      results.push({
        sku,
        productName,
        vendor,
        onHand,
        weeklyVelocity,
        peakVelocity,
        isSeasonallyAdjusted: isSeasonallyAdjusted ?? false,
        monthlyBreakdown: monthlyBreakdown ?? null,
        peakSeasonName: peakSeasonName ?? null,
        currentMin: currentMin ?? null,
        currentMax: currentMax ?? null,
        suggestedMin: suggestedMin ?? null,
        suggestedMax: suggestedMax ?? null,
        stockoutCount: stockoutEvents.length,
        stockoutEvents,
        lastStockout: stockoutEvents[stockoutEvents.length - 1],
      })
    }
  }

  return results.sort((a, b) =>
    b.stockoutCount - a.stockoutCount || b.lastStockout.daysOut - a.lastStockout.daysOut
  )
}

// Recency-weighted velocity: recent sales count more, half-life = 12 weeks
const VELOCITY_HALF_LIFE_WEEKS = 12
const REORDER_BUFFER_WEEKS = 2
const LOW_CONFIDENCE_MIN_RECORDS = 4
const WEEKS_PER_MONTH = 4.333
const SEASONAL_ADJUSTMENT_THRESHOLD = 0.75  // flag if peak velocity is >1.75x the blended average

function computeMonthlyBreakdown(skuSales) {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthlyQty = new Array(12).fill(0)
  for (const { date, qty } of skuSales) monthlyQty[date.getMonth()] += qty

  const allDates = skuSales.map(s => s.date)
  const dataStart = new Date(Math.min(...allDates))
  const dataEnd   = new Date(Math.max(...allDates))
  const monthCount = new Array(12).fill(0)
  const cur = new Date(dataStart.getFullYear(), dataStart.getMonth(), 1)
  while (cur <= dataEnd) { monthCount[cur.getMonth()]++; cur.setMonth(cur.getMonth() + 1) }

  const breakdown = {}
  for (let m = 0; m < 12; m++) {
    breakdown[MONTH_NAMES[m]] = monthCount[m] > 0
      ? Math.round((monthlyQty[m] / (monthCount[m] * WEEKS_PER_MONTH)) * 10) / 10
      : 0
  }
  return breakdown
}

function computePeakVelocity(skuSales) {
  // Find the best 2-month rolling window by avg weekly velocity
  if (!skuSales.length) return 0

  const monthlyQty = new Array(12).fill(0)
  for (const { date, qty } of skuSales) monthlyQty[date.getMonth()] += qty

  const allDates = skuSales.map(s => s.date)
  const dataStart = new Date(Math.min(...allDates))
  const dataEnd   = new Date(Math.max(...allDates))
  const monthCount = new Array(12).fill(0)
  const cur = new Date(dataStart.getFullYear(), dataStart.getMonth(), 1)
  while (cur <= dataEnd) { monthCount[cur.getMonth()]++; cur.setMonth(cur.getMonth() + 1) }

  const monthlyVelocity = monthlyQty.map((qty, m) =>
    monthCount[m] > 0 ? qty / (monthCount[m] * WEEKS_PER_MONTH) : 0
  )

  // Rolling 2-month average, wrapping around year end
  let peak = 0
  for (let m = 0; m < 12; m++) {
    const avg = (monthlyVelocity[m] + monthlyVelocity[(m + 1) % 12]) / 2
    if (avg > peak) peak = avg
  }
  return peak
}

function computeWeeklyVelocity(skuSales, referenceDate) {
  if (!skuSales.length) return 0

  const decay = Math.LN2 / VELOCITY_HALF_LIFE_WEEKS
  const weeklyTotals = new Map()
  let maxWeeksAgo = 0

  for (const { date, qty } of skuSales) {
    const weeksAgo = Math.max(0, Math.floor((referenceDate - date) / (7 * 24 * 60 * 60 * 1000)))
    weeklyTotals.set(weeksAgo, (weeklyTotals.get(weeksAgo) || 0) + qty)
    if (weeksAgo > maxWeeksAgo) maxWeeksAgo = weeksAgo
  }

  let weightedQty = 0
  let totalWeight = 0
  for (let w = 0; w <= maxWeeksAgo; w++) {
    const weight = Math.exp(-decay * w)
    weightedQty += (weeklyTotals.get(w) || 0) * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedQty / totalWeight : 0
}

function detectSeasonality(skuSales) {
  const monthlyQty = new Array(12).fill(0)

  for (const { date, qty } of skuSales) {
    monthlyQty[date.getMonth()] += qty
  }

  const total = monthlyQty.reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const avg = total / 12
  const max = Math.max(...monthlyQty)
  if (max / avg < 1.5) return null

  return {
    peakMonth: monthlyQty.indexOf(max),
    peakRatio: Math.round((max / avg) * 10) / 10,
  }
}

export function computeReorderStatus(daysOfStock, targetWeeks) {
  if (daysOfStock === null || daysOfStock === undefined) return 'healthy'
  if (daysOfStock < REORDER_BUFFER_WEEKS * 7) return 'below'
  if (daysOfStock < targetWeeks * 7) return 'approaching'
  return 'healthy'
}

export function computeResults(salesRows, productRows) {
  const today = new Date()

  const salesBySku = new Map()
  for (const row of salesRows) {
    const list = salesBySku.get(row.sku) || []
    list.push({ date: row.date, qty: row.qty })
    salesBySku.set(row.sku, list)
  }

  const allDates = salesRows.map(r => r.date).filter(d => !isNaN(d.getTime()))
  const dataStart = allDates.length ? new Date(Math.min(...allDates)) : null
  const dataEnd = allDates.length ? new Date(Math.max(...allDates)) : null
  const spanDays = dataStart && dataEnd ? (dataEnd - dataStart) / 86400000 : 0

  const results = productRows.map(product => {
    const skuSales = salesBySku.get(product.sku) || []
    const noSales = skuSales.length === 0
    const lowConfidence = !noSales && skuSales.length < LOW_CONFIDENCE_MIN_RECORDS

    const weeklyVelocity = computeWeeklyVelocity(skuSales, today)
    const daysOfStock = weeklyVelocity > 0
      ? Math.round((product.onHand / weeklyVelocity) * 7)
      : null

    // Peak velocity: best 2-month rolling window — used for suggestedMax so the
    // setting handles peak-season demand year-round, not just the current 8 weeks
    const hasEnoughHistory = spanDays >= 180
    const peakVelocity = hasEnoughHistory && !noSales
      ? computePeakVelocity(skuSales)
      : weeklyVelocity
    const isSeasonallyAdjusted = weeklyVelocity > 0 &&
      peakVelocity >= SEASONAL_WATCH_MIN_PEAK_VELOCITY &&
      peakVelocity / weeklyVelocity > (1 + SEASONAL_ADJUSTMENT_THRESHOLD)

    const monthlyBreakdown = hasEnoughHistory && !noSales ? computeMonthlyBreakdown(skuSales) : null

    return {
      sku: product.sku,
      productName: product.productName || product.sku,
      vendor: product.vendor || '',
      onHand: product.onHand,
      weeklyVelocity: Math.round(weeklyVelocity * 10) / 10,
      peakVelocity: Math.round(peakVelocity * 10) / 10,
      isSeasonallyAdjusted,
      monthlyBreakdown,
      daysOfStock,
      lowConfidence,
      noSales,
      dataPoints: skuSales.length,
      seasonality: spanDays >= 365 && !noSales ? detectSeasonality(skuSales) : null,
      dataStart,
      dataEnd,
      currentPrice: product.currentPrice ?? null,
      currentMin: product.currentMin ?? null,
      currentMax: product.currentMax ?? null,
      peakSeasonName: monthlyBreakdown ? getSeasonName(peakMonthFromBreakdown(monthlyBreakdown)) : null,
      suggestedMin: weeklyVelocity > 0 ? Math.max(1, Math.round(weeklyVelocity * REORDER_BUFFER_WEEKS)) : null,
      suggestedMax: isSeasonallyAdjusted
        ? (peakVelocity > 0 ? Math.round(peakVelocity * OVERSTOCK_MIN_WEEKS) : null)
        : (weeklyVelocity > 0 ? Math.round(weeklyVelocity * OVERSTOCK_MIN_WEEKS) : null),
    }
  })

  results.sort((a, b) => {
    if (a.noSales !== b.noSales) return a.noSales ? 1 : -1
    const aDays = a.daysOfStock ?? Infinity
    const bDays = b.daysOfStock ?? Infinity
    return aDays - bDays
  })

  return results
}
