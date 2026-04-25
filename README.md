# BuyRight

**AI-powered inventory management assistant for Great Fermentations.**

BuyRight connects directly to Odoo and surfaces three types of actionable inventory insights: products that are overstocked, products that have historically stocked out, and products with seasonal demand patterns. It lets you review, adjust, and push replenishment rule changes back to Odoo without leaving the tool.

---

## What It Does

BuyRight pulls live data from Odoo and runs three analyses:

**Overstocked** — Products where current on-hand exceeds the suggested maximum based on sales velocity. Shows how many weeks of stock you're sitting on and lets you update the Odoo replenishment rules directly.

**Stockout History** — Products that ran out of stock before a resupply arrived. Reconstructs the inventory balance timeline from sales and receipt history, shows every stockout event with duration, and flags products intentionally set to a low-stock strategy.

**Seasonal Watch** — Products where peak-season velocity is significantly higher than the blended average. Grouped by season (Spring/Summer/Fall/Winter). AI-generated insights explain what's driving the seasonal pattern and when to prepare.

---

## Key Features

- **Live Odoo connection** — pulls sales, receipts, products, and replenishment rules via XML-RPC
- **Recency-weighted velocity** — recent sales count more (12-week half-life exponential decay)
- **Seasonal intelligence** — peak velocity calculated from the best 2-month rolling window; products with peak > 1.75x blended average and peak ≥ 2/wk flagged as seasonal
- **Suggested min/max** — editable per row, pre-filled with calculated values
- **Push to Odoo** — writes updated replenishment rules back to Odoo orderpoints in one click
- **Dismiss** — snooze any product for 8 weeks (persisted to disk, survives browser restarts)
- **AI chat** — per-product chat with full transaction history as context
- **Stockout analysis drawer** — area chart of inventory balance over time with stockout periods and restock events highlighted
- **Bulk actions** — select multiple products and push or dismiss in one action
- **Seasonal badge** — links directly to AI chat for seasonally adjusted products

---

## Tech Stack

- **React 19** (Vite)
- **Tailwind CSS v4**
- **Recharts** — inventory balance chart
- **xmlrpc** — Odoo XML-RPC integration
- **Anthropic Claude** (claude-haiku-4-5) — seasonal insights and per-product chat
- **Vercel** — hosting and serverless API routes

---

## Getting Started

Requires a `.env` file with Odoo credentials:

```
ODOO_URL=https://your-instance.odoo.com
ODOO_DATABASE=your-database
ODOO_API_USERNAME=your@email.com
ODOO_API_PASSWORD=your-api-key
VITE_ANTHROPIC_API_KEY=your-anthropic-key
```

Run locally with Vercel dev (required for serverless API routes):

```bash
npm install
vercel dev
```

---

## Background

Built by Bryan Johnson for [Great Fermentations](https://www.greatfermentations.com) — an Indianapolis-based specialty homebrew supply retailer. The goal: replace spreadsheet-based buying decisions with a tool that surfaces the right signal at the right time and lets you act on it without switching between systems.

---

For detailed logic and design decisions see [PRODUCT_SPEC.md](./PRODUCT_SPEC.md).
