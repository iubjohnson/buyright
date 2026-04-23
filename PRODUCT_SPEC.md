# BuyRight — Product Specification
**Version 1.0**  
**Author:** Bryan Johnson  
**Date:** April 2026

---

## Problem Statement

Independent specialty retailers struggle with inventory buying decisions. Most are too small for a full ERP system like Odoo, but too complex to rely on gut feel and spreadsheets. The result is a cycle of stockouts on top sellers and overbuying on slow movers — both of which hurt cash flow and customer experience.

There is no affordable, accessible tool that meets these businesses where they are — using their existing sales data — and gives them clear, confident answers to the question: *"What should I buy, how much, and why?"*

---

## Product Vision

BuyRight is an AI-powered inventory buying assistant for independent specialty retailers. Upload your sales history, get an actionable buy list that tells you what to reorder, how much, and why — in plain English.

---

## Target Customer

**Independent specialty retailers** — physical storefronts and/or e-commerce operations selling physical products to end consumers. Examples include homebrew supply shops, pet stores, hobby retailers, kitchen supply stores, garden centers, and similar niche retail businesses.

**Characteristics:**
- 100–5,000 active SKUs
- Buying decisions made by owner or a small team
- Currently tracking inventory in spreadsheets or basic point-of-sale systems
- Not ready for or cannot afford a full ERP implementation
- Need simple, actionable outputs — not complex dashboards

---

## User Persona

**Bryan, specialty retail owner**
- Runs day-to-day operations including purchasing
- Not a data analyst — needs decisions, not raw numbers
- Has sales history data but lacks the tools to extract buying signals from it
- Wants to make confident reorder decisions without spending hours in spreadsheets
- Staff need to be able to act on outputs without per-SKU judgment calls

---

## MVP Scope

### Inputs

**File 1: Sales History CSV**

Each row represents one line item on one sales order.

| Field | Type | Notes |
|---|---|---|
| SKU | String | Product identifier |
| Product Name | String | Display name |
| Sales Date | Date | Drives velocity and seasonality calculations |
| Sales Order Number | String | Allows grouping by transaction |
| Qty Sold | Integer | Units sold on that order line |

**File 2: Product Master CSV**

Each row represents one product.

| Field | Type | Notes |
|---|---|---|
| SKU | String | Joins to sales history |
| Product Name | String | Display name |
| On Hand Qty | Integer | Current inventory level |
| Vendor | String | Supplier name |

---

### Calculation Engine

The following calculations are performed per SKU after joining the two input files:

**Weekly Sales Velocity**
- Average units sold per week across the dataset
- Recency-weighted — recent sales weighted more heavily than older sales
- Prevents distortion from obsolete demand patterns

**Seasonality Detection**
- If dataset covers 12+ months, identify recurring seasonal patterns
- Factor current date position into recommendations
- Surface seasonality signals in AI explanations

**Days of Stock Remaining**
- Formula: `(On Hand Qty ÷ Weekly Velocity) × 7`
- Primary sort field for output table — most urgent items surface first

**Reorder Point**
- Threshold at which reorder should be triggered
- MVP default: 2 weeks of sales velocity as safety buffer
- Displayed as a status indicator (below reorder point / approaching / healthy)

**Suggested Buy Quantity**
- Formula: `(Target Weeks of Stock × Weekly Velocity) - On Hand Qty`
- Floor at zero — never recommend negative quantities
- Target weeks of stock defaults to 4, user-adjustable

---

### Edge Case Handling

| Scenario | Behavior |
|---|---|
| SKU with no sales history | Flagged separately, no recommendation generated |
| SKU with very few data points | Flagged, recommendation shown but visually distinguished as low confidence |
| Suggested buy qty calculates to zero or negative | Displayed as 0, no action recommended |
| SKU in product master not found in sales history | Treated as no sales history |

---

### Output Table

Sorted by **Days of Stock Remaining, ascending** (most urgent first).

| Column | Description | Editable |
|---|---|---|
| SKU | Product identifier | No |
| Product Name | Display name | No |
| Vendor | Supplier name | No |
| On Hand | Current inventory | No |
| Weekly Velocity | Avg units sold per week (recency-weighted) | No |
| Days of Stock | Estimated days until stockout | No |
| Reorder Status | Below reorder point / Approaching / Healthy | No |
| Suggested Buy Qty | AI-calculated recommended order quantity | No |
| Buy Qty | User-editable final order quantity | **Yes** |
| AI Insight | Plain English explanation of recommendation | No |

---

### User Controls

- **Target Weeks of Stock** — numeric input, default 4, adjustable by user. Recalculates suggested buy quantities in real time when changed.
- **Buy Qty field** — editable per row. Pre-populated with suggested buy qty. User can override per SKU.
- **Export to CSV** — exports the final buy list (SKU, Product Name, Vendor, Buy Qty) for use as a purchase order input.

---

## AI Layer

The deterministic calculation engine handles the numbers. The AI layer handles interpretation — turning numbers into confidence and language.

### Per-SKU AI Insights
Each SKU in the output table includes a plain English explanation of the recommendation. Examples:

- *"Sales velocity has increased 40% over the past 30 days and you have 8 days of stock remaining. Recommend buying ahead of your normal cycle."*
- *"This product sells consistently at about 12 units per week with no strong seasonal pattern. Current stock covers 3 weeks — slightly below your 4-week target."*
- *"Sales dropped sharply 3 weeks ago after a period of strong demand. This may indicate a stockout masking true demand — consider buying conservatively until the pattern stabilizes."*

### Anomaly Detection
The AI flags unusual patterns in the data that could distort recommendations:
- Single large orders skewing velocity calculations
- Sudden drops in sales that may indicate a stockout rather than reduced demand
- SKUs with erratic, unpredictable sales patterns

### Conversational Interface
Users can ask natural language questions about their data and recommendations:
- *"Why are you recommending 48 units of this product?"*
- *"What would happen if I changed my target weeks to 8?"*
- *"Which products are most at risk of stocking out this month?"*

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend framework | React (Vite) |
| Styling | Tailwind CSS |
| CSV parsing | PapaParse |
| AI integration | Anthropic Claude API (claude-sonnet-4-20250514) |
| Deployment | Vercel (via GitHub) |

---

## Out of Scope for MVP

The following are explicitly deferred to future versions:

- Direct integration with POS or e-commerce platforms (Shopify, Square, etc.)
- Supplier lead time inputs
- Supplier minimum order quantity handling
- Multi-location inventory
- Purchase order generation and sending
- User accounts and saved sessions
- Mobile optimization

---

## Success Criteria for MVP

- User can upload two CSV files and receive a ranked buy list within 60 seconds
- AI insights are specific and actionable — not generic
- User can adjust target weeks and see recommendations update in real time
- User can override any suggested buy quantity
- User can export a clean buy list CSV suitable for creating a purchase order
- A non-technical retail owner can use the tool without instructions

---

## Origin Story

BuyRight was designed by Bryan Johnson, who operated Great Fermentations — an Indianapolis-based specialty homebrew supply retailer — for over a decade. Inventory buying decisions were one of the most operationally challenging aspects of running the business: too much reliance on gut feel, not enough signal from the data. BuyRight is the tool Bryan wished he'd had.
