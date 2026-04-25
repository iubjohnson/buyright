import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_API_KEY })

const MAX_SEASONAL_SKUS = 40

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { products, todayISO } = req.body
  if (!products?.length) return res.status(400).json({ error: 'No products provided' })

  const today = new Date(todayISO)
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const upcomingMonths = []
  const cur = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getTime() + 8 * 7 * 24 * 60 * 60 * 1000)
  while (cur <= end) { upcomingMonths.push(MONTH_NAMES[cur.getMonth()]); cur.setMonth(cur.getMonth() + 1) }

  // Prioritize most seasonal (highest peak/blended ratio), cap at MAX_SEASONAL_SKUS
  const ranked = [...products]
    .sort((a, b) => (b.peakVelocity / (b.weeklyVelocity || 1)) - (a.peakVelocity / (a.weeklyVelocity || 1)))
    .slice(0, MAX_SEASONAL_SKUS)

  const payload = ranked.map(p => ({
    sku: p.sku,
    name: p.productName,
    blendedWeeklyVelocity: p.weeklyVelocity,
    peakWeeklyVelocity: p.peakVelocity,
    monthlyBreakdown: p.monthlyBreakdown,
    currentMin: p.currentMin,
    currentMax: p.currentMax,
    suggestedMin: p.suggestedMin,
    suggestedMax: p.suggestedMax,
    onHand: p.onHand,
  }))

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are an expert inventory analyst for an independent specialty homebrew supply retailer. Analyze seasonal sales patterns and explain what they mean for buying decisions right now. Be specific: reference the peak months, the velocity difference, and what action to take. Each insight is 1-2 sentences max. Respond with valid JSON only — no markdown.`,
      messages: [{
        role: 'user',
        content: `Today: ${today.toDateString()}. The next 8 weeks cover: ${upcomingMonths.join(', ')}.

Analyze the seasonal patterns for these products. monthlyBreakdown shows avg weekly velocity per calendar month. peakWeeklyVelocity is the best 2-month rolling average — suggestedMax is based on it. blendedWeeklyVelocity is the overall recency-weighted average used for suggestedMin.

${JSON.stringify(payload)}

Respond with exactly this JSON — one insight per SKU explaining the seasonal pattern and whether the buyer should act now:
{"insights":{"SKU_VALUE":"insight text"}}`,
      }],
    })

    const text = response.content[0].text.trim()
    let insights = {}
    try {
      insights = JSON.parse(text).insights ?? {}
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) insights = JSON.parse(match[0]).insights ?? {}
    }

    res.status(200).json({ insights })
  } catch (err) {
    console.error('seasonal-insights error:', err)
    res.status(500).json({ error: err.message })
  }
}
