import { useState, useRef, useEffect } from 'react'

export default function ProductChatPanel({ product, salesRows, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const transactions = salesRows
    .filter(r => r.sku === product.sku)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      qty: r.qty,
      price: r.price ?? null,
      reference: r.reference || '',
    }))

  async function send(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/product-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          productContext: {
            productName: product.productName,
            sku: product.sku,
            onHand: product.onHand,
            currentPrice: product.currentPrice,
            currentMin: product.currentMin,
            currentMax: product.currentMax,
            suggestedMin: product.suggestedMin,
            suggestedMax: product.suggestedMax,
            peakSeasonName: product.peakSeasonName,
            monthlyBreakdown: product.monthlyBreakdown,
            transactions,
            insight: product.insight,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-gray-200 shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{product.productName}</div>
          <div className="text-xs text-gray-400">{product.sku}</div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0 text-lg leading-none">✕</button>
      </div>

      {/* Insight context */}
      {product.insight && (
        <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-800">
          <span className="font-medium">Insight: </span>{product.insight}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">
            Ask anything about this product's sales history or seasonal pattern.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 italic">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="px-4 py-3 border-t border-gray-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
