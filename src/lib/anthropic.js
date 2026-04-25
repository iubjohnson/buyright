import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MODEL = 'claude-sonnet-4-6'
const MODEL_FAST = 'claude-haiku-4-5-20251001'
const MAX_INSIGHTS_SKUS = 100
const MAX_SEASONAL_SKUS = 20

export async function generateInsights(results, targetWeeks) {
  const today = new Date()

  const activeResults = results
    .filter(r => !r.noSales)
    .slice(0, MAX_INSIGHTS_SKUS)
    .map(r => ({
      sku: r.sku,
      name: r.productName,
      vendor: r.vendor,
      onHand: r.onHand,
      weeklyVelocity: r.weeklyVelocity,
      daysOfStock: r.daysOfStock,
      reorderStatus: r.reorderStatus,
      suggestedBuyQty: r.suggestedBuyQty,
      dataPoints: r.dataPoints,
      lowConfidence: r.lowConfidence,
      seasonality: r.seasonality,
    }))

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are an expert inventory analyst for independent specialty retail stores. Generate specific, actionable, data-driven insights for inventory buying decisions. Each insight is 1-2 sentences — reference actual numbers (velocity, days of stock, trends). Flag anomalies: demand drops that may mask stockouts, single large orders skewing velocity, erratic patterns. Respond with valid JSON only — no markdown, no prose outside the JSON.`,
    messages: [
      {
        role: 'user',
        content: `Today: ${today.toDateString()}. Target stock: ${targetWeeks} weeks.\n\nGenerate insights for these ${activeResults.length} SKUs:\n${JSON.stringify(activeResults)}\n\nRespond with exactly this JSON structure:\n{"insights":{"SKU_VALUE":"insight text"},"anomalies":["anomaly description"]}`,
      },
    ],
  })

  const text = response.content[0].text.trim()
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return { insights: {}, anomalies: [] }
  }
}

export async function generateSeasonalInsights(products, today) {
  const res = await fetch('/api/seasonal-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products, todayISO: today.toISOString() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  const { insights } = await res.json()
  return insights ?? {}
}

export async function sendChatMessage(messages, context) {
  const { results, targetWeeks } = context
  const today = new Date()

  const belowCount = results.filter(r => r.reorderStatus === 'below').length
  const approachingCount = results.filter(r => r.reorderStatus === 'approaching').length
  const topUrgent = results
    .filter(r => !r.noSales && r.reorderStatus === 'below')
    .slice(0, 10)
    .map(r => `  ${r.sku} (${r.productName}): ${r.daysOfStock ?? '?'} days of stock, ${r.weeklyVelocity} units/wk, suggest buying ${r.suggestedBuyQty}`)

  const systemMsg = `You are BuyRight, an AI inventory buying assistant for independent specialty retail stores.

Today: ${today.toDateString()}
Target weeks of stock: ${targetWeeks}
Active SKUs analyzed: ${results.filter(r => !r.noSales).length}
Below reorder point: ${belowCount}
Approaching reorder point: ${approachingCount}

Most urgent items:
${topUrgent.join('\n') || '  None currently below reorder point'}

Answer the user's questions about their inventory data and buying decisions. Be concise and action-focused. Reference specific product data when asked about particular SKUs.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemMsg,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  return response.content[0].text
}
