import xmlrpc from 'xmlrpc'

const ODOO_URL      = process.env.ODOO_URL
const ODOO_DB       = process.env.ODOO_DATABASE
const ODOO_USERNAME = process.env.ODOO_API_USERNAME
const ODOO_API_KEY  = process.env.ODOO_API_PASSWORD

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { sku, minQty, maxQty } = req.body
  if (!sku || minQty == null || maxQty == null) {
    return res.status(400).json({ error: 'sku, minQty, and maxQty are required' })
  }

  try {
    const uid = await getOdooUid()
    const models = xmlrpcClient('/xmlrpc/2/object')
    models._uid = uid

    // Find product by SKU
    const products = await executeKw(models, 'product.product', 'search_read',
      [[['default_code', '=', sku]]],
      { fields: ['id'], limit: 1 }
    )
    if (!products.length) return res.status(404).json({ error: `Product not found: ${sku}` })
    const productId = products[0].id

    // Find existing active orderpoint
    const orderpoints = await executeKw(models, 'stock.warehouse.orderpoint', 'search_read',
      [[['product_id', '=', productId], ['active', '=', true]]],
      { fields: ['id'], limit: 1 }
    )

    if (orderpoints.length) {
      await executeKw(models, 'stock.warehouse.orderpoint', 'write',
        [[orderpoints[0].id], { product_min_qty: minQty, product_max_qty: maxQty }]
      )
      return res.status(200).json({ ok: true, created: false })
    } else {
      // Get default warehouse for create
      const warehouses = await executeKw(models, 'stock.warehouse', 'search_read',
        [[['active', '=', true]]],
        { fields: ['id'], limit: 1 }
      )
      if (!warehouses.length) return res.status(500).json({ error: 'No active warehouse found' })

      await executeKw(models, 'stock.warehouse.orderpoint', 'create',
        [{ product_id: productId, product_min_qty: minQty, product_max_qty: maxQty, warehouse_id: warehouses[0].id }]
      )
      return res.status(200).json({ ok: true, created: true })
    }
  } catch (err) {
    console.error('update-orderpoint error:', err)
    res.status(500).json({ error: err.message })
  }
}
