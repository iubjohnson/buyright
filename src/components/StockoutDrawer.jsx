import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts'

function toDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toISOString().slice(0, 10)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildTimeline(product, salesRows, receiptRows) {
  const skuSales = salesRows.filter(r => r.sku === product.sku)
  const skuReceipts = receiptRows.filter(r => r.sku === product.sku)

  const allMoves = [
    ...skuSales.map(r => ({ date: new Date(r.date), delta: -r.qty, type: 'sale' })),
    ...skuReceipts.map(r => ({ date: new Date(r.date), delta: r.qty, type: 'receipt' })),
  ].sort((a, b) => a.date - b.date)

  if (!allMoves.length) return { series: [], receiptDates: [] }

  const totalSalesQty = skuSales.reduce((sum, r) => sum + r.qty, 0)
  const totalReceiptQty = skuReceipts.reduce((sum, r) => sum + r.qty, 0)
  let balance = Math.max(0, product.onHand + totalSalesQty - totalReceiptQty)

  const movesByDay = {}
  for (const m of allMoves) {
    const d = toDateStr(m.date)
    if (!movesByDay[d]) movesByDay[d] = []
    movesByDay[d].push(m)
  }

  const start = new Date(allMoves[0].date)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const series = []
  const receiptDates = []
  const cur = new Date(start)

  while (cur <= today) {
    const dateStr = toDateStr(cur)
    const dayMoves = movesByDay[dateStr] || []
    let hasReceipt = false

    for (const m of dayMoves) {
      balance += m.delta
      if (balance < 0) balance = 0
      if (m.type === 'receipt') hasReceipt = true
    }

    series.push({ date: dateStr, balance: Math.round(balance * 100) / 100 })
    if (hasReceipt) receiptDates.push(dateStr)
    cur.setDate(cur.getDate() + 1)
  }

  return { series, receiptDates }
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded shadow px-3 py-2 text-xs">
      <div className="font-medium text-gray-700 mb-1">{formatDate(label)}</div>
      <div className="text-indigo-600">On Hand: <span className="font-semibold">{payload[0].value}</span></div>
    </div>
  )
}

export default function StockoutDrawer({ product, salesRows, receiptRows, onClose }) {
  const { series, receiptDates } = useMemo(
    () => buildTimeline(product, salesRows, receiptRows),
    [product, salesRows, receiptRows]
  )

  const tickInterval = Math.max(0, Math.floor(series.length / 10) - 1)

  return (
    <div className="fixed inset-y-0 right-0 w-[580px] bg-white border-l border-gray-200 shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{product.productName}</div>
          <div className="text-xs text-gray-400">{product.sku}</div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0 text-lg leading-none">✕</button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-gray-500">Stockouts</div>
          <div className="text-xl font-semibold text-red-600">{product.stockoutCount}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Last Out</div>
          <div className="text-xs font-medium text-gray-800 mt-0.5">{formatDate(product.lastStockout.outDate)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Days Out</div>
          <div className="text-xl font-semibold text-gray-800">{product.lastStockout.daysOut}d</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">On Hand</div>
          <div className="text-xl font-semibold text-gray-800">{parseFloat(product.onHand.toFixed(2))}</div>
        </div>
      </div>
      <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-gray-500">Weekly Velocity</div>
          <div className="text-sm font-semibold text-gray-800">{product.weeklyVelocity}/wk</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Peak Velocity</div>
          <div className="text-sm font-semibold text-gray-800">{product.peakVelocity}/wk</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Suggested Min</div>
          <div className="text-sm font-semibold text-indigo-700">{product.suggestedMin ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Suggested Max</div>
          <div className="text-sm font-semibold text-indigo-700">{product.suggestedMax ?? '—'}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-200" /> Stockout period</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-green-500" /> Restock</span>
      </div>

      {/* Chart */}
      <div className="flex-1 px-2 py-2 min-h-0">
        {series.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">No movement data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              {product.stockoutEvents.map((e, i) => (
                <ReferenceArea
                  key={i}
                  x1={toDateStr(e.outDate)}
                  x2={toDateStr(e.restockDate)}
                  fill="#fca5a5"
                  fillOpacity={0.4}
                />
              ))}
              {receiptDates.map(d => (
                <ReferenceLine key={d} x={d} stroke="#16a34a" strokeWidth={1.5} />
              ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                interval={tickInterval}
                tickFormatter={d => {
                  const dt = new Date(d + 'T12:00:00')
                  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#4f46e5"
                fill="#e0e7ff"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stockout event list */}
      <div className="border-t border-gray-200 px-4 py-3 max-h-44 overflow-y-auto">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">All Stockout Events</div>
        <div className="space-y-1">
          {product.stockoutEvents.map((e, i) => (
            <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-600">{formatDate(e.outDate)}</span>
              <span className="text-red-500 font-medium">{e.daysOut} days out</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
