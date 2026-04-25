import { useState } from 'react'

const PRESETS = [
  { label: 'Since Nov 2024', date: '2024-11-01' },
  { label: 'Last 12 months', date: () => offsetDate(-365) },
  { label: 'Last 6 months', date: () => offsetDate(-182) },
  { label: 'Last 3 months', date: () => offsetDate(-91) },
]

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function resolveDate(d) {
  return typeof d === 'function' ? d() : d
}

export default function OdooConnectStep({ onFetch, isFetching }) {
  const [dateFrom, setDateFrom] = useState('2024-11-01')
  const [activePreset, setActivePreset] = useState('Since Nov 2024')
  const [error, setError] = useState(null)

  const handlePreset = (preset) => {
    const resolved = resolveDate(preset.date)
    setDateFrom(resolved)
    setActivePreset(preset.label)
  }

  const handleCustomDate = (val) => {
    setDateFrom(val)
    setActivePreset(null)
  }

  const handleFetch = async () => {
    setError(null)
    try {
      await onFetch(dateFrom)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#714B67]">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 leading-none">Connected to Odoo</h2>
            <p className="text-xs text-gray-500">great-fermentations.odoo.com</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-3">Pull sales data starting from</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  activePreset === p.label
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 block mb-1">Custom start date</label>
            <input
              type="date"
              value={dateFrom}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => handleCustomDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-700">What gets pulled</p>
            <p>Sales: all completed inventory moves to customers (POS, web, Amazon FBA) from <span className="font-mono text-gray-800">{dateFrom}</span> to today</p>
            <p>Products: all active SKUs with current on-hand quantity and primary vendor</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleFetch}
            disabled={isFetching || !dateFrom}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isFetching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Pulling from Odoo…
              </span>
            ) : (
              'Generate Buy List'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
