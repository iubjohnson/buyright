import { useState, useMemo } from 'react'
import { Fragment } from 'react'
import { useColumnResize } from '../lib/useColumnResize'
import { getCurrentSeasonName } from '../lib/calculations'
import ProductChatPanel from './ProductChatPanel'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SEASONS = [
  { name: 'Spring', months: [2, 3, 4],  headerCls: 'bg-green-50 text-green-900',  badge: 'bg-green-100 text-green-800' },
  { name: 'Summer', months: [5, 6, 7],  headerCls: 'bg-yellow-50 text-yellow-900', badge: 'bg-yellow-100 text-yellow-800' },
  { name: 'Fall',   months: [8, 9, 10], headerCls: 'bg-orange-50 text-orange-900', badge: 'bg-orange-100 text-orange-800' },
  { name: 'Winter', months: [11, 0, 1], headerCls: 'bg-blue-50 text-blue-900',    badge: 'bg-blue-100 text-blue-800' },
]

const COLUMNS = [
  { key: 'productName',    label: 'Product',         align: 'left',  defaultWidth: 280 },
  { key: 'onHand',         label: 'On Hand',          align: 'right', defaultWidth: 100 },
  { key: 'weeklyVelocity', label: 'Avg Velocity',     align: 'right', defaultWidth: 130 },
  { key: 'peakVelocity',   label: 'Peak Velocity',    align: 'right', defaultWidth: 130 },
  { key: 'peakMonths',     label: 'Peak Months',      align: 'left',  defaultWidth: 120, noSort: true },
  { key: 'currentMin',     label: 'Current Min',      align: 'right', defaultWidth: 120 },
  { key: 'currentMax',     label: 'Current Max',      align: 'right', defaultWidth: 120 },
  { key: 'suggestedMin',   label: 'Suggested Min',    align: 'right', defaultWidth: 130 },
  { key: 'suggestedMax',   label: 'Suggested Max',    align: 'right', defaultWidth: 130 },
]

function getPeakWindow(monthlyBreakdown) {
  const velocities = MONTH_NAMES.map(m => monthlyBreakdown[m] || 0)
  let bestStart = 0, bestAvg = 0
  for (let m = 0; m < 12; m++) {
    const avg = (velocities[m] + velocities[(m + 1) % 12]) / 2
    if (avg > bestAvg) { bestAvg = avg; bestStart = m }
  }
  return {
    startIdx: bestStart,
    label: `${MONTH_NAMES[bestStart]}–${MONTH_NAMES[(bestStart + 1) % 12]}`,
  }
}

function getSeasonName(monthIdx) {
  return SEASONS.find(s => s.months.includes(monthIdx))?.name ?? 'Winter'
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function SeasonalWatchTable({ results, seasonalInsights = {}, loadingSeasons = new Set(), onGenerateInsights, allSalesRows = [] }) {
  const [sortCol, setSortCol] = useState('peakVelocity')
  const [sortDir, setSortDir] = useState('desc')
  const currentSeason = getCurrentSeasonName()
  const [collapsed, setCollapsed] = useState(() =>
    Object.fromEntries(SEASONS.map(s => [s.name, s.name !== currentSeason]))
  )
  const [chatProduct, setChatProduct] = useState(null)
  const { widths, startResize } = useColumnResize(COLUMNS.map(c => c.defaultWidth))

  function toggleSeason(name) {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const grouped = useMemo(() => {
    const augmented = results.map(r => {
      const peak = getPeakWindow(r.monthlyBreakdown)
      return { ...r, peakWindow: peak }
    })
    const sorted = [...augmented].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
    const map = {}
    for (const s of SEASONS) map[s.name] = []
    for (const r of sorted) map[r.peakSeasonName].push(r)
    return map
  }, [results, sortCol, sortDir])

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
        No products with significant seasonal patterns detected.
      </div>
    )
  }

  const tableWidth = widths.reduce((a, b) => a + b, 0)

  return (
    <>
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Seasonal Watch</h2>
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
            {results.length} products
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">Products with significant seasonal demand — grouped by when peak demand occurs</p>
      </div>
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="table-fixed divide-y divide-gray-200 text-sm" style={{ width: tableWidth }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  onClick={() => !col.noSort && handleSort(col.key)}
                  style={{ width: widths[i] }}
                  className={`relative px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs select-none overflow-hidden ${col.noSort ? '' : 'cursor-pointer hover:bg-gray-100'} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.label}
                  {!col.noSort && <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />}
                  <div
                    onMouseDown={(e) => startResize(i, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400 z-20"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEASONS.map(season => {
              const group = grouped[season.name]
              if (!group?.length) return null
              return (
                <Fragment key={season.name}>
                  <tr className={`${season.headerCls} cursor-pointer select-none`} onClick={() => toggleSeason(season.name)}>
                    <td colSpan={COLUMNS.length} className="px-6 py-2 text-xs font-semibold">
                      <div className="flex items-center justify-between">
                        <span>
                          <span className="mr-2">{collapsed[season.name] ? '▶' : '▼'}</span>
                          {season.name} — {group.length} product{group.length !== 1 ? 's' : ''}
                        </span>
                        {!collapsed[season.name] && season.name !== currentSeason && (() => {
                          const hasInsights = group.some(r => seasonalInsights[r.sku])
                          const isLoading = loadingSeasons.has(season.name)
                          if (isLoading) return <span className="text-xs font-normal italic">Generating insights…</span>
                          if (!hasInsights) return (
                            <button
                              onClick={e => { e.stopPropagation(); onGenerateInsights(season.name, group) }}
                              className="text-xs font-normal px-2.5 py-1 rounded bg-white bg-opacity-60 hover:bg-opacity-100 border border-current transition-colors"
                            >
                              Generate Insights
                            </button>
                          )
                          return null
                        })()}
                      </div>
                    </td>
                  </tr>
                  {!collapsed[season.name] && group.map(r => (
                    <tr key={r.sku} className="hover:bg-gray-50 divide-x divide-gray-100">
                      <td className="px-6 py-3 overflow-hidden">
                        <div className="font-medium text-gray-900 truncate">{r.productName}</div>
                        <div className="text-xs text-gray-400 truncate">{r.sku}</div>
                        {seasonalInsights[r.sku]
                          ? <div className="mt-1 text-xs text-indigo-700 whitespace-normal flex items-start gap-1">
                              <span className="flex-1">{seasonalInsights[r.sku]}</span>
                              <button
                                onClick={() => setChatProduct({ ...r, insight: seasonalInsights[r.sku] })}
                                title="Ask a question about this product"
                                className="shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors"
                              >
                                💬
                              </button>
                            </div>
                          : loadingSeasons.has(r.peakSeasonName)
                            ? <div className="mt-1 text-xs text-gray-400 italic">Analyzing…</div>
                            : null}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-900">{r.onHand}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{r.weeklyVelocity}/wk</td>
                      <td className="px-6 py-3 text-right text-gray-600">{r.peakVelocity}/wk</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${season.badge}`}>
                          {r.peakWindow.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600">{r.currentMin ?? '—'}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{r.currentMax ?? '—'}</td>
                      <td className="px-6 py-3 text-right font-medium text-indigo-700">{r.suggestedMin ?? '—'}</td>
                      <td className="px-6 py-3 text-right font-medium text-indigo-700">{r.suggestedMax ?? '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>

    {chatProduct && (
      <ProductChatPanel
        product={chatProduct}
        salesRows={allSalesRows}
        onClose={() => setChatProduct(null)}
      />
    )}
  </>
  )
}
