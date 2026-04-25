import Papa from 'papaparse'

function normalizeKey(str) {
  return str.toLowerCase().replace(/[\s_\-#]/g, '').replace(/[^a-z0-9]/g, '')
}

function findCol(headers, ...candidates) {
  for (const c of candidates) {
    const norm = normalizeKey(c)
    const found = headers.find(h => normalizeKey(h) === norm)
    if (found) return found
  }
  return null
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors, meta }) => {
        if (errors.length && !data.length) {
          reject(new Error('CSV parse failed: ' + errors[0].message))
          return
        }
        resolve({ data, headers: meta.fields || [] })
      },
      error: err => reject(new Error(err.message)),
    })
  })
}

export async function parseSalesCSV(file) {
  const { data, headers } = await parseFile(file)
  if (!data.length) throw new Error('Sales CSV is empty')

  const skuCol = findCol(headers, 'SKU', 'sku', 'item code', 'product sku', 'itemcode', 'item#')
  const nameCol = findCol(headers, 'Product Name', 'ProductName', 'Name', 'Description', 'Item Name')
  const dateCol = findCol(headers, 'Sales Date', 'SalesDate', 'Date', 'Order Date', 'Transaction Date', 'Invoice Date')
  const orderCol = findCol(headers, 'Sales Order Number', 'Order Number', 'Order#', 'OrderNumber', 'Invoice Number', 'Invoice#')
  const qtyCol = findCol(headers, 'Qty Sold', 'QtySold', 'Quantity', 'Qty', 'Units Sold', 'Quantity Sold')

  const missing = []
  if (!skuCol) missing.push('SKU')
  if (!dateCol) missing.push('Sales Date')
  if (!qtyCol) missing.push('Qty Sold')
  if (missing.length) throw new Error(`Sales CSV is missing required columns: ${missing.join(', ')}`)

  return data
    .map(row => ({
      sku: String(row[skuCol] ?? '').trim(),
      productName: nameCol ? String(row[nameCol] ?? '').trim() : '',
      date: new Date(row[dateCol]),
      orderNumber: orderCol ? String(row[orderCol] ?? '').trim() : '',
      qty: Number(row[qtyCol]) || 0,
    }))
    .filter(r => r.sku && !isNaN(r.date.getTime()) && r.qty > 0)
}

export async function parseProductCSV(file) {
  const { data, headers } = await parseFile(file)
  if (!data.length) throw new Error('Product CSV is empty')

  const skuCol = findCol(headers, 'SKU', 'sku', 'item code', 'product sku', 'itemcode', 'item#')
  const nameCol = findCol(headers, 'Product Name', 'ProductName', 'Name', 'Description', 'Item Name')
  const onHandCol = findCol(headers, 'On Hand Qty', 'OnHandQty', 'On Hand', 'OnHand', 'Quantity On Hand', 'QOH', 'Stock', 'Inventory', 'Qty On Hand')
  const vendorCol = findCol(headers, 'Vendor', 'vendor', 'Supplier', 'Manufacturer', 'Brand')

  const missing = []
  if (!skuCol) missing.push('SKU')
  if (!onHandCol) missing.push('On Hand Qty')
  if (missing.length) throw new Error(`Product CSV is missing required columns: ${missing.join(', ')}`)

  return data
    .map(row => ({
      sku: String(row[skuCol] ?? '').trim(),
      productName: nameCol ? String(row[nameCol] ?? '').trim() : '',
      onHand: Number(row[onHandCol]) || 0,
      vendor: vendorCol ? String(row[vendorCol] ?? '').trim() : '',
    }))
    .filter(r => r.sku)
}
