import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, productContext } = req.body
  if (!messages || !productContext) return res.status(400).json({ error: 'Missing messages or productContext' })

  const { productName, sku, onHand, currentPrice, currentMin, currentMax, suggestedMin, suggestedMax,
          peakSeasonName, monthlyBreakdown, transactions, insight } = productContext

  const monthlyLines = Object.entries(monthlyBreakdown)
    .map(([m, v]) => `  ${m}: ${v}/wk`)
    .join('\n')

  const txLines = transactions
    .map(t => `  ${t.date}  qty ${t.qty > 0 ? '+' : ''}${t.qty}${t.price != null ? '  @$' + t.price.toFixed(2) : ''}  (${t.reference})`)
    .join('\n')

  const system = `You are an inventory analyst assistant for Great Fermentations, an independent homebrew supply retailer in Indianapolis. Answer questions about a specific product's sales history and seasonal patterns. Be concise and specific — reference actual transaction dates, quantities, and order references when they're relevant to the question.

Product: ${productName} (${sku})
On Hand: ${onHand}
Current Price: ${currentPrice != null ? '$' + currentPrice.toFixed(2) : '—'}
Odoo Min/Max: ${currentMin ?? '—'} / ${currentMax ?? '—'}
Suggested Min/Max: ${suggestedMin ?? '—'} / ${suggestedMax ?? '—'}
Peak Season: ${peakSeasonName}

Monthly avg velocity (units/week):
${monthlyLines}

All transactions in analysis period (positive = sale, negative = return):
${txLines}

Seasonal insight on file: "${insight ?? 'none'}"`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
    res.status(200).json({ reply: response.content[0].text })
  } catch (err) {
    console.error('product-chat error:', err)
    res.status(500).json({ error: err.message })
  }
}
