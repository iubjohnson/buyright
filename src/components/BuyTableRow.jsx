import StatusBadge from './StatusBadge'

export default function BuyTableRow({ row, buyQty, onBuyQtyChange, aiInsight, isLoadingInsight }) {
  const urgentText =
    row.reorderStatus === 'below'
      ? 'text-red-700 font-semibold'
      : row.reorderStatus === 'approaching'
      ? 'text-amber-700'
      : 'text-gray-900'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors">
      <td className="px-3 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap">{row.sku}</td>
      <td className="px-3 py-2.5 text-sm text-gray-900 min-w-[160px]">
        {row.productName}
        {row.lowConfidence && (
          <span
            className="ml-1.5 text-xs text-amber-600 font-medium"
            title={`Low confidence: only ${row.dataPoints} sales records`}
          >
            ⚠ low data
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{row.vendor || '—'}</td>
      <td className="px-3 py-2.5 text-sm text-gray-900 text-right whitespace-nowrap tabular-nums">{row.onHand}</td>
      <td className="px-3 py-2.5 text-sm text-gray-900 text-right whitespace-nowrap tabular-nums">{row.weeklyVelocity}</td>
      <td className={`px-3 py-2.5 text-sm text-right whitespace-nowrap tabular-nums ${urgentText}`}>
        {row.daysOfStock !== null ? row.daysOfStock : '—'}
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={row.reorderStatus} />
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-400 text-right whitespace-nowrap tabular-nums">{row.suggestedBuyQty}</td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          min={0}
          value={buyQty ?? row.suggestedBuyQty}
          onChange={e => onBuyQtyChange(row.sku, Math.max(0, parseInt(e.target.value) || 0))}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
        />
      </td>
      <td className="px-3 py-2.5 text-xs min-w-[240px] max-w-xs">
        {isLoadingInsight ? (
          <span className="text-indigo-400 animate-pulse">Generating insight…</span>
        ) : aiInsight ? (
          <span className="text-indigo-700 leading-relaxed">{aiInsight}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
    </tr>
  )
}
