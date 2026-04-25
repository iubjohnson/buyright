import xmlrpc from 'xmlrpc'

const ODOO_URL      = process.env.ODOO_URL
const ODOO_DB       = process.env.ODOO_DATABASE
const ODOO_USERNAME = process.env.ODOO_API_USERNAME
const ODOO_API_KEY  = process.env.ODOO_API_PASSWORD

const BATCH_SIZE = 2000

function xmlrpcClient(path) {
  const url = new URL(ODOO_URL)
  const opts = { host: url.hostname, port: url.port || 443, path }
  return url.protocol === 'https:' ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts)
}

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, val) => err ? reject(err) : resolve(val))
  })
}

async function getOdooUid() {
  const common = xmlrpcClient('/xmlrpc/2/common')
  const uid = await call(common, 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  if (!uid) throw new Error('Odoo authentication failed')
  return uid
}

function executeKw(models, model, method, args, kwargs = {}) {
  return call(models, 'execute_kw', [ODOO_DB, models._uid, ODOO_API_KEY, model, method, args, kwargs])
}

async function fetchMoves(models, domain) {
  const fields = ['product_id', 'quantity', 'date', 'reference', 'sale_line_id']
  const rows = []
  let offset = 0
  while (true) {
    const batch = await executeKw(models, 'stock.move', 'search_read', [domain], {
      fields, limit: BATCH_SIZE, offset, order: 'date asc',
    })
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }
  return rows
}

async function buildPriceTimeline(models, allMoves) {
  const saleLineIds = allMoves
    .map(m => Array.isArray(m.sale_line_id) ? m.sale_line_id[0] : null)
    .filter(Boolean)

  if (!saleLineIds.length) return { timeline: {}, lineMap: {} }

  const uniqueIds = [...new Set(saleLineIds)]
  const lines = []
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = await executeKw(models, 'sale.order.line', 'read',
      [uniqueIds.slice(i, i + BATCH_SIZE)],
      { fields: ['product_id', 'price_unit'] }
    )
    lines.push(...batch)
  }

  const lineMap = Object.fromEntries(lines.map(l => [l.id, l.price_unit]))

  // Build per-product list of { date, price } from SO moves only
  const timeline = {}
  for (const m of allMoves) {
    const lineId = Array.isArray(m.sale_line_id) ? m.sale_line_id[0] : null
    if (!lineId) continue
    const price = lineMap[lineId]
    if (price == null || price === 0) continue
    const pid = Array.isArray(m.product_id) ? m.product_id[0] : null
    if (!pid) continue
    if (!timeline[pid]) timeline[pid] = []
    timeline[pid].push({ date: m.date, price })
  }

  // Sort each product's entries by date ascending
  for (const pid of Object.keys(timeline)) {
    timeline[pid].sort((a, b) => a.date.localeCompare(b.date))
  }

  return { timeline, lineMap }
}

function resolvePrice(move, timeline, lineMap) {
  const pid = Array.isArray(move.product_id) ? move.product_id[0] : null
  // SO move — use its own line price directly
  const lineId = Array.isArray(move.sale_line_id) ? move.sale_line_id[0] : null
  if (lineId && lineMap[lineId]) return lineMap[lineId]
  // POS or no SO line — find nearest SO price by date
  const entries = timeline[pid]
  if (!entries?.length) return null
  const moveDate = move.date
  let nearest = entries[0]
  let minDiff = Math.abs(new Date(moveDate) - new Date(nearest.date))
  for (const e of entries) {
    const diff = Math.abs(new Date(moveDate) - new Date(e.date))
    if (diff < minDiff) { minDiff = diff; nearest = e }
  }
  return nearest.price
}

async function fetchAllMoves(models, dateFrom) {
  const baseFilter = [['state', '=', 'done'], ['date', '>=', dateFrom + ' 00:00:00']]

  const [sales, returns] = await Promise.all([
    fetchMoves(models, [['location_dest_id.usage', '=', 'customer'], ...baseFilter]),
    fetchMoves(models, [['location_id.usage', '=', 'customer'], ['location_dest_id.usage', '=', 'internal'], ...baseFilter]),
  ])

  return { sales, returns }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Default: back to 2024-11-01
  const dateFrom = req.query.date_from || '2024-11-01'

  try {
    const uid = await getOdooUid()
    const models = xmlrpcClient('/xmlrpc/2/object')
    models._uid = uid

    const { sales, returns } = await fetchAllMoves(models, dateFrom)

    const allMoves = [...sales, ...returns]
    const { timeline, lineMap } = await buildPriceTimeline(models, allMoves)

    function normalize(moves, sign) {
      return moves
        .map(m => {
          const productId = Array.isArray(m.product_id) ? m.product_id[0] : null
          const displayName = Array.isArray(m.product_id) ? m.product_id[1] : ''
          const skuMatch = displayName.match(/^\[([^\]]+)\]/)
          const sku = skuMatch ? skuMatch[1] : String(productId)
          return {
            odooProductId: productId,
            sku,
            date: m.date,
            qty: (m.quantity || 0) * sign,
            reference: m.reference || '',
            price: resolvePrice(m, timeline, lineMap),
          }
        })
        .filter(r => r.odooProductId && r.qty !== 0)
    }

    const salesRows = [
      ...normalize(sales, 1),
      ...normalize(returns, -1),
    ]

    res.status(200).json({ salesRows, count: salesRows.length, dateFrom })
  } catch (err) {
    console.error('sales-data error:', err)
    res.status(500).json({ error: err.message })
  }
}
