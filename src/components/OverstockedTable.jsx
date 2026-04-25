import { useState, useMemo } from 'react'
import { useColumnResize } from '../lib/useColumnResize'
import ProductChatPanel from './ProductChatPanel'

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

const COLUMNS = [
  { key: 'productName',    label: 'Product',          align: 'left',  defaultWidth: 280 },
  { key: 'onHand',         label: 'On Hand',           align: 'right', defaultWidth: 100 },
  { key: 'weeklyVelocity', label: 'Weekly Velocity',   align: 'right', defaultWidth: 150 },
  { key: 'daysOfStock',    label: 'Weeks of Stock',    align: 'right', defaultWidth: 150 },
  { key: 'currentMin',     label: 'Current Min',       align: 'right', defaultWidth: 120 },
  { key: 'currentMax',     label: 'Current Max',       align: 'right', defaultWidth: 120 },
  { key: 'suggestedMin',   label: 'Suggested Min',     align: 'right', defaultWidth: 130 },
  { key: 'suggestedMax',   label: 'Suggested Max',     align: 'right', defaultWidth: 130 },
]

export default function OverstockedTable({ results, allSalesRows = [], seasonalInsights = {}, dismissed = {}, setDismissed = () => {} }) {
  const [sortCol, setSortCol] = useState('daysOfStock')
  const [sortDir, setSortDir] = useState('desc')
  const { widths, startResize } = useColumnResize(COLUMNS.map(c => c.defaultWidth))
  const [chatProduct, setChatProduct] = useState(null)
  const [editVals, setEditVals] = useState({})
  const [pushing, setPushing] = useState(new Set())
  const [pushError, setPushError] = useState({})

  async function dismiss(r) {
    const next = {
      ...dismissed,
      [r.sku]: {
        dismissedAt: new Date().toISOString(),
        onHand: r.onHand,
        suggestedMin: r.suggestedMin,
        suggestedMax: r.suggestedMax,
      },
    }
    setDismissed(next)
    await fetch('/api/dismissed-overstocked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {})
  }


  function getVal(sku, field, fallback) {
    return editVals[sku]?.[field] ?? fallback ?? ''
  }

  function setVal(sku, field, val) {
    setEditVals(prev => ({ ...prev, [sku]: { ...prev[sku], [field]: val } }))
    setPushError(prev => { const next = { ...prev }; delete next[sku]; return next })
  }

  async function pushToOdoo(r) {
    const minQty = Number(getVal(r.sku, 'min', r.suggestedMin))
    const maxQty = Number(getVal(r.sku, 'max', r.suggestedMax))
    setPushing(prev => new Set(prev).add(r.sku))
    try {
      const res = await fetch('/api/update-orderpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: r.sku, minQty, maxQty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      await dismiss(r)
    } catch (err) {
      setPushError(prev => ({ ...prev, [r.sku]: err.message }))
    } finally {
      setPushing(prev => { const s = new Set(prev); s.delete(r.sku); return s })
    }
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const dismissedSkus = useMemo(() => new Set(Object.keys(dismissed)), [dismissed])

  const visible = useMemo(
    () => results.filter(r => !dismissedSkus.has(r.sku)),
    [results, dismissedSkus]
  )

  const sorted = useMemo(() => {
    return [...visible].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [visible, sortCol, sortDir])

  const dismissedCount = dismissedSkus.size

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
        No overstocked products found.
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">Overstocked</h2>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {sorted.length} products
            </span>
            {dismissedCount > 0 && (
              <span className="text-xs text-gray-400">{dismissedCount} dismissed for 8 weeks</span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">More than 8 weeks of supply on hand based on current velocity</p>
        </div>
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="table-fixed divide-y divide-gray-200 text-sm" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
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
            <tbody className="divide-y divide-gray-100">
              {sorted.map(r => {
                const weeksOfStock = r.daysOfStock != null ? (r.daysOfStock / 7).toFixed(1) : '—'
                const isPushing = pushing.has(r.sku)
                const error = pushError[r.sku]
                return (
                  <tr key={r.sku} className="hover:bg-gray-50">
                    <td className="px-6 py-3 overflow-hidden">
                      <div className="font-medium text-gray-900 truncate">{r.productName}</div>
                      <div className="text-xs text-gray-400 truncate">{r.sku}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => pushToOdoo(r)}
                          disabled={isPushing}
                          className="inline-flex items-center rounded border border-indigo-300 px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                        >
                          {isPushing ? 'Pushing…' : 'Push to Odoo'}
                        </button>
                        <button
                          onClick={() => dismiss(r)}
                          className="inline-flex items-center rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                      {error && <div className="mt-1 text-xs text-red-500 truncate">{error}</div>}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-900">{parseFloat(r.onHand.toFixed(2))}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{r.weeklyVelocity}/wk</td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800">
                        {weeksOfStock} wks
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">{r.currentMin ?? '—'}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{r.currentMax ?? '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={getVal(r.sku, 'min', r.suggestedMin)}
                        onChange={e => setVal(r.sku, 'min', e.target.value)}
                        className="w-16 text-right text-sm font-medium text-indigo-700 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={getVal(r.sku, 'max', r.suggestedMax)}
                          onChange={e => setVal(r.sku, 'max', e.target.value)}
                          className="w-16 text-right text-sm font-medium text-indigo-700 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        {r.isSeasonallyAdjusted && r.peakSeasonName && (
                          <button
                            onClick={() => setChatProduct({ ...r, insight: seasonalInsights[r.sku] || null })}
                            className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
                          >
                            {r.peakSeasonName}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
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
