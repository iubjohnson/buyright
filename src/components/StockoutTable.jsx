import { useState, useMemo, useRef, useEffect } from 'react'
import { useColumnResize } from '../lib/useColumnResize'
import StockoutDrawer from './StockoutDrawer'
import ProductChatPanel from './ProductChatPanel'

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

const COLUMNS = [
  { key: 'select',         label: '',                 align: 'left',  defaultWidth: 44,  noSort: true },
  { key: 'productName',    label: 'Product',          align: 'left',  defaultWidth: 340 },
  { key: 'onHand',         label: 'On Hand',          align: 'right', defaultWidth: 90  },
  { key: 'stockoutCount',  label: '# Stockouts',      align: 'right', defaultWidth: 100 },
  { key: 'outDate',        label: 'Last Stockout',    align: 'left',  defaultWidth: 130 },
  { key: 'daysOut',        label: 'Days Out',         align: 'right', defaultWidth: 90  },
  { key: 'currentMin',     label: 'Current Min',      align: 'right', defaultWidth: 100 },
  { key: 'currentMax',     label: 'Current Max',      align: 'right', defaultWidth: 100 },
  { key: 'suggestedMin',   label: 'Suggested Min',    align: 'right', defaultWidth: 110 },
  { key: 'suggestedMax',   label: 'Suggested Max',    align: 'right', defaultWidth: 110 },
]

function getValue(r, key) {
  if (key === 'outDate') return r.lastStockout.outDate
  if (key === 'daysOut') return r.lastStockout.daysOut
  return r[key] ?? ''
}

export default function StockoutTable({ results, dismissed = {}, setDismissed = () => {}, allSalesRows = [], allReceiptRows = [], seasonalInsights = {} }) {
  const [sortCol, setSortCol] = useState('stockoutCount')
  const [sortDir, setSortDir] = useState('desc')
  const { widths, startResize } = useColumnResize(COLUMNS.map(c => c.defaultWidth))
  const [analysisProduct, setAnalysisProduct] = useState(null)
  const [chatProduct, setChatProduct] = useState(null)
  const [lowStockFilter, setLowStockFilter] = useState('all')
  const [editVals, setEditVals] = useState({})
  const [pushing, setPushing] = useState(new Set())
  const [pushError, setPushError] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [bulkPushing, setBulkPushing] = useState(false)
  const selectAllRef = useRef(null)

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
    await fetch('/api/dismissed-stockouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {})
  }

  async function dismissMany(rows) {
    const next = { ...dismissed }
    for (const r of rows) {
      next[r.sku] = {
        dismissedAt: new Date().toISOString(),
        onHand: r.onHand,
        suggestedMin: r.suggestedMin,
        suggestedMax: r.suggestedMax,
      }
    }
    setDismissed(next)
    setSelected(new Set())
    await fetch('/api/dismissed-stockouts', {
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

  async function bulkPushToOdoo(rows) {
    setBulkPushing(true)
    const results = await Promise.all(rows.map(async r => {
      const minQty = Number(getVal(r.sku, 'min', r.suggestedMin))
      const maxQty = Number(getVal(r.sku, 'max', r.suggestedMax))
      try {
        const res = await fetch('/api/update-orderpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: r.sku, minQty, maxQty }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        return { r, ok: true }
      } catch (err) {
        setPushError(prev => ({ ...prev, [r.sku]: err.message }))
        return { r, ok: false }
      }
    }))
    const succeeded = results.filter(x => x.ok).map(x => x.r)
    if (succeeded.length > 0) await dismissMany(succeeded)
    setSelected(new Set())
    setBulkPushing(false)
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

  const visible = useMemo(() => {
    return results
      .filter(r => !dismissedSkus.has(r.sku))
      .filter(r => {
        const isLowStock = r.currentMax != null && r.currentMax <= 1
        if (lowStockFilter === 'only') return isLowStock
        if (lowStockFilter === 'hide') return !isLowStock
        return true
      })
  }, [results, dismissedSkus, lowStockFilter])

  const sorted = useMemo(() => {
    return [...visible].sort((a, b) => {
      const av = getValue(a, sortCol)
      const bv = getValue(b, sortCol)
      let cmp
      if (av instanceof Date) cmp = av - bv
      else if (typeof av === 'string') cmp = av.localeCompare(bv)
      else cmp = av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [visible, sortCol, sortDir])

  const selectedRows = useMemo(
    () => sorted.filter(r => selected.has(r.sku)),
    [sorted, selected]
  )

  // Update select-all checkbox indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < sorted.length
    }
  }, [selected, sorted])

  function toggleSelectAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map(r => r.sku)))
    }
  }

  const dismissedCount = dismissedSkus.size

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
        No stockout events detected in this date range.
      </div>
    )
  }

  return (
    <>
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Stockout History</h2>
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            {sorted.length} products
          </span>
          {dismissedCount > 0 && (
            <span className="text-xs text-gray-400">{dismissedCount} dismissed for 8 weeks</span>
          )}
          <button
            onClick={() => setLowStockFilter(f => f === 'all' ? 'only' : f === 'only' ? 'hide' : 'all')}
            className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
              lowStockFilter === 'only'
                ? 'bg-amber-100 border-amber-300 text-amber-700'
                : lowStockFilter === 'hide'
                ? 'bg-gray-100 border-gray-300 text-gray-500 line-through'
                : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            Low stock strategy
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">Products that ran out of stock before a resupply arrived</p>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-6 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
          <span className="text-sm text-indigo-700 font-medium">{selected.size} selected</span>
          <button
            onClick={() => bulkPushToOdoo(selectedRows)}
            disabled={bulkPushing}
            className="inline-flex items-center rounded border border-indigo-300 px-3 py-1 text-xs text-indigo-600 bg-white hover:bg-indigo-50 disabled:opacity-40 transition-colors"
          >
            {bulkPushing ? 'Pushing…' : 'Push to Odoo'}
          </button>
          <button
            onClick={() => dismissMany(selectedRows)}
            className="inline-flex items-center rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-indigo-400 hover:text-indigo-600 ml-1"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="table-fixed divide-y divide-gray-200 text-sm" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  onClick={() => !col.noSort && handleSort(col.key)}
                  style={{ width: widths[i] }}
                  className={`relative px-3 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs select-none overflow-hidden ${col.noSort ? '' : 'cursor-pointer hover:bg-gray-100'} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.key === 'select' ? (
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={sorted.length > 0 && selected.size === sorted.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  ) : (
                    <>
                      {col.label}
                      {!col.noSort && <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />}
                    </>
                  )}
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
              const isPushing = pushing.has(r.sku)
              const error = pushError[r.sku]
              const isSelected = selected.has(r.sku)
              return (
                <tr key={r.sku} className={isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelected(prev => {
                        const next = new Set(prev)
                        next.has(r.sku) ? next.delete(r.sku) : next.add(r.sku)
                        return next
                      })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-3 overflow-hidden">
                    <div className="font-medium text-gray-900 truncate">{r.productName}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 truncate">{r.sku}</span>
                      {r.currentMax != null && r.currentMax <= 1 && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Low stock strategy
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setAnalysisProduct(r)}
                        className="inline-flex items-center rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Analysis
                      </button>
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
                  <td className="px-6 py-3 text-right">
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 font-medium text-red-800">
                      {r.stockoutCount}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{formatDate(r.lastStockout.outDate)}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{r.lastStockout.daysOut}d</td>
                  <td className="px-6 py-3 text-right text-gray-600">{r.currentMin ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{r.currentMax ?? '—'}</td>
                  <td className="px-6 py-3 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      value={getVal(r.sku, 'min', r.suggestedMin)}
                      onChange={e => setVal(r.sku, 'min', e.target.value)}
                      className="w-16 text-right text-sm font-medium text-indigo-700 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-6 py-3 text-right align-top">
                    <div className="flex flex-col items-end gap-1">
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
    {analysisProduct && (
      <StockoutDrawer
        product={analysisProduct}
        salesRows={allSalesRows}
        receiptRows={allReceiptRows}
        onClose={() => setAnalysisProduct(null)}
      />
    )}
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
