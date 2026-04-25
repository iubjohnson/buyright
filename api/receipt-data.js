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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const dateFrom = req.query.date_from || '2024-11-01'

  try {
    const uid = await getOdooUid()
    const models = xmlrpcClient('/xmlrpc/2/object')
    models._uid = uid

    const domain = [
      ['location_id.usage', '=', 'supplier'],
      ['location_dest_id.usage', '=', 'internal'],
      ['state', '=', 'done'],
      ['date', '>=', dateFrom + ' 00:00:00'],
    ]

    const rows = []
    let offset = 0
    while (true) {
      const batch = await executeKw(models, 'stock.move', 'search_read', [domain], {
        fields: ['product_id', 'quantity', 'date', 'reference'],
        limit: BATCH_SIZE, offset, order: 'date asc',
      })
      rows.push(...batch)
      if (batch.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    const receiptRows = rows
      .map(m => {
        const productId = Array.isArray(m.product_id) ? m.product_id[0] : null
        const displayName = Array.isArray(m.product_id) ? m.product_id[1] : ''
        const skuMatch = displayName.match(/^\[([^\]]+)\]/)
        const sku = skuMatch ? skuMatch[1] : String(productId)
        return {
          odooProductId: productId,
          sku,
          date: m.date,
          qty: m.quantity || 0,
          reference: m.reference || '',
        }
      })
      .filter(r => r.odooProductId && r.qty > 0)

    res.status(200).json({ receiptRows, count: receiptRows.length, dateFrom })
  } catch (err) {
    console.error('receipt-data error:', err)
    res.status(500).json({ error: err.message })
  }
}
