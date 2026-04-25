export async function fetchSalesData(dateFrom) {
  const params = new URLSearchParams({ date_from: dateFrom })
  const res = await fetch(`/api/sales-data?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Sales data fetch failed: ${err.error || res.statusText}`)
  }
  const { salesRows } = await res.json()
  return salesRows.map(r => ({
    sku: r.sku,
    date: new Date(r.date),
    qty: r.qty,
    price: r.price ?? null,
    reference: r.reference,
    productName: '',
  }))
}

export async function fetchProductMaster() {
  const res = await fetch('/api/product-master')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Product master fetch failed: ${err.error || res.statusText}`)
  }
  const { productRows } = await res.json()
  return productRows.map(r => ({
    sku: r.sku,
    productName: r.productName,
    onHand: r.onHand,
    currentPrice: r.currentPrice ?? null,
    vendor: r.vendor,
    currentMin: r.currentMin ?? null,
    currentMax: r.currentMax ?? null,
  }))
}

export async function fetchReceiptData(dateFrom) {
  const params = new URLSearchParams({ date_from: dateFrom })
  const res = await fetch(`/api/receipt-data?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Receipt data fetch failed: ${err.error || res.statusText}`)
  }
  const { receiptRows } = await res.json()
  return receiptRows.map(r => ({
    sku: r.sku,
    date: new Date(r.date),
    qty: r.qty,
    reference: r.reference,
  }))
}
