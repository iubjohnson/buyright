const STATUS_CONFIG = {
  below: {
    label: 'Below Reorder Point',
    className: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20',
  },
  approaching: {
    label: 'Approaching',
    className: 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  },
  healthy: {
    label: 'Healthy',
    className: 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.healthy
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  )
}
