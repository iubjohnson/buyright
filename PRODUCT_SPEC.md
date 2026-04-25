# BuyRight — Product Specification
**Author:** Bryan Johnson  
**Last Updated:** April 2026

---

## Problem Statement

Great Fermentations carries thousands of active SKUs across beer, wine, mead, cider, and related categories. Demand is seasonal, vendor lead times vary, and buying decisions have historically relied on experience and gut feel rather than data signals. The result is a recurring pattern of overstocking slow movers and stocking out on fast ones — both of which hurt cash flow and customer experience.

Odoo has the raw data (sales history, receipts, on-hand quantities, replenishment rules) but no built-in tool to surface actionable buying intelligence. BuyRight fills that gap.

---

## Product Vision

BuyRight is an internal inventory analysis tool that connects to Odoo, surfaces three categories of actionable insight, and lets the buyer review, adjust, and push changes back to Odoo without leaving the tool.

---

## Data Sources

All data is pulled live from Odoo via XML-RPC on each session.

| Source | Odoo Model | Notes |
|---|---|---|
| Sales | `stock.move` | `location_dest_id.usage = 'customer'`, `state = 'done'` |
| Returns | `stock.move` | `location_id.usage = 'customer'`, `location_dest_id.usage = 'internal'` — applied as negative qty |
| Receipts | `stock.move` | `location_id.usage = 'supplier'`, `location_dest_id.usage = 'internal'` |
| Products | `product.product` | Active, sale_ok, purchase_ok, has SKU |
| Replenishment rules | `stock.warehouse.orderpoint` | Current min/max per product |

**Product filters applied:**
- Excludes products with active BOMs (manufactured items)
- Excludes products tagged with: rhizome, fresh juice, dropship
- Excludes products with "proper pour" in the name
- Excludes products with `purchase_ok = false`

---

## Calculation Engine

### Blended Weekly Velocity
Recency-weighted average units sold per week. Recent sales are weighted more heavily using exponential decay with a 12-week half-life. This prevents obsolete demand patterns from distorting current recommendations.

### Peak Velocity
Best 2-month rolling average from the monthly breakdown. Used for suggested max on seasonally adjusted products so the replenishment setting reflects peak demand year-round, not just current conditions.

### Seasonal Adjustment
A product is considered seasonally adjusted when:
- `peakVelocity >= 2 units/week` (minimum meaningful volume)
- `peakVelocity / blendedVelocity > 1.75` (peak is at least 75% above the average)

### Suggested Min
`max(1, round(blendedVelocity × 2))` — two weeks of safety stock at current velocity.

### Suggested Max
- **Seasonal products:** `round(peakVelocity × 8)` — 8 weeks at peak velocity, so the product is stocked for the busy season year-round
- **Non-seasonal products:** `round(blendedVelocity × 8)` — 8 weeks at current velocity

### Stockout Detection
For each product, the opening balance is reconstructed by working backwards from current on-hand:

```
openingBalance = max(0, onHand + totalSales - totalReceipts)
```

Moves are then replayed forward chronologically. When balance reaches zero before a receipt arrives, a stockout event is recorded with the out date, restock date, and days out.

---

## The Three Tabs

### Overstocked
Products where `onHand > suggestedMax`, sorted by overstock ratio (most overstocked first).

**What you can do:**
- Edit suggested min/max values inline
- Push updated values to Odoo orderpoints (creates if none exists)
- Dismiss for 8 weeks (product is hidden until snooze expires or it's re-fetched with worse numbers)
- Open AI chat for seasonal products to understand the demand pattern

**Dismiss logic:** Stored in `data/dismissed-overstocked.json`. Each entry records the dismissal date, on-hand at time of dismissal, and suggested min/max. Entries expire automatically after 8 weeks.

---

### Stockout History
Products that experienced at least one stockout event in the analysis period, sorted by stockout frequency then duration.

**What you can do:**
- View inventory balance chart (area chart with stockout periods shaded red, restock events marked green)
- Edit suggested min/max values inline
- Push updated values to Odoo orderpoints
- Dismiss for 8 weeks
- Bulk select + bulk push or dismiss
- Filter by "Low stock strategy" — products with `currentMax <= 1`
- Open AI chat for seasonal products

**Low stock strategy badge:** Products with `currentMax <= 1` are flagged because frequent stockouts are expected by design. The badge makes these visually distinct and the suggested max column shows whether demand has grown beyond the current strategy.

**Dismiss logic:** Stored in `data/dismissed-stockouts.json`, same structure as overstocked.

---

### Seasonal Watch
Products flagged as seasonally adjusted, grouped by peak season (Spring/Summer/Fall/Winter).

- Current season auto-expands and auto-loads AI insights on data load
- Other seasons are collapsed with an on-demand "Generate Insights" button
- AI insight shown inline under each product name
- Per-product chat available via 💬 button next to the insight

---

## AI Features

### Seasonal Insights (`api/seasonal-insights.js`)
Batched call to claude-haiku-4-5. Up to 40 products per request, sorted by peak/blended ratio. Returns a short plain-English insight per SKU explaining the seasonal pattern, when demand peaks, and what to watch for.

### Per-Product Chat (`api/product-chat.js`)
Conversational interface per product. The system prompt includes the full transaction history (date, qty, order reference) so the AI can answer specific questions about individual orders, patterns, and anomalies. Uses claude-haiku-4-5 with 512 max tokens per response.

---

## Pushing Changes to Odoo

`api/update-orderpoint.js` handles writes back to Odoo:

1. Looks up the product by SKU (`default_code`)
2. Finds the active orderpoint for that product
3. If found: updates `product_min_qty` and `product_max_qty`
4. If not found: creates a new orderpoint using the default warehouse

After a successful push, the product is automatically dismissed from the current tab.

---

## Dismiss / Snooze System

Dismissal is designed to reduce noise without permanently hiding problems.

- **Duration:** 8 weeks from dismissal date
- **Storage:** Local JSON files (`data/dismissed-*.json`) — survives browser clears, not dependent on cookies or localStorage
- **Auto-expiry:** Expired entries are pruned on the next GET request to the dismissed API
- **Tab badge:** Reflects visible (non-dismissed) count only
- **Re-surface:** Products automatically reappear after 8 weeks or if you reload with new data

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Odoo integration | `xmlrpc` npm package |
| AI | Anthropic claude-haiku-4-5 |
| API routes | Vercel serverless functions |
| Dismiss persistence | Local JSON files (`data/`) |

---

## Out of Scope

- Multi-location inventory
- Purchase order generation or sending
- User accounts or saved sessions
- Mobile optimization
- Supplier lead time or MOQ handling
