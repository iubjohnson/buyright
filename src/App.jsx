import { useState, useCallback, useEffect, useMemo } from 'react'
import OdooConnectStep from './components/OdooConnectStep'
import OverstockedTable from './components/OverstockedTable'
import StockoutTable from './components/StockoutTable'
import SeasonalWatchTable from './components/SeasonalWatchTable'
import { fetchSalesData, fetchProductMaster, fetchReceiptData } from './lib/odooClient'
import { computeResults, computeOverstocked, detectStockouts, computeSeasonalWatch, getCurrentSeasonName } from './lib/calculations'
import { generateSeasonalInsights } from './lib/anthropic'

export default function App() {
  const [step, setStep] = useState('upload')
  const [activeTab, setActiveTab] = useState('overstocked')
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingSeasons, setLoadingSeasons] = useState(new Set())
  const [error, setError] = useState(null)
  const [insightError, setInsightError] = useState(null)
  const [allSalesRows, setAllSalesRows] = useState([])
  const [allReceiptRows, setAllReceiptRows] = useState([])
  const [overstocked, setOverstocked] = useState([])
  const [stockouts, setStockouts] = useState([])
  const [seasonalWatch, setSeasonalWatch] = useState([])
  const [seasonalInsights, setSeasonalInsights] = useState({})
  const [dismissed, setDismissed] = useState({})
  const [dismissedStockouts, setDismissedStockouts] = useState({})

  useEffect(() => {
    fetch('/api/dismissed-overstocked')
      .then(r => r.json())
      .then(data => setDismissed(data))
      .catch(() => {})
    fetch('/api/dismissed-stockouts')
      .then(r => r.json())
      .then(data => setDismissedStockouts(data))
      .catch(() => {})
  }, [])

  const visibleOverstockedCount = useMemo(
    () => overstocked.filter(r => !dismissed[r.sku]).length,
    [overstocked, dismissed]
  )

  const visibleStockoutsCount = useMemo(
    () => stockouts.filter(r => !dismissedStockouts[r.sku]).length,
    [stockouts, dismissedStockouts]
  )

  const fireInsightsForSeason = useCallback(async (seasonName, products) => {
    setLoadingSeasons(prev => new Set([...prev, seasonName]))
    setInsightError(null)
    try {
      const insights = await generateSeasonalInsights(products, new Date())
      setSeasonalInsights(prev => ({ ...prev, ...insights }))
    } catch (e) {
      console.error('[BuyRight] Seasonal insights failed:', e)
      setInsightError(e.message)
    } finally {
      setLoadingSeasons(prev => { const n = new Set(prev); n.delete(seasonName); return n })
    }
  }, [])

  const handleProcess = useCallback(async (dateFrom) => {
    setIsProcessing(true)
    setError(null)
    try {
      const [salesRows, productRows, receiptRows] = await Promise.all([
        fetchSalesData(dateFrom),
        fetchProductMaster(),
        fetchReceiptData(dateFrom),
      ])
      setAllSalesRows(salesRows)
      setAllReceiptRows(receiptRows)
      const baseResults = computeResults(salesRows, productRows)
      const overstockedResults = computeOverstocked(baseResults)
      const stockoutResults = detectStockouts(salesRows, receiptRows, baseResults)
      const seasonalWatchResults = computeSeasonalWatch(baseResults)
      setOverstocked(overstockedResults)
      setStockouts(stockoutResults)
      setSeasonalWatch(seasonalWatchResults)
      setStep('results')
      setIsProcessing(false)

      // Auto-generate insights for the current season only
      const currentSeason = getCurrentSeasonName()
      const currentSeasonProducts = seasonalWatchResults.filter(r => r.peakSeasonName === currentSeason)
      if (currentSeasonProducts.length > 0) {
        fireInsightsForSeason(currentSeason, currentSeasonProducts)
      }
    } catch (e) {
      setIsProcessing(false)
      setError(e.message)
    }
  }, [])

  const handleReset = () => {
    setStep('upload')
    setActiveTab('overstocked')
    setOverstocked([])
    setStockouts([])
    setAllSalesRows([])
    setAllReceiptRows([])
    setSeasonalWatch([])
    setSeasonalInsights({})
    setLoadingSeasons(new Set())
    setError(null)
    setInsightError(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-none">BuyRight</h1>
              <p className="text-xs text-gray-500">AI-powered inventory buying assistant</p>
            </div>
          </div>
          {step === 'results' && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← New analysis
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {step === 'upload' && (
          <>
            <OdooConnectStep onFetch={handleProcess} isFetching={isProcessing} />
            {error && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex gap-1 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overstocked')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'overstocked'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overstocked
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  activeTab === 'overstocked' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {visibleOverstockedCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('stockouts')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'stockouts'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Stockout History
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  activeTab === 'stockouts' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {visibleStockoutsCount}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('seasonal')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'seasonal'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Seasonal Watch
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  activeTab === 'seasonal' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {seasonalWatch.length}
                </span>
              </button>
            </div>
            {insightError && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
                Seasonal AI insights failed: {insightError}
              </div>
            )}
            {activeTab === 'overstocked' && <OverstockedTable results={overstocked} allSalesRows={allSalesRows} seasonalInsights={seasonalInsights} dismissed={dismissed} setDismissed={setDismissed} />}
            {activeTab === 'stockouts' && <StockoutTable results={stockouts} dismissed={dismissedStockouts} setDismissed={setDismissedStockouts} allSalesRows={allSalesRows} allReceiptRows={allReceiptRows} seasonalInsights={seasonalInsights} />}
            {activeTab === 'seasonal' && <SeasonalWatchTable results={seasonalWatch} seasonalInsights={seasonalInsights} loadingSeasons={loadingSeasons} onGenerateInsights={fireInsightsForSeason} allSalesRows={allSalesRows} />}
          </div>
        )}
      </main>
    </div>
  )
}
