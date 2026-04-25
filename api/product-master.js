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

  try {
    const uid = await getOdooUid()
    const models = xmlrpcClient('/xmlrpc/2/object')
    models._uid = uid

    // Fetch all active, saleable products with a SKU set
    const domain = [['sale_ok', '=', true], ['purchase_ok', '=', true], ['active', '=', true], ['default_code', '!=', false], ['name', 'not ilike', 'proper pour']]
    const products = []
    let offset = 0

    while (true) {
      const batch = await executeKw(models, 'product.product', 'search_read', [domain], {
        fields: ['id', 'default_code', 'name', 'qty_available', 'lst_price', 'seller_ids'],
        limit: BATCH_SIZE, offset,
      })
      products.push(...batch)
      if (batch.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    // Collect all supplier info IDs and fetch in one call
    const allSellerIds = [...new Set(products.flatMap(p => p.seller_ids))]
    let supplierMap = {}

    if (allSellerIds.length > 0) {
      const suppliers = await executeKw(models, 'product.supplierinfo', 'read',
        [allSellerIds],
        { fields: ['product_id', 'partner_id', 'sequence'] }
      )
      // Build map: product.product id → primary vendor name (lowest sequence)
      const byProduct = {}
      for (const s of suppliers) {
        const pid = Array.isArray(s.product_id) ? s.product_id[0] : null
        if (!pid) continue
        if (!byProduct[pid] || s.sequence < byProduct[pid].sequence) {
          byProduct[pid] = { vendor: Array.isArray(s.partner_id) ? s.partner_id[1] : '', sequence: s.sequence }
        }
      }
      supplierMap = byProduct
    }

    // Fetch all product template IDs that have an active BOM and exclude them
    const bomTmplIds = new Set()
    const bomRecords = await executeKw(models, 'mrp.bom', 'search_read',
      [[['active', '=', true]]],
      { fields: ['product_tmpl_id'], limit: 0 }
    )
    for (const b of bomRecords) {
      if (Array.isArray(b.product_tmpl_id)) bomTmplIds.add(b.product_tmpl_id[0])
    }

    // Fetch template IDs for products tagged "rhizome" or "fresh juice" (wildcard, case-insensitive)
    const tagRecords = await executeKw(models, 'product.tag', 'search_read',
      [['|', '|', ['name', 'ilike', 'rhizome'], ['name', 'ilike', 'fresh juice'], ['name', 'ilike', 'dropship']]],
      { fields: ['id'], limit: 0 }
    )
    const tagIds = tagRecords.map(t => t.id)
    const taggedTmplIds = new Set()
    if (tagIds.length > 0) {
      const tagDetails = await executeKw(models, 'product.tag', 'read',
        [tagIds],
        { fields: ['product_template_ids'] }
      )
      for (const t of tagDetails) {
        for (const tmplId of (t.product_template_ids || [])) taggedTmplIds.add(tmplId)
      }
    }

    // Fetch product_tmpl_id for each product so we can filter by BOM and tags
    const productTmplIds = await executeKw(models, 'product.product', 'read',
      [products.map(p => p.id)],
      { fields: ['id', 'product_tmpl_id'] }
    )
    const tmplMap = Object.fromEntries(productTmplIds.map(p => [p.id, p.product_tmpl_id[0]]))

    // Fetch reorder rules (orderpoints) — product_min_qty = reorder point, product_max_qty = order-up-to
    const orderpoints = await executeKw(models, 'stock.warehouse.orderpoint', 'search_read',
      [[['active', '=', true]]],
      { fields: ['product_id', 'product_min_qty', 'product_max_qty'], limit: 0 }
    )
    const orderpointMap = {}
    for (const op of orderpoints) {
      const pid = Array.isArray(op.product_id) ? op.product_id[0] : null
      if (pid && !orderpointMap[pid]) {
        orderpointMap[pid] = { currentMin: op.product_min_qty ?? null, currentMax: op.product_max_qty ?? null }
      }
    }

    // Normalize to the shape calculations.js expects
    const productRows = products
      .filter(p => !bomTmplIds.has(tmplMap[p.id]) && !taggedTmplIds.has(tmplMap[p.id]))
      .map(p => ({
      odooProductId: p.id,
      sku: p.default_code,
      productName: p.name.replace(/^\[[^\]]+\]\s*/, ''),
      onHand: p.qty_available || 0,
      currentPrice: p.lst_price ?? null,
      vendor: supplierMap[p.id]?.vendor || '',
      currentMin: orderpointMap[p.id]?.currentMin ?? null,
      currentMax: orderpointMap[p.id]?.currentMax ?? null,
    }))

    res.status(200).json({ productRows, count: productRows.length })
  } catch (err) {
    console.error('product-master error:', err)
    res.status(500).json({ error: err.message })
  }
}
