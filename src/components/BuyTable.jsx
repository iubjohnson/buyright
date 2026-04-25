import BuyTableRow from './BuyTableRow'

const HEADERS = [
  { label: 'SKU', align: 'left' },
  { label: 'Product Name', align: 'left' },
  { label: 'Vendor', align: 'left' },
  { label: 'On Hand', align: 'right' },
  { label: 'Wkly Velocity', align: 'right' },
  { label: 'Days of Stock', align: 'right' },
  { label: 'Reorder Status', align: 'left' },
  { label: 'Suggested Qty', align: 'right' },
  { label: 'Buy Qty', align: 'right' },
  { label: 'AI Insight', align: 'left' },
]

export default function BuyTable({ results, buyQtys, onBuyQtyChange, aiInsights, isProcessingAI }) {
  const activeResults = results.filter(r => !r.noSales)
  const noSalesResults = results.filter(r => r.noSales)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              {HEADERS.map(h => (
                <th
                  key={h.label}
                  className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${h.align === 'right' ? 'text-right' : ''}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeResults.length === 0 ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-12 text-center text-sm text-gray-400">
                  No products with sales history found.
                </td>
              </tr>
            ) : (
              activeResults.map(row => (
                <BuyTableRow
                  key={row.sku}
                  row={row}
                  buyQty={buyQtys[row.sku]}
                  onBuyQtyChange={onBuyQtyChange}
                  aiInsight={aiInsights[row.sku]}
                  isLoadingInsight={isProcessingAI && !aiInsights[row.sku]}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {noSalesResults.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {noSalesResults.length} product{noSalesResults.length !== 1 ? 's' : ''} with no sales history — no recommendation generated
          </p>
          <div className="flex flex-wrap gap-1.5">
            {noSalesResults.map(r => (
              <span
                key={r.sku}
                className="text-xs text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5 font-mono"
                title={r.productName}
              >
                {r.sku}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
