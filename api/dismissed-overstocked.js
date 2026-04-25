import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'dismissed-overstocked.json')
const DISMISS_WEEKS = 8

function readDismissed() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  catch { return {} }
}

function writeDismissed(data) {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    const cutoff = Date.now() - DISMISS_WEEKS * 7 * 24 * 60 * 60 * 1000
    const all = readDismissed()
    const active = Object.fromEntries(
      Object.entries(all).filter(([, v]) => new Date(v.dismissedAt).getTime() > cutoff)
    )
    // Prune expired entries from disk
    if (Object.keys(active).length !== Object.keys(all).length) writeDismissed(active)
    return res.status(200).json(active)
  }

  if (req.method === 'POST') {
    try {
      writeDismissed(req.body)
      return res.status(200).json({ ok: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
