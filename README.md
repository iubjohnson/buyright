# BuyRight

**AI-powered inventory buying assistant for independent specialty retailers.**

BuyRight helps small retail business owners make smarter inventory purchasing decisions. Upload your sales history and current inventory, and BuyRight tells you what to reorder, how much, and why — in plain English.

---

## The Problem

Independent specialty retailers live in the gap between gut feel and full ERP systems. Too complex for a spreadsheet, too small for Odoo or NetSuite. The result: stockouts on top sellers, overbuying on slow movers, and purchasing decisions made without clear data signals.

## The Solution

BuyRight analyzes your sales history to calculate recency-weighted velocity, detects seasonal patterns, and generates a ranked buy list sorted by urgency. An AI layer explains each recommendation in plain language so you understand *why* — not just *what*.

---

## Features

- 📂 **CSV upload** — works with your existing sales data, no new systems required
- 📊 **Intelligent reorder analysis** — recency-weighted velocity, seasonality detection, days of stock remaining
- 🤖 **AI-powered insights** — plain English explanation of every recommendation
- ✏️ **Editable buy quantities** — accept, adjust, or override any suggestion
- ⚙️ **Adjustable parameters** — set your own target weeks of stock
- 📤 **Export to CSV** — download your final buy list as a purchase order input
- 💬 **Conversational interface** — ask questions about your data in plain English

---

## How It Works

1. Upload your **sales history CSV** (SKU, product name, sales date, order number, qty sold)
2. Upload your **product master CSV** (SKU, product name, on-hand qty, vendor)
3. Set your **target weeks of stock** (default: 4 weeks)
4. Review your **ranked buy list** — sorted by urgency, explained in plain English
5. Adjust quantities as needed and **export your buy list**

---

## Input Format

**Sales History CSV**
| Field | Description |
|---|---|
| SKU | Product identifier |
| Product Name | Display name |
| Sales Date | Date of sale |
| Sales Order Number | Order identifier |
| Qty Sold | Units sold |

**Product Master CSV**
| Field | Description |
|---|---|
| SKU | Product identifier |
| Product Name | Display name |
| On Hand Qty | Current inventory level |
| Vendor | Supplier name |

---

## Tech Stack

- **React** (Vite)
- **Tailwind CSS**
- **PapaParse** — CSV parsing
- **Anthropic Claude API** — AI insights and conversational interface

---

## Getting Started

```bash
git clone https://github.com/iubjohnson/buyright.git
cd buyright
npm install
```

Add your Anthropic API key to a `.env` file:
```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

Start the development server:
```bash
npm run dev
```

---

## Background

BuyRight was built by Bryan Johnson, who operated [Great Fermentations](https://www.greatfermentations.com) — an Indianapolis-based specialty homebrew supply retailer — for over a decade. Inventory buying decisions were one of the hardest operational challenges in running the business. BuyRight is the tool he wished he'd had.

---

## Product Specification

For a detailed breakdown of product decisions, logic, and design rationale see [PRODUCT_SPEC.md](./PRODUCT_SPEC.md).
