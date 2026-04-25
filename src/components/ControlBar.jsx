export default function ControlBar({ targetWeeks, onTargetWeeksChange, onExport, results, isProcessingAI }) {
  const belowCount = results.filter(r => r.reorderStatus === 'below' && !r.noSales).length
  const approachingCount = results.filter(r => r.reorderStatus === 'approaching' && !r.noSales).length

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm mb-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Target weeks of stock
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onTargetWeeksChange(Math.max(1, targetWeeks - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={52}
              value={targetWeeks}
              onChange={e => onTargetWeeksChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 rounded-md border border-gray-300 px-2 py-1 text-center text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => onTargetWeeksChange(Math.min(52, targetWeeks + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {belowCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span className="text-red-700 font-medium">{belowCount} below reorder point</span>
            </span>
          )}
          {approachingCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-amber-700 font-medium">{approachingCount} approaching</span>
            </span>
          )}
          {isProcessingAI && (
            <span className="flex items-center gap-1.5 text-indigo-600 text-xs">
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating AI insights…
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onExport}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Buy List
      </button>
    </div>
  )
}
